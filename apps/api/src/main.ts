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
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";

import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("ZMK Trendyol Platform API")
    .setDescription("Trendyol Pazarlamacı Botu + Mağaza Zekâ Platformu")
    .setVersion("0.2.0")
    .addBearerAuth()
    .addTag("Analytics", "KPI, P&L, Restocking")
    .addTag("Competitors", "Rakip takip, Buybox, Stok Probe, Dinamik Fiyatlama")
    .addTag("AI", "Yorum analizi, Listing optimizasyonu")
    .addTag("Intelligence", "A/B Test, ML Prediction, Game Theory, War Room")
    .addTag("Scraper", "Trendyol sayfa tarama motoru")
    .addTag("Notifications", "WebSocket + Telegram bildirimleri")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // Render uses PORT, local uses API_PORT
  const port = process.env.PORT || process.env.API_PORT || 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 ZMK API running on port ${port}`);
  console.log(`📚 Swagger docs at /api/docs`);
  console.log(`🔌 WebSocket server ready`);
}
bootstrap();

