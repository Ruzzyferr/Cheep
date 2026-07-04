import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateMany = vi.fn();
const create = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const $transaction = vi.fn(async (fn: any) => fn({
  list: { updateMany, create, update, findFirst },
  listItem: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    list: {
      findMany: (...a: any[]) => findMany(...a),
      findFirst: (...a: any[]) => findFirst(...a),
      updateMany: (...a: any[]) => updateMany(...a),
      create: (...a: any[]) => create(...a),
      update: (...a: any[]) => update(...a),
    },
    listItem: {},
    $transaction: (...a: any[]) => $transaction(...a),
  },
}));

import { createList, activateList, cloneList } from '../src/api/lists/lists.service.js';

beforeEach(() => { updateMany.mockReset(); create.mockReset(); findFirst.mockReset(); update.mockReset(); $transaction.mockClear(); });

describe('createList', () => {
  it('yeni listeyi aktif yapar ve diğerlerini pasife çeker', async () => {
    create.mockResolvedValue({ id: 5, status: 'active' });
    await createList(1, { name: 'Test' } as any);
    // diğerleri inactive
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 1, status: 'active' },
      data: { status: 'inactive' },
    }));
    // yeni liste active
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 1, status: 'active' }),
    }));
  });
});

describe('activateList', () => {
  it('sahip listeyi aktif yapar, diğerlerini pasife', async () => {
    findFirst.mockResolvedValue({ id: 9, user_id: 1 });
    update.mockResolvedValue({ id: 9, status: 'active' });
    const res = await activateList(9, 1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 1, status: 'active' }, data: { status: 'inactive' },
    }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 }, data: { status: 'active' },
    }));
    expect(res).toBeTruthy();
  });
  it('sahip değilse null döner', async () => {
    findFirst.mockResolvedValue(null);
    const res = await activateList(9, 2);
    expect(res).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('cloneList', () => {
  it('kalemleri brand_independent ile kopyalar, klon pasif', async () => {
    findFirst.mockResolvedValue({
      id: 3, user_id: 1, name: 'Haftalık', budget: null,
      list_items: [{ product_id: 10, quantity: 2, unit: 'adet', brand_independent: true }],
    });
    const created = { id: 99 };
    const txCreate = vi.fn().mockResolvedValue(created);
    const txCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    $transaction.mockImplementationOnce(async (fn: any) =>
      fn({ list: { create: txCreate }, listItem: { createMany: txCreateMany } }));
    const res = await cloneList(3, 1);
    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 1, name: 'Haftalık (Kopya)', status: 'inactive' }),
    }));
    expect(txCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ list_id: 99, product_id: 10, quantity: 2, unit: 'adet', brand_independent: true })],
    }));
    expect(res).toBeTruthy();
  });
});
