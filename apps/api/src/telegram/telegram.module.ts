import { Module } from "@nestjs/common";
import { TelegramBotService } from "./telegram-bot.service";
import { AiModule } from "../ai/ai.module";
import { GodModeModule } from "../god-mode/god-mode.module";

@Module({
  imports: [AiModule, GodModeModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramModule {}
