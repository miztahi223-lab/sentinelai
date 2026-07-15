import { IsIn, IsOptional } from 'class-validator';
import type { SupportedLocale } from '../ai.service';

const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'he'];

/**
 * The reader's UI language, sent by the frontend so the AI response comes
 * back in the language the person actually asked in — not a separate
 * translation step afterward. Optional and defaults to English server-side
 * (see `AiService`) so older/other API clients that don't send this still
 * get a sensible result rather than a validation error.
 */
export class AnalyzeLocaleDto {
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}
