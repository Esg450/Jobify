import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  JOB_STATUSES,
  WORKPLACE_TYPES,
  type JobStatus,
  type WorkplaceType,
} from '../job.constants.js';

export const JOB_SORT_FIELDS = [
  'updatedAt',
  'createdAt',
  'appliedOn',
  'company',
  'title',
  'interest',
  'status',
] as const;
export type JobSortField = (typeof JOB_SORT_FIELDS)[number];

const toList = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;

export class QueryJobsDto {
  /** Defaults to the user's current hunt. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  huntId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(toList)
  @IsIn(JOB_STATUSES, { each: true })
  status?: JobStatus[];

  @IsOptional()
  @Transform(toList)
  @IsIn(WORKPLACE_TYPES, { each: true })
  workplaceType?: WorkplaceType[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsIn(JOB_SORT_FIELDS)
  sort?: JobSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
