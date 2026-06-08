import AnthropicSdk from '@anthropic-ai/sdk';
import { extractFirstText } from './summary-parse';

export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

const SUMMARY_MAX_TOKENS = 256;
const SUMMARY_TIMEOUT_MS = 30_000;
const SUMMARY_MAX_RETRIES = 0;

interface AnthropicConstructorOptions {
  apiKey: string;
  maxRetries: typeof SUMMARY_MAX_RETRIES;
  timeout: typeof SUMMARY_TIMEOUT_MS;
}

interface AnthropicCreateParams {
  model: typeof SUMMARY_MODEL;
  max_tokens: typeof SUMMARY_MAX_TOKENS;
  system: string;
  messages: Array<{ role: 'user'; content: string }>;
}

interface AnthropicLikeClient {
  messages: {
    create(
      params: AnthropicCreateParams,
      options?: { signal: AbortSignal },
    ): Promise<{ content: unknown }>;
  };
}

export type AnthropicClientConstructor = new (
  options: AnthropicConstructorOptions,
) => AnthropicLikeClient;

export interface SummaryAiClient {
  createSummary(input: {
    apiKey: string;
    sourceText: string;
    signal?: AbortSignal;
  }): Promise<{ summary: string; model: typeof SUMMARY_MODEL }>;
}

const DEFAULT_ANTHROPIC_CONSTRUCTOR = AnthropicSdk as unknown as AnthropicClientConstructor;

export function createAnthropicSummaryClient(
  AnthropicCtor: AnthropicClientConstructor = DEFAULT_ANTHROPIC_CONSTRUCTOR,
): SummaryAiClient {
  return {
    async createSummary({ apiKey, sourceText, signal }) {
      const client = new AnthropicCtor({
        apiKey,
        maxRetries: SUMMARY_MAX_RETRIES,
        timeout: SUMMARY_TIMEOUT_MS,
      });
      const msg = await client.messages.create(
        {
          model: SUMMARY_MODEL,
          max_tokens: SUMMARY_MAX_TOKENS,
          system:
            'あなたは技術記事を 150 文字以内で簡潔に要約するアシスタントです。回答は日本語で、箇条書きではなく 1〜2 文の平文で書いてください。',
          messages: [
            {
              role: 'user',
              content: `次の記事 (タイトル / 概要 / 本文の要点) を読んで、主要な論点を 150 文字以内で要約してください。\n\n---\n\n${sourceText}`,
            },
          ],
        },
        signal ? { signal } : undefined,
      );

      return {
        summary: extractFirstText(msg.content),
        model: SUMMARY_MODEL,
      };
    },
  };
}
