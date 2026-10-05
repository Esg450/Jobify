import {
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
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { CreateHuntDto, UpdateHuntDto } from './hunt.dto.js';
import { HuntsService } from './hunts.service.js';

@Controller('hunts')
export class HuntsController {
  constructor(private readonly hunts: HuntsService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.hunts.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateHuntDto) {
    return this.hunts.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHuntDto,
  ) {
    return this.hunts.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: PublicUser, @Param('id', ParseIntPipe) id: number) {
    return this.hunts.remove(user.id, id);
  }
}
