import type { Job, UserProfile } from '../database/schema.js';
import { SYSTEM_PROMPT, describeJob, describeProfile } from './prompts.js';
import type { ChatMessage, CompletionRequest } from './providers/ai-provider.js';

/** Older turns are dropped so a long conversation does not grow without bound. */
export const CHAT_HISTORY_LIMIT = 20;

const CHAT_INSTRUCTIONS = `The candidate is chatting with you about the posting above and may \
ask you to explain it, compare it with their background, or draft answers to questions such as \
"why do you want to work here". When drafting an answer, write it in the candidate's voice using \
only experience from their background. If the posting or background does not cover something, \
say so rather than guessing. Keep replies short and direct unless a draft or a longer answer is \
asked for.`;

/**
 * A conversation about one job. The posting and candidate go in the system prompt so every turn
 * shares the same context, and the saved summary comes along when there is one.
 */
export function buildChatRequest(
  job: Job,
  profile: UserProfile,
  history: ChatMessage[],
  question: string,
): CompletionRequest {
  const summary = job.aiSummary?.trim();
  const context = [
    SYSTEM_PROMPT,
    describeJob(job),
    summary && `<summary>\n${summary}\n</summary>`,
    describeProfile(profile) ?? 'The candidate has not shared their background.',
    CHAT_INSTRUCTIONS,
  ].filter(Boolean);

  return {
    system: context.join('\n\n'),
    // Only the turn itself goes to the provider, not the row it was stored in.
    history: history.slice(-CHAT_HISTORY_LIMIT).map(({ role, content }) => ({ role, content })),
    prompt: question,
    maxTokens: 4_000,
  };
}
