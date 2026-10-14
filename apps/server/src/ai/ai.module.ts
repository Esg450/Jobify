import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [JobsModule],
  // The chat routes share a prefix with `POST /ai/jobs/:id/:task`, so they are registered first.
  controllers: [ChatController, AiController],
  providers: [AiService, ChatService],
  exports: [AiService],
})
export class AiModule {}
