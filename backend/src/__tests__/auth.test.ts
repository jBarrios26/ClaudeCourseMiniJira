import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../db/client';
import { makeChain } from './helpers/mockDb';

vi.mock('../db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

import bcrypt from 'bcryptjs';

const userRow = {
  id: 1,
  name: 'Alice',
  email: 'alice@test.com',
  passwordHash: '$2b$10$hashed',
  role: 'user' as const,
  createdAt: 1714000000,
};

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.clearAllMocks(); });

// ─── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {

  it('Happy Path: valid credentials → 200 with token and user object', async () => {
    // Given — user exists in DB and password matches
    vi.mocked(db.select).mockReturnValueOnce(makeChain([userRow]));
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    // When
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@test.com', password: 'secret' });

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      id: 1,
      name: 'Alice',
      email: 'alice@test.com',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('Validation Error: missing email field → 400', async () => {
    // Given — request body has no email
    // When
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'secret' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Edge Case (US-01): wrong password → 401 "Invalid credentials"', async () => {
    // Given — user exists but bcrypt.compare returns false
    vi.mocked(db.select).mockReturnValueOnce(makeChain([userRow]));
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    // When
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'alice@test.com', password: 'wrong' });

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

});
