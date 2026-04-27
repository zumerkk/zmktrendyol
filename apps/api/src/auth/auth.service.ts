import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../common/prisma/prisma.service";
import { encrypt } from "../common/crypto.util";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    name: string;
    tenantName: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create tenant + owner user
    const tenant = await this.prisma.tenant.create({
      data: { name: dto.tenantName },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: "owner",
        tenantId: tenant.id,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException("Invalid credentials");

    // Create session
    await this.prisma.session.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        startedAt: new Date(),
      },
    });

    return this.generateTokens(user);
  }

  async connectStore(
    tenantId: string,
    dto: { sellerId: string; apiKey: string; apiSecret: string },
  ) {
    // 1. Create the connection
    const connection = await this.prisma.sellerConnection.create({
      data: {
        tenantId,
        sellerId: dto.sellerId,
        apiKeyRef: encrypt(dto.apiKey),
        apiSecretRef: encrypt(dto.apiSecret),
        status: "active",
      },
    });

    // 2. Verify connection with health check
    let healthStatus = { connected: false, message: "Health check pending" };
    try {
      const axios = require("axios");
      const authToken = Buffer.from(`${dto.apiKey}:${dto.apiSecret}`).toString("base64");
      const baseURL = process.env.TRENDYOL_API_BASE_URL || "https://apigw.trendyol.com";

      const res = await axios.get(
        `${baseURL}/integration/sellers/${dto.sellerId}/addresses`,
        {
          headers: {
            Authorization: `Basic ${authToken}`,
            "User-Agent": `${dto.sellerId} - SelfIntegration`,
          },
          timeout: 15000,
        },
      );

      healthStatus = {
        connected: true,
        message: `Bağlantı başarılı! ${res.data?.length || 0} adres bulundu.`,
      };

      this.logger.log(`✅ Store connected: seller ${dto.sellerId} verified`);
    } catch (error: any) {
      const status = error.response?.status;
      healthStatus = {
        connected: false,
        message:
          status === 401 || status === 403
            ? "API Key/Secret hatalı. Trendyol Satıcı Paneli'nden kontrol edin."
            : `Bağlantı test edilemedi: ${error.message}`,
      };

      // Mark connection as pending if verification fails
      await this.prisma.sellerConnection.update({
        where: { id: connection.id },
        data: { status: "pending" },
      });

      this.logger.warn(`⚠️ Store connection verification failed: ${error.message}`);
    }

    return {
      connection: {
        id: connection.id,
        sellerId: connection.sellerId,
        status: healthStatus.connected ? "active" : "pending",
      },
      healthCheck: healthStatus,
      nextStep: healthStatus.connected
        ? "Bağlantı aktif! Ürünler 6 saat içinde otomatik senkronize edilecek veya /api/trendyol/products/sync ile hemen tetikleyebilirsiniz."
        : "API kimlik bilgilerini kontrol edip tekrar deneyin.",
    };
  }

  async getConnections(tenantId: string) {
    return this.prisma.sellerConnection.findMany({
      where: { tenantId },
      select: {
        id: true,
        sellerId: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });
  }

  private generateTokens(user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_EXPIRATION || "1d",
      }),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: process.env.JWT_REFRESH_EXPIRATION || "7d",
      }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      // Re-generate tokens
      return this.generateTokens({
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
      });
    } catch (e) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
