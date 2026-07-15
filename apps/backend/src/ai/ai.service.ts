import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type FindingDifficulty = 'EASY' | 'MODERATE' | 'HARD';
export type FindingPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface FindingAnalysis {
  explanation: string;
  businessImpact: string;
  remediation: string;
  // How hard the fix itself is to implement — independent of severity (a
  // CRITICAL finding can still be a five-minute config change, and a LOW
  // one can require a real migration), so this is its own real signal, not
  // derived from severity.
  difficulty: FindingDifficulty;
  // How urgently to act, factoring in both severity and how easy the fix
  // is — distinct from `severity` itself, which only measures how bad the
  // issue is, not how soon it's practical to address it.
  priority: FindingPriority;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'AI analysis is not configured — set AI_API_KEY (and optionally AI_PROVIDER) to enable it.',
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

interface OpenAiCompatibleResponse {
  choices: { message: { content: string } }[];
}

type AiProvider = 'anthropic' | 'groq';
export type SupportedLocale = 'en' | 'he';

const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  he: 'Hebrew',
};

// Every prompt below asks for this verbatim, right after the language
// instruction — a small business owner with no security background is
// exactly who this product is for (see the landing page's own "no
// security background needed" claim), so "explain it like you would to a
// smart non-technical friend" is a real requirement, not a nicety.
function plainLanguageInstruction(locale: SupportedLocale): string {
  return (
    `Write your answer in ${LANGUAGE_NAMES[locale]}, in plain, non-technical language a ` +
    'small business owner with no security background can actually understand — avoid ' +
    'jargon, or briefly explain any technical term you have to use.'
  );
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-3-5-haiku-latest';

// Groq: free to start (no credit card — https://console.groq.com/keys), an
// OpenAI-compatible chat-completions endpoint in front of fast open models.
// Good enough for the short, structured completions this service asks for
// (a few labeled lines, or one summary paragraph), so it's offered as the
// zero-cost way to turn this feature on before paying for Anthropic.
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Generates human-readable explanation / business impact / remediation
 * text for a security finding, and executive summaries for a full scan, via
 * a real LLM API — Anthropic (paid) or Groq (free tier) depending on
 * AI_PROVIDER.
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
  private readonly provider: AiProvider;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('AI_API_KEY') || undefined;
    const configuredProvider = (
      this.configService.get<string>('AI_PROVIDER') || 'anthropic'
    ).toLowerCase();
    this.provider = configuredProvider === 'groq' ? 'groq' : 'anthropic';
    this.client = axios.create({ timeout: 30_000 });
    if (!this.apiKey) {
      this.logger.warn(
        'AI_API_KEY is not configured — AI finding analysis/executive summaries are disabled. ' +
          'Set AI_API_KEY (and AI_PROVIDER=groq for the free option) to enable them.',
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

    const isGroq = this.provider === 'groq';
    let response: { data: AnthropicMessageResponse | OpenAiCompatibleResponse };
    try {
      response = isGroq
        ? await this.client.post<OpenAiCompatibleResponse>(
            GROQ_API_URL,
            {
              model: GROQ_MODEL,
              max_tokens: maxTokens,
              messages: [{ role: 'user', content: prompt }],
            },
            {
              headers: {
                authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
              },
            },
          )
        : await this.client.post<AnthropicMessageResponse>(
            ANTHROPIC_API_URL,
            {
              model: ANTHROPIC_MODEL,
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
          `${isGroq ? 'Groq' : 'Anthropic'} API request failed: ${error.response.status} ${upstreamMessage}`,
        );
        throw new AiProviderError(error.response.status, upstreamMessage);
      }
      throw error;
    }

    const text = isGroq
      ? (response.data as OpenAiCompatibleResponse).choices?.[0]?.message
          ?.content
      : (response.data as AnthropicMessageResponse).content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Unexpected response shape from AI provider');
    }
    return text;
  }

  async analyzeFinding(
    finding: {
      title: string;
      description: string;
      severity: string;
      category: string;
    },
    locale: SupportedLocale = 'en',
  ): Promise<FindingAnalysis> {
    const prompt = [
      'You are a security analyst assistant. For the following security finding, respond with',
      'exactly five sections, each on its own line prefixed by the label shown, in plain text —',
      "no markdown, no headers (#), no bullet points, and put each label's content on the same",
      'line as its label, immediately after the colon:',
      'EXPLANATION: <plain-language explanation of the technical issue, 1-2 sentences>',
      'IMPACT: <concrete business impact if exploited, 1-2 sentences>',
      'REMEDIATION: <specific, actionable fix, 1-2 sentences>',
      'DIFFICULTY: <one word, exactly one of: Easy, Moderate, Hard — how hard the fix itself is to implement>',
      'PRIORITY: <one word, exactly one of: Low, Medium, High, Urgent — how urgently to act, factoring in both severity and how easy the fix is>',
      '',
      `${plainLanguageInstruction(locale)} The EXPLANATION/IMPACT/REMEDIATION content itself`,
      'should be in that language — but keep the DIFFICULTY and PRIORITY values themselves as',
      'exactly one of the English words listed above (Easy/Moderate/Hard,',
      'Low/Medium/High/Urgent), even when the rest of your answer is in another language, since',
      'those exact words are parsed by the application.',
      '',
      `Severity: ${finding.severity}`,
      `Category: ${finding.category}`,
      `Title: ${finding.title}`,
      `Description: ${finding.description}`,
    ].join('\n');

    const raw = await this.complete(prompt);
    return this.parseFindingAnalysis(raw);
  }

  // Models are asked to keep each label and its content on one line, but
  // not every model reliably follows that (observed for real: Groq's Llama
  // 3.3 sometimes emits the label as its own markdown heading — "##
  // EXPLANATION" — with the content on the following line instead). Rather
  // than trust one rigid same-line pattern, this pulls the labeled value
  // whether it's inline after the colon or on the next non-empty line, and
  // strips markdown heading markers before matching either way.
  private extractLabeledSection(
    raw: string,
    label: string,
  ): string | undefined {
    const lines = raw.split('\n').map((line) => line.replace(/^#+\s*/, ''));
    for (let i = 0; i < lines.length; i++) {
      const match = new RegExp(`^${label}:?\\s*(.*)$`, 'i').exec(
        lines[i].trim(),
      );
      if (!match) continue;
      const inline = match[1].trim();
      if (inline) return inline;
      const next = lines
        .slice(i + 1)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (next) return next;
    }
    return undefined;
  }

  private parseFindingAnalysis(raw: string): FindingAnalysis {
    const explanation =
      this.extractLabeledSection(raw, 'EXPLANATION') ?? raw.trim();
    const businessImpact = this.extractLabeledSection(raw, 'IMPACT') ?? '';
    const remediation = this.extractLabeledSection(raw, 'REMEDIATION') ?? '';
    const difficulty = this.parseDifficulty(
      this.extractLabeledSection(raw, 'DIFFICULTY')?.split(/\s+/)[0],
    );
    const priority = this.parsePriority(
      this.extractLabeledSection(raw, 'PRIORITY')?.split(/\s+/)[0],
    );
    return { explanation, businessImpact, remediation, difficulty, priority };
  }

  // The model is asked for exactly one of a small fixed set of words, but
  // its output is still free text, not a real enum — normalized here
  // rather than trusted verbatim, with a safe, honest middle-ground
  // default (never silently picked as "easy"/"low" in a way that could
  // make a real issue look less urgent than it is) if parsing fails.
  private parseDifficulty(word: string | undefined): FindingDifficulty {
    const normalized = word?.toUpperCase();
    if (
      normalized === 'EASY' ||
      normalized === 'MODERATE' ||
      normalized === 'HARD'
    ) {
      return normalized;
    }
    return 'MODERATE';
  }

  private parsePriority(word: string | undefined): FindingPriority {
    const normalized = word?.toUpperCase();
    if (
      normalized === 'LOW' ||
      normalized === 'MEDIUM' ||
      normalized === 'HIGH' ||
      normalized === 'URGENT'
    ) {
      return normalized;
    }
    return 'MEDIUM';
  }

  async generateExecutiveSummary(
    params: {
      domainName: string;
      score: number;
      findingCount: number;
      topFindings: { severity: string; title: string }[];
    },
    locale: SupportedLocale = 'en',
  ): Promise<string> {
    const prompt = [
      'You are a security analyst writing a one-paragraph executive summary (non-technical,',
      'for a business stakeholder) of a domain security scan. Be concise and specific.',
      plainLanguageInstruction(locale),
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
