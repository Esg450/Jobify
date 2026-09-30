import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { DASHBOARD_CARDS, type DashboardCard, type DashboardLayout } from './preferences.js';

export class DashboardLayoutDto implements DashboardLayout {
  @IsArray()
  @IsIn(DASHBOARD_CARDS, { each: true })
  order!: DashboardCard[];

  @IsArray()
  @IsIn(DASHBOARD_CARDS, { each: true })
  hidden!: DashboardCard[];
}

export class PreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DashboardLayoutDto)
  dashboard?: DashboardLayoutDto;
}
