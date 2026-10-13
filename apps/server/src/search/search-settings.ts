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
  ValidateIf,
} from 'class-validator';
import { DEFAULT_SEARCH_SITES, SEARCH_SITE_IDS, type SearchSite } from './search.constants.js';

/**
 * Where the JobSpy service lives and how it should search. Like the AI provider, it is shared
 * by everyone on the instance and only admins can change it. The API key and the proxies
 * (which usually carry credentials) are never returned to the browser.
 */
export interface SearchSettings {
  enabled: boolean;
  /** Base URL of the JobSpy service, e.g. http://192.168.1.10:8000 */
  baseUrl: string;
  apiKey: string;
  /** Boards selected by default on the Find jobs page. */
  defaultSites: SearchSite[];
  /** Country for Indeed and Glassdoor when a search does not name one, e.g. "USA" or "UK". */
  country: string;
  /** Search radius in miles around the location; null leaves it to JobSpy (50). */
  distance: number | null;
  /** Fetch each LinkedIn posting for its description. Slower, and more likely to be rate limited. */
  fetchDescriptions: boolean;
  /** Convert hourly, weekly and monthly pay to yearly figures. */
  annualSalaries: boolean;
  /** Proxies to route searches through, one per line or comma-separated (user:pass@host:port). */
  proxies: string;
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  enabled: false,
  baseUrl: '',
  apiKey: '',
  defaultSites: DEFAULT_SEARCH_SITES,
  country: '',
  distance: null,
  fetchDescriptions: false,
  annualSalaries: false,
  proxies: '',
};

export type PublicSearchSettings = Omit<SearchSettings, 'apiKey' | 'proxies'> & {
  hasApiKey: boolean;
  /** How many proxies are saved. */
  proxyCount: number;
  /** Whether the Find jobs page should be shown. */
  configured: boolean;
};

/** Splits the proxies setting into the list JobSpy takes. */
export function proxyList(proxies: string): string[] {
  return proxies
    .split(/[\n,]/)
    .map((proxy) => proxy.trim())
    .filter(Boolean);
}

export class UpdateSearchSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  /** Omit to keep the stored key; send an empty string to remove it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SEARCH_SITE_IDS.length)
  @IsIn(SEARCH_SITE_IDS, { each: true })
  defaultSites?: SearchSite[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  @Max(500)
  distance?: number | null;

  @IsOptional()
  @IsBoolean()
  fetchDescriptions?: boolean;

  @IsOptional()
  @IsBoolean()
  annualSalaries?: boolean;

  /** Omit to keep the stored proxies; send an empty string to remove them. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  proxies?: string;
}

/** Values from the settings form to try before they are saved. Omitted fields use the saved ones. */
export class TestSearchSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}

/** Returns a human-readable reason the settings are unusable, or undefined if they are fine. */
export function validateSearchSettings(settings: SearchSettings): string | undefined {
  if (!settings.enabled) return 'Job search is turned off. An admin can enable it in Settings.';
  if (!settings.baseUrl) return 'Enter the URL of your JobSpy service in Settings.';
  try {
    const url = new URL(settings.baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    return 'The JobSpy service URL must start with http:// or https://';
  }
  return undefined;
}
