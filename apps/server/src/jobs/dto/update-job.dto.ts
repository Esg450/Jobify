import { PartialType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-job.dto.js';

export class UpdateJobDto extends PartialType(CreateJobDto) {}
