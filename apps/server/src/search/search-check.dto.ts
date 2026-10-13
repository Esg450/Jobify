import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_SEARCH_RESULTS } from './search.constants.js';

export class SearchCandidateDto {
  @IsString()
  @MaxLength(200)
  id!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @MaxLength(500)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;
}

/** Results from an earlier search, to find out which ones the user has saved since. */
export class CheckSearchResultsDto {
  @IsArray()
  @ArrayMaxSize(MAX_SEARCH_RESULTS)
  @ValidateNested({ each: true })
  @Type(() => SearchCandidateDto)
  candidates!: SearchCandidateDto[];
}
