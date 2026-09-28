import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/configuration.js';
import type { JobDraft } from '../importers/job-draft.js';
import { JobsService, type JobWithEvents } from '../jobs/jobs.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UsersService } from '../users/users.service.js';
import {
  AI_PROVIDER_IDS,
  type AiProviderId,
  type AiSettings,
  type PublicAiSettings,
  type UpdateAiSettingsDto,
} from './ai-settings.js';
import { parseExtractedJob } from './job-extraction.js';
import { AI_TASK_FIELDS, buildExtractionPrompt, buildTaskPrompt, type AiTask } from './prompts.js';
import { createAiProvider, validateAiSettings } from './provider-factory.js';
import { AiProviderError, type CompletionRequest } from './providers/ai-provider.js';

const SETTINGS_KEY = 'ai';

@Injectable()
export class AiService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly jobs: JobsService,
    private readonly users: UsersService,
  ) {}

  /** Settings saved in the UI take precedence over environment variables. */
  async getSettings(): Promise<AiSettings> {
    const saved = await this.settings.get<AiSettings>(SETTINGS_KEY);
    if (saved) return saved;

    const { ai } = this.config;
    const provider = AI_PROVIDER_IDS.includes(ai.provider as AiProviderId)
      ? (ai.provider as AiProviderId)
      : null;
    return { provider, model: ai.model ?? '', apiKey: ai.apiKey ?? '', baseUrl: ai.baseUrl ?? '' };
  }

  async getPublicSettings(): Promise<PublicAiSettings> {
    const { apiKey, ...settings } = await this.getSettings();
    return {
      ...settings,
      hasApiKey: Boolean(apiKey),
      configured: !validateAiSettings({ ...settings, apiKey }),
    };
  }

  async updateSettings(dto: UpdateAiSettingsDto): Promise<PublicAiSettings> {
    const current = await this.getSettings();
    // A stored key belongs to one provider, so it is dropped when the provider changes.
    const keptApiKey = dto.provider === current.provider ? current.apiKey : '';
    await this.settings.set<AiSettings>(SETTINGS_KEY, {
      provider: dto.provider,
      model: dto.model?.trim() ?? current.model,
      apiKey: dto.apiKey?.trim() ?? keptApiKey,
      baseUrl: dto.baseUrl?.trim() ?? current.baseUrl,
    });
    return this.getPublicSettings();
  }

  async testConnection(): Promise<{ reply: string }> {
    const reply = await this.complete({
      system: 'You are a connectivity check.',
      prompt: 'Reply with the single word "ready".',
      maxTokens: 1_000,
    });
    return { reply };
  }

  /** Runs an AI task for a job and saves the result on the job. */
  async runTask(userId: number, jobId: number, task: AiTask): Promise<JobWithEvents> {
    const job = await this.jobs.findOne(userId, jobId);
    if (!job.description?.trim()) {
      throw new BadRequestException('Add a job description before using AI features');
    }

    const profile = await this.users.getProfile(userId);
    const output = await this.complete(buildTaskPrompt(task, job, profile));
    return this.jobs.update(userId, jobId, { [AI_TASK_FIELDS[task]]: output });
  }

  async extractJob(pageText: string): Promise<JobDraft> {
    return parseExtractedJob(await this.complete(buildExtractionPrompt(pageText)));
  }

  private async complete(request: CompletionRequest): Promise<string> {
    const settings = await this.getSettings();
    try {
      const output = await createAiProvider(settings).complete(request);
      // Some local reasoning models include their chain of thought inline.
      const answer = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!answer) throw new AiProviderError('The AI provider returned an empty response');
      return answer;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw validateAiSettings(settings)
          ? new BadRequestException(error.message)
          : new BadGatewayException(error.message);
      }
      throw error;
    }
  }
}
