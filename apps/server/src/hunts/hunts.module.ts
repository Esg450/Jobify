import { Global, Module } from '@nestjs/common';
import { HuntsController } from './hunts.controller.js';
import { HuntsService } from './hunts.service.js';

/** Global because jobs, stats, backups and accounts all place or scope jobs by hunt. */
@Global()
@Module({
  controllers: [HuntsController],
  providers: [HuntsService],
  exports: [HuntsService],
})
export class HuntsModule {}
