import { ConfigService } from '@nestjs/config';
import { AiNotConfiguredError, AiService } from './ai.service';

/**
 * Real unit tests for the parts of `AiService` that don't require an
 * actual Anthropic API key (none exists in this build environment — see
 * the class-level comment on `AiService`): the honest "not configured"
 * failure path, and the response-parsing logic, exercised directly against
 * sample model output rather than a live network call.
 */
function makeService(apiKey?: string) {
  const configService = {
    get: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService;
  return new AiService(configService);
}

describe('AiService', () => {
  it('reports not configured when no AI_API_KEY is set', () => {
    const service = makeService(undefined);
    expect(service.isConfigured()).toBe(false);
  });

  it('reports configured once an AI_API_KEY is set', () => {
    const service = makeService('sk-ant-fake-key');
    expect(service.isConfigured()).toBe(true);
  });

  it('throws AiNotConfiguredError from analyzeFinding without a key', async () => {
    const service = makeService(undefined);
    await expect(
      service.analyzeFinding({
        title: 'Test finding',
        description: 'Test description',
        severity: 'HIGH',
        category: 'SSL',
      }),
    ).rejects.toThrow(AiNotConfiguredError);
  });

  it('throws AiNotConfiguredError from generateExecutiveSummary without a key', async () => {
    const service = makeService(undefined);
    await expect(
      service.generateExecutiveSummary({
        domainName: 'example.com',
        score: 80,
        findingCount: 1,
        topFindings: [{ severity: 'HIGH', title: 'Test finding' }],
      }),
    ).rejects.toThrow(AiNotConfiguredError);
  });

  describe('parseFindingAnalysis', () => {
    // Private method — legitimately reached via a cast rather than made
    // public, since it's only ever called internally by `analyzeFinding`.
    function parse(raw: string) {
      const service = makeService('sk-ant-fake-key');
      return (
        service as unknown as { parseFindingAnalysis: (raw: string) => unknown }
      ).parseFindingAnalysis(raw);
    }

    it('parses a well-formed response into all five fields', () => {
      const raw = [
        'EXPLANATION: Your certificate is missing.',
        'IMPACT: Visitors see a security warning.',
        'REMEDIATION: Install a valid certificate.',
        'DIFFICULTY: Easy',
        'PRIORITY: High',
      ].join('\n');

      expect(parse(raw)).toEqual({
        explanation: 'Your certificate is missing.',
        businessImpact: 'Visitors see a security warning.',
        remediation: 'Install a valid certificate.',
        difficulty: 'EASY',
        priority: 'HIGH',
      });
    });

    it('is case-insensitive on the difficulty/priority labels', () => {
      const raw = [
        'EXPLANATION: x',
        'IMPACT: y',
        'REMEDIATION: z',
        'DIFFICULTY: hard',
        'PRIORITY: urgent',
      ].join('\n');

      const result = parse(raw) as { difficulty: string; priority: string };
      expect(result.difficulty).toBe('HARD');
      expect(result.priority).toBe('URGENT');
    });

    it('falls back to a safe middle value when the model omits difficulty/priority', () => {
      const raw = ['EXPLANATION: x', 'IMPACT: y', 'REMEDIATION: z'].join('\n');

      const result = parse(raw) as { difficulty: string; priority: string };
      expect(result.difficulty).toBe('MODERATE');
      expect(result.priority).toBe('MEDIUM');
    });

    it('falls back to a safe middle value when the model returns an unrecognized word', () => {
      const raw = [
        'EXPLANATION: x',
        'IMPACT: y',
        'REMEDIATION: z',
        'DIFFICULTY: Somewhat tricky',
        'PRIORITY: Whenever',
      ].join('\n');

      const result = parse(raw) as { difficulty: string; priority: string };
      expect(result.difficulty).toBe('MODERATE');
      expect(result.priority).toBe('MEDIUM');
    });
  });
});
