import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../common/prisma/prisma.service";
import { encrypt } from "../common/crypto.util";

@Injectable()
export class AuthService {
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
    const connection = await this.prisma.sellerConnection.create({
      data: {
        tenantId,
        sellerId: dto.sellerId,
        apiKeyRef: encrypt(dto.apiKey),
        apiSecretRef: encrypt(dto.apiSecret),
        status: "active",
      },
    });
    return connection;
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
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
