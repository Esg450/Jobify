import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [JobsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
