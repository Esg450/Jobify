import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class ImportJobDto {
  @ValidateIf((dto: ImportJobDto) => !dto.html && !dto.text)
  @IsUrl({ require_protocol: true }, { message: 'Provide a URL, or paste the page HTML or text' })
  url?: string;

  /** Page source, for sites that cannot be fetched directly (e.g. behind a login). */
  @IsOptional()
  @IsString()
  @MaxLength(5_000_000)
  html?: string;

  /** Plain text copied from a posting. Requires AI to extract structured fields. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  text?: string;

  /** Use the configured AI provider to fill in fields the parsers could not find. */
  @IsOptional()
  @IsBoolean()
  useAi?: boolean;
}
