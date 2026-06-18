import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/api/lists/lists.service.js', () => ({
  getUserLists: vi.fn(async (uid: number) => [{ id: 1, name: 'Test', user_id: uid }]),
}));

import { buildToolExecutor, toolDeclarations } from '../src/api/assistant/assistant.tools';

describe('assistant tools', () => {
  it('toolDeclarations boş değil ve isimleri benzersiz', () => {
    const names = toolDeclarations.map((t: any) => t.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
  it('bilinmeyen araç hata döndürür (throw etmez)', async () => {
    const exec = buildToolExecutor(42);
    const res = await exec('nope', {});
    expect(res.error).toBeTruthy();
  });
  it('get_user_lists kullanıcıya scope\'lu çağrılır', async () => {
    const exec = buildToolExecutor(42);
    const res = await exec('get_user_lists', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].user_id).toBe(42);
  });
});
