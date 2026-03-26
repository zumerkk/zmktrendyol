import { Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../common/prisma/prisma.service";

/**
 * NotificationsGateway — Gerçek Zamanlı Bildirim Merkezi
 *
 * WebSocket ile anlık bildirimler:
 * - Buybox kaybı → anında bildirim 🔔
 * - Stok düşüşü → canlı güncelleme
 * - Fiyat değişimi → grafik canlı güncellenir
 * - A/B test sonuçları → otomatik rapor
 * - Restock uyarıları → aksiyon gerekli
 */
@WebSocketGateway({
  cors: {
    origin: [
      process.env.DASHBOARD_URL || "http://localhost:3000",
      "chrome-extension://*",
    ],
    credentials: true,
  },
  namespace: "/notifications",
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedClients = new Map<
    string,
    { socket: Socket; tenantId: string }
  >();

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const tenantId = client.handshake.query.tenantId as string;
    if (tenantId) {
      this.connectedClients.set(client.id, { socket: client, tenantId });
      client.join(`tenant:${tenantId}`);
      this.logger.log(`Client connected: ${client.id} (tenant: ${tenantId})`);

      // Send unread notification count
      const unreadCount = await this.prisma.notification.count({
        where: { tenantId, isRead: false },
      });
      client.emit("unread_count", { count: unreadCount });
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client requests unread notifications
   */
  @SubscribeMessage("get_notifications")
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number },
  ) {
    const clientData = this.connectedClients.get(client.id);
    if (!clientData) return;

    const notifications = await this.prisma.notification.findMany({
      where: { tenantId: clientData.tenantId },
      orderBy: { createdAt: "desc" },
      take: data?.limit || 20,
    });

    client.emit("notifications_list", notifications);
  }

  /**
   * Client marks notification as read
   */
  @SubscribeMessage("mark_read")
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    await this.prisma.notification.update({
      where: { id: data.notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    client.emit("notification_read", { id: data.notificationId });
  }

  /**
   * Mark all as read
   */
  @SubscribeMessage("mark_all_read")
  async handleMarkAllRead(@ConnectedSocket() client: Socket) {
    const clientData = this.connectedClients.get(client.id);
    if (!clientData) return;

    await this.prisma.notification.updateMany({
      where: { tenantId: clientData.tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    client.emit("all_read", { success: true });
  }

  // ═══════════════════════════════════════════════
  // Server-side push methods (called by other services)
  // ═══════════════════════════════════════════════

  /**
   * Push a notification to a tenant
   * Called by: BuyboxService, StockProbeService, DynamicPricingService, etc.
   */
  async pushNotification(
    tenantId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      severity?: string;
      data?: any;
      channel?: string;
    },
  ) {
    // Save to DB
    const saved = await this.prisma.notification.create({
      data: {
        tenantId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        severity: notification.severity || "info",
        data: notification.data || undefined,
        channel: notification.channel || "websocket",
      },
    });

    // Push via WebSocket
    this.server.to(`tenant:${tenantId}`).emit("new_notification", saved);

    // Update unread count
    const unreadCount = await this.prisma.notification.count({
      where: { tenantId, isRead: false },
    });
    this.server
      .to(`tenant:${tenantId}`)
      .emit("unread_count", { count: unreadCount });

    this.logger.log(
      `📢 Notification pushed: [${notification.type}] ${notification.title}`,
    );
    return saved;
  }

  /**
   * Push real-time data update (price chart, stock level, etc.)
   */
  async pushDataUpdate(tenantId: string, eventType: string, data: any) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit("data_update", { type: eventType, data });
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(tenantId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
