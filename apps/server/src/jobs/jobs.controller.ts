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
  Query,
} from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto.js';
import { CreateJobEventDto, UpdateJobEventDto } from './dto/job-event.dto.js';
import { QueryJobsDto } from './dto/query-jobs.dto.js';
import { UpdateJobDto } from './dto/update-job.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query() query: QueryJobsDto) {
    return this.jobs.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jobs.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobs.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobDto) {
    return this.jobs.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jobs.remove(id);
  }

  @Post(':id/events')
  addEvent(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateJobEventDto) {
    return this.jobs.addEvent(id, dto);
  }

  @Patch(':id/events/:eventId')
  updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateJobEventDto,
  ) {
    return this.jobs.updateEvent(id, eventId, dto);
  }

  @Delete(':id/events/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEvent(
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.jobs.removeEvent(id, eventId);
  }
}
