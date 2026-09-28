import { Body, Controller, Get, Post, StreamableFile } from '@nestjs/common';
import { today } from '../common/dates.js';
import { BackupDto } from './backup.dto.js';
import { BackupService } from './backup.service.js';

@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get('json')
  async exportJson(): Promise<StreamableFile> {
    const data = await this.backup.exportJson();
    return new StreamableFile(Buffer.from(JSON.stringify(data, null, 2)), {
      type: 'application/json',
      disposition: `attachment; filename="jobify-backup-${today()}.json"`,
    });
  }

  @Get('csv')
  async exportCsv(): Promise<StreamableFile> {
    return new StreamableFile(Buffer.from(await this.backup.exportCsv()), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="jobify-jobs-${today()}.csv"`,
    });
  }

  @Post('import')
  import(@Body() backup: BackupDto) {
    return this.backup.import(backup);
  }
}
