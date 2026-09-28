import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { HttpFetcher } from './http-fetcher.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

@Module({
  imports: [AiModule],
  controllers: [ImportController],
  providers: [ImportService, HttpFetcher],
})
export class ImportModule {}
