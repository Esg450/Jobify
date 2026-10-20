import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators.js';
import type { PublicUser } from '../users/users.service.js';
import { SaveTagDto } from './tag.dto.js';
import { TagsService } from './tags.service.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.tags.list(user.id);
  }

  /** Creates a tag, or changes the color of an existing one. */
  @Post()
  save(@CurrentUser() user: PublicUser, @Body() dto: SaveTagDto) {
    return this.tags.save(user.id, dto);
  }
}
