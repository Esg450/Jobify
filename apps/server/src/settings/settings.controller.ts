import { Body, Controller, Get, Put } from '@nestjs/common';
import { ProfileDto } from './profile.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('profile')
  getProfile() {
    return this.settings.getProfile();
  }

  @Put('profile')
  updateProfile(@Body() dto: ProfileDto) {
    return this.settings.updateProfile(dto);
  }
}
