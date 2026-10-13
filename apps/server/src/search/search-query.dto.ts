import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_SEARCH_RESULTS,
  SEARCH_JOB_TYPES,
  SEARCH_SITE_IDS,
  type SearchJobType,
  type SearchSite,
} from './search.constants.js';

export class SearchJobsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  terms!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SEARCH_SITE_IDS.length)
  @IsIn(SEARCH_SITE_IDS, { each: true })
  sites?: SearchSite[];

  @IsOptional()
  @IsBoolean()
  remote?: boolean;

  /** Only postings from the last N hours. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 90)
  hoursOld?: number;

  @IsOptional()
  @IsIn(SEARCH_JOB_TYPES)
  jobType?: SearchJobType;

  /** Country for Indeed and Glassdoor, e.g. "USA", "UK", "Canada". */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SEARCH_RESULTS)
  limit?: number;
}
