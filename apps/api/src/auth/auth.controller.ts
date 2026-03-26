import { Controller, Post, Body, Get, UseGuards, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  async register(
    @Body()
    dto: {
      email: string;
      password: string;
      name: string;
      tenantName: string;
    },
  ) {
    return this.authService.register(dto);
  }

  @Post("login")
  async login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }

  @Post("connect-store")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async connectStore(
    @Req() req: any,
    @Body() dto: { sellerId: string; apiKey: string; apiSecret: string },
  ) {
    return this.authService.connectStore(req.user.tenantId, dto);
  }

  @Get("connections")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getConnections(@Req() req: any) {
    return this.authService.getConnections(req.user.tenantId);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfile(@Req() req: any) {
    return { user: req.user };
  }
}
