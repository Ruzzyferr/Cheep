import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const del = vi.fn();
const compare = vi.fn();

vi.mock('../src/utils/prisma.client.js', () => ({
  prisma: {
    user: {
      findUnique: (...a: any[]) => findUnique(...a),
      delete: (...a: any[]) => del(...a),
    },
  },
}));
vi.mock('bcryptjs', () => ({
  default: { compare: (...a: any[]) => compare(...a) },
}));

import { deleteUser, deleteAccountByCredentials } from '../src/api/users/users.service.js';

beforeEach(() => {
  findUnique.mockReset();
  del.mockReset();
  compare.mockReset();
});

describe('deleteUser (authenticated in-app path)', () => {
  it('deletes the user by id — cascade handles all related rows', async () => {
    del.mockResolvedValueOnce({ id: 7 });
    await deleteUser(7);
    expect(del).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});

describe('deleteAccountByCredentials (public web-form path)', () => {
  it('deletes when email + password are valid', async () => {
    findUnique.mockResolvedValueOnce({ id: 7, email: 'a@b.com', password_hash: 'hash' });
    compare.mockResolvedValueOnce(true);
    del.mockResolvedValueOnce({ id: 7 });

    await deleteAccountByCredentials('a@b.com', 'pw');

    expect(compare).toHaveBeenCalledWith('pw', 'hash');
    expect(del).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('throws 401 on unknown email and never deletes', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(deleteAccountByCredentials('x@y.com', 'pw')).rejects.toMatchObject({ statusCode: 401 });
    expect(del).not.toHaveBeenCalled();
  });

  it('throws 401 on wrong password and never deletes', async () => {
    findUnique.mockResolvedValueOnce({ id: 7, email: 'a@b.com', password_hash: 'hash' });
    compare.mockResolvedValueOnce(false);
    await expect(deleteAccountByCredentials('a@b.com', 'bad')).rejects.toMatchObject({ statusCode: 401 });
    expect(del).not.toHaveBeenCalled();
  });
});
