import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ImportJobDto } from './import-job.dto.js';
import { ImportService } from './import.service.js';

@Controller('import')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Get('sites')
  sites() {
    return this.importer.supportedSites();
  }

  /** Parses a posting into a draft. Nothing is saved; the client reviews the draft first. */
  @Post()
  @HttpCode(HttpStatus.OK)
  import(@Body() dto: ImportJobDto) {
    return this.importer.import(dto);
  }
}
