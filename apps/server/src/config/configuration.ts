import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the server package (apps/server), independent of the working directory. */
export const SERVER_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');

export interface AppConfig {
  /** Set at image build time from the release tag. */
  version: string;
  port: number;
  host: string;
  dataDir: string;
  staticDir: string;
  /**
   * The password from the single-user version. Only used to confirm the first-run setup of an
   * upgraded instance, so that whoever reaches it first can't claim the existing data.
   */
  legacyPassword: string | undefined;
  ai: {
    provider: string | undefined;
    model: string | undefined;
    apiKey: string | undefined;
    baseUrl: string | undefined;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    version: env.JOBIFY_VERSION || 'dev',
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    dataDir: path.resolve(env.DATA_DIR ?? path.join(SERVER_ROOT, 'data')),
    staticDir: path.resolve(env.STATIC_DIR ?? path.join(SERVER_ROOT, '../web/dist')),
    legacyPassword: env.JOBIFY_PASSWORD || undefined,
    ai: {
      provider: env.AI_PROVIDER || undefined,
      model: env.AI_MODEL || undefined,
      apiKey: env.AI_API_KEY || undefined,
      baseUrl: env.AI_BASE_URL || undefined,
    },
  };
}
