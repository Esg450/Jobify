import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [JobsModule, AiModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
