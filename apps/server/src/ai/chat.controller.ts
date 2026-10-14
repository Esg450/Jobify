import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { ChatService } from './chat.service.js';

export class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  message!: string;
}

@Controller('ai/jobs/:id/chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() user: PublicUser, @Param('id', ParseIntPipe) id: number) {
    return this.chat.list(user.id, id);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  ask(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() { message }: AskDto,
  ) {
    return this.chat.ask(user.id, id, message.trim());
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(@CurrentUser() user: PublicUser, @Param('id', ParseIntPipe) id: number) {
    return this.chat.clear(user.id, id);
  }
}
