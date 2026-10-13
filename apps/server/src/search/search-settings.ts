import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Where the JobSpy service lives. Like the AI provider, it is shared by everyone on the
 * instance and only admins can change it. The API key is never returned to the browser.
 */
export interface SearchSettings {
  enabled: boolean;
  /** Base URL of the JobSpy service, e.g. http://192.168.1.10:8000 */
  baseUrl: string;
  apiKey: string;
}

export type PublicSearchSettings = Omit<SearchSettings, 'apiKey'> & {
  hasApiKey: boolean;
  /** Whether the Find jobs page should be shown. */
  configured: boolean;
};

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
