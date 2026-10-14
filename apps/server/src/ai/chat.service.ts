import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { jobChatMessages, type JobChatMessage } from '../database/schema.js';
import { JobsService } from '../jobs/jobs.service.js';
import { UsersService } from '../users/users.service.js';
import { AiService } from './ai.service.js';
import { buildChatRequest } from './chat-prompt.js';

/**
 * A per-job conversation with the AI. The transcript is stored on the server, so the client
 * only sends the next question and cannot put words in the assistant's mouth.
 */
@Injectable()
export class ChatService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jobs: JobsService,
    private readonly users: UsersService,
    private readonly ai: AiService,
  ) {}

  async list(userId: number, jobId: number): Promise<JobChatMessage[]> {
    await this.jobs.findOne(userId, jobId);
    return this.messagesFor(jobId);
  }

  /** Answers a question and saves both turns. Returns the full conversation. */
  async ask(userId: number, jobId: number, question: string): Promise<JobChatMessage[]> {
    const job = await this.jobs.findOne(userId, jobId);
    if (!job.description?.trim()) {
      throw new BadRequestException('Add a job description before using AI features');
    }

    const [profile, history] = await Promise.all([
      this.users.getProfile(userId),
      this.messagesFor(jobId),
    ]);
    const answer = await this.ai.complete(buildChatRequest(job, profile, history, question));

    // Inserted one at a time so the question always sorts before the answer.
    await this.db.insert(jobChatMessages).values({ jobId, role: 'user', content: question });
    await this.db.insert(jobChatMessages).values({ jobId, role: 'assistant', content: answer });
    return this.messagesFor(jobId);
  }

  async clear(userId: number, jobId: number): Promise<void> {
    await this.jobs.findOne(userId, jobId);
    await this.db.delete(jobChatMessages).where(eq(jobChatMessages.jobId, jobId));
  }

  private messagesFor(jobId: number): Promise<JobChatMessage[]> {
    return this.db
      .select()
      .from(jobChatMessages)
      .where(eq(jobChatMessages.jobId, jobId))
      .orderBy(asc(jobChatMessages.id));
  }
}
