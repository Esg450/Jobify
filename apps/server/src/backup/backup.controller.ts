import { Body, Controller, Get, Post, StreamableFile } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import { today } from '../common/dates.js';
import type { PublicUser } from '../users/users.service.js';
import { BackupDto } from './backup.dto.js';
import { BackupService } from './backup.service.js';

@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get('json')
  async exportJson(@CurrentUser() user: PublicUser): Promise<StreamableFile> {
    const data = await this.backup.exportJson(user.id);
    return new StreamableFile(Buffer.from(JSON.stringify(data, null, 2)), {
      type: 'application/json',
      disposition: `attachment; filename="jobify-backup-${today()}.json"`,
    });
  }

  @Get('csv')
  async exportCsv(@CurrentUser() user: PublicUser): Promise<StreamableFile> {
    return new StreamableFile(Buffer.from(await this.backup.exportCsv(user.id)), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="jobify-jobs-${today()}.csv"`,
    });
  }

  @Post('import')
  import(@CurrentUser() user: PublicUser, @Body() backup: BackupDto) {
    return this.backup.import(user.id, backup);
  }
}
