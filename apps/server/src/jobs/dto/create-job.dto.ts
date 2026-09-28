import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validators.js';
import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  SALARY_PERIODS,
  WORKPLACE_TYPES,
  type EmploymentType,
  type JobStatus,
  type SalaryPeriod,
  type WorkplaceType,
} from '../job.constants.js';

const SHORT_TEXT = 300;
const LONG_TEXT = 200_000;

export class CreateJobDto {
  @IsString()
  @MaxLength(SHORT_TEXT)
  title!: string;

  @IsString()
  @MaxLength(SHORT_TEXT)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT)
  location?: string | null;

  @IsOptional()
  @IsIn(WORKPLACE_TYPES)
  workplaceType?: WorkplaceType | null;

  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: EmploymentType | null;

  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: JobStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  interest?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  salaryCurrency?: string | null;

  @IsOptional()
  @IsIn(SALARY_PERIODS)
  salaryPeriod?: SalaryPeriod | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  aiSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  coverLetter?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(LONG_TEXT)
  interviewPrep?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT)
  contactName?: string | null;

  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsCalendarDate()
  postedOn?: string | null;

  @IsOptional()
  @IsCalendarDate()
  appliedOn?: string | null;

  @IsOptional()
  @IsCalendarDate()
  deadlineOn?: string | null;

  @IsOptional()
  @IsCalendarDate()
  followUpOn?: string | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  archived?: boolean;
}
