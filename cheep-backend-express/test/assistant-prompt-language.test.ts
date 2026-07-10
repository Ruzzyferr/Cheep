import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../src/api/assistant/assistant.service.js';

describe('assistant prompt language', () => {
  it('defaults to Turkish', () => {
    expect(buildSystemPrompt(null)).toContain('Turkish');
  });
  it('Polish user gets Polish directive and currency', () => {
    const p = buildSystemPrompt({ weekly_budget: 200 }, 'PLN', 'pl');
    expect(p).toContain('Polish');
    expect(p).toContain('200 PLN');
  });
  it('unknown language falls back to Turkish', () => {
    expect(buildSystemPrompt(null, 'TRY', 'xx')).toContain('Turkish');
  });
});
