import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from './auth/decorators.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/configuration.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  check() {
    return { status: 'ok', version: this.config.version };
  }
}
