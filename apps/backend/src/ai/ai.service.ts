import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface FindingAnalysis {
  explanation: string;
  businessImpact: string;
  remediation: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'AI analysis is not configured — set AI_API_KEY (an Anthropic API key) to enable it.',
    );
    this.name = 'AiNotConfiguredError';
  }
}

export class AiProviderError extends Error {
  constructor(
    public readonly upstreamStatus: number,
    upstreamMessage: string,
  ) {
    super(`AI provider request failed (${upstreamStatus}): ${upstreamMessage}`);
    this.name = 'AiProviderError';
  }
}

interface AnthropicMessageResponse {
  content: { type: string; text?: string }[];
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-3-5-haiku-latest';

/**
 * Generates human-readable explanation / business impact / remediation
 * text for a security finding, and executive summaries for a full scan,
 * via the Anthropic Messages API.
 *
 * There is no AI provider API key available in this build environment
 * (`AI_API_KEY` is unset — see `.env.example`). Rather than fabricate
 * plausible-sounding "AI-generated" text to make this look finished, every
 * method here throws `AiNotConfiguredError` until a real key is set, and
 * callers are expected to handle that explicitly (leave the
 * `aiExplanation`/etc. fields `null`, as they already are from Step 10,
 * rather than write fake content into them). This mirrors the same honest
 * pattern used for `EmailService` in Step 5 — the difference is that email
 * has a safe real fallback (log instead of send), whereas fabricated AI
 * text has no safe fallback, so the correct behavior here is to fail
 * clearly, not degrade gracefully into fiction.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('AI_API_KEY') || undefined;
    this.client = axios.create({
      baseURL: ANTHROPIC_API_URL,
      timeout: 30_000,
    });
    if (!this.apiKey) {
      this.logger.warn(
        'AI_API_KEY is not configured — AI finding analysis/executive summaries are disabled. ' +
          'Set AI_API_KEY to an Anthropic API key to enable them.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async complete(prompt: string, maxTokens = 512): Promise<string> {
    if (!this.apiKey) {
      throw new AiNotConfiguredError();
    }

    let response: { data: AnthropicMessageResponse };
    try {
      response = await this.client.post<AnthropicMessageResponse>(
        '',
        {
          model: MODEL,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const upstreamMessage =
          (error.response.data as { error?: { message?: string } })?.error
            ?.message ?? error.message;
        this.logger.error(
          `Anthropic API request failed: ${error.response.status} ${upstreamMessage}`,
        );
        throw new AiProviderError(error.response.status, upstreamMessage);
      }
      throw error;
    }

    const text = response.data.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Unexpected response shape from AI provider');
    }
    return text;
  }

  async analyzeFinding(finding: {
    title: string;
    description: string;
    severity: string;
    category: string;
  }): Promise<FindingAnalysis> {
    const prompt = [
      'You are a security analyst assistant. For the following security finding, respond with',
      'exactly three sections, each on its own line prefixed by the label shown:',
      'EXPLANATION: <plain-language explanation of the technical issue, 1-2 sentences>',
      'IMPACT: <concrete business impact if exploited, 1-2 sentences>',
      'REMEDIATION: <specific, actionable fix, 1-2 sentences>',
      '',
      `Severity: ${finding.severity}`,
      `Category: ${finding.category}`,
      `Title: ${finding.title}`,
      `Description: ${finding.description}`,
    ].join('\n');

    const raw = await this.complete(prompt);
    return this.parseFindingAnalysis(raw);
  }

  private parseFindingAnalysis(raw: string): FindingAnalysis {
    const explanation =
      /EXPLANATION:\s*(.+)/i.exec(raw)?.[1]?.trim() ?? raw.trim();
    const businessImpact = /IMPACT:\s*(.+)/i.exec(raw)?.[1]?.trim() ?? '';
    const remediation = /REMEDIATION:\s*(.+)/i.exec(raw)?.[1]?.trim() ?? '';
    return { explanation, businessImpact, remediation };
  }

  async generateExecutiveSummary(params: {
    domainName: string;
    score: number;
    findingCount: number;
    topFindings: { severity: string; title: string }[];
  }): Promise<string> {
    const prompt = [
      'You are a security analyst writing a one-paragraph executive summary (non-technical,',
      'for a business stakeholder) of a domain security scan. Be concise and specific.',
      '',
      `Domain: ${params.domainName}`,
      `Security score: ${params.score}/100`,
      `Total findings: ${params.findingCount}`,
      'Top findings:',
      ...params.topFindings.map((f) => `- [${f.severity}] ${f.title}`),
    ].join('\n');

    return this.complete(prompt, 256);
  }
}
