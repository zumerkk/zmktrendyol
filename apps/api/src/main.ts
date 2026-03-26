import * as path from "path";
import * as dotenv from "dotenv";

// BigInt JSON serialization support (required for Prisma BigInt fields)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Load .env only in development (Render provides env vars directly)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
}

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";

import helmet from "helmet";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  // Graceful shutdown
  app.enableShutdownHooks();

  // Security Headers
  app.use(helmet());

  // Global prefix
  app.setGlobalPrefix("api");

  // CORS — allow dashboard, extension, and all Render domains
  app.enableCors({
    origin: [
      process.env.DASHBOARD_URL || "http://localhost:3000",
      "chrome-extension://*",
      /\.onrender\.com$/,
      /localhost/,
    ],
    credentials: true,
    exposedHeaders: ["X-Response-Time"],
  });

  // WebSocket adapter — Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Swagger ──────────────────────────────────
  const isProduction = process.env.NODE_ENV === "production";
  const config = new DocumentBuilder()
    .setTitle("ZMK Trendyol Platform API")
    .setDescription(
      "🚀 **Trendyol Mağaza Zekâ Platformu**\n\n" +
      "Full-stack e-commerce intelligence platform with:\n" +
      "- 🛒 Trendyol API Integration (Products, Orders, Finance, Claims)\n" +
      "- 📊 Analytics & KPI Dashboard\n" +
      "- 🤖 AI-Powered Listing & Review Analysis\n" +
      "- 🎯 Competitor Intelligence & Dynamic Pricing\n" +
      "- 🔑 Keyword Research & SEO Optimization\n" +
      "- 🏪 Multi-Marketplace Hub (Trendyol, Hepsiburada, N11, Amazon)\n" +
      "- 📧 E-Fatura & Finance Management\n" +
      "- ⚡ Automation Rules Engine\n\n" +
      "**Auth:** Use Bearer token from `/api/auth/login`"
    )
    .setVersion("1.0.0")
    .addBearerAuth()
    .addServer(isProduction ? "https://zmk-api.onrender.com" : "http://localhost:4000", isProduction ? "Production" : "Local Development")
    .addTag("System", "Health check, sistem durumu")
    .addTag("Auth", "Kayıt, giriş, mağaza bağlantısı")
    .addTag("Trendyol", "Ürün, sipariş, finans, iade senkronizasyonu")
    .addTag("Analytics", "KPI, P&L, stok yenileme")
    .addTag("Competitors", "Rakip takip, Buybox, dinamik fiyatlama")
    .addTag("AI", "Yorum analizi, listing optimizasyonu")
    .addTag("Intelligence", "A/B Test, ML Prediction, War Room")
    .addTag("Keywords", "Anahtar kelime araştırma, SEO skoru, sıralama takibi")
    .addTag("Marketplace", "Çoklu pazar yeri yönetimi")
    .addTag("Automation", "Otomasyon kuralları motoru")
    .addTag("Scraper", "Trendyol sayfa tarama motoru")
    .addTag("Notifications", "WebSocket + Telegram bildirimleri")
    .addTag("God Mode", "Arbitraj, OOS Sniper, Hijacker Defense")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      filter: true,
      tagsSorter: "alpha",
    },
  });

  // ─── Start Server ─────────────────────────────
  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port, "0.0.0.0");

  logger.log("═══════════════════════════════════════════");
  logger.log(`🚀 ZMK API v1.0.0 running on port ${port}`);
  logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  logger.log(`❤️  Health:  http://localhost:${port}/api/health`);
  logger.log(`🔌 WebSocket ready`);
  logger.log(`🌍 ENV: ${process.env.NODE_ENV || "development"}`);
  logger.log("═══════════════════════════════════════════");
}
bootstrap();

