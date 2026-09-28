import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { RegistrationSettingsDto } from '../auth/auth.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { AdminOnly, CurrentUser } from '../auth/decorators.js';
import { CreateUserDto, UpdateUserDto } from './users.dto.js';
import { UsersService, type PublicUser } from './users.service.js';

/** User management for admins. */
@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('registration')
  async getRegistration(): Promise<RegistrationSettingsDto> {
    return { open: await this.auth.isRegistrationOpen() };
  }

  @Put('registration')
  async setRegistration(@Body() dto: RegistrationSettingsDto): Promise<RegistrationSettingsDto> {
    await this.auth.setRegistrationOpen(dto.open);
    return dto;
  }

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: PublicUser) {
    if (id === currentUser.id) throw new BadRequestException("You can't delete your own account");
    return this.users.remove(id);
  }
}
