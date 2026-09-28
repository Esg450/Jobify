import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller.js';
import { BackupService } from './backup.service.js';

@Module({
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}
