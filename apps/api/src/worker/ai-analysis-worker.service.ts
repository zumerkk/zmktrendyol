import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

@Processor("ai_analysis_queue")
export class AiAnalysisWorkerService extends WorkerHost {
  private readonly logger = new Logger(AiAnalysisWorkerService.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing AI Analysis job: ${job.id} - ${job.data.type}`);

    // Simulating the AI call wait time
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return { success: true, processedBy: "ai-worker" };
  }
}
