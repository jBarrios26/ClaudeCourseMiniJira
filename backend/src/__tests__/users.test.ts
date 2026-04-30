import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { db } from '../db/client';
import { makeChain, makeRejectedChain } from './helpers/mockDb';

vi.mock('../db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

import bcrypt from 'bcryptjs';

const userToken  = jwt.sign({ id: 1, email: 'u@test.com', role: 'user'  }, 'test-secret');
const adminToken = jwt.sign({ id: 2, email: 'a@test.com', role: 'admin' }, 'test-secret');

const userRow = {
  id: 1,
  name: 'Alice',
  email: 'alice@test.com',
  passwordHash: '$2b$10$hashed',
  role: 'user' as const,
  createdAt: 1714000000,
};

beforeEach(() => { vi.clearAllMocks(); });

// ─── GET /users ────────────────────────────────────────────────────────────────

describe('GET /users', () => {

  it('Happy Path: authenticated request → 200 with user array', async () => {
    // Given — DB returns one user row
    vi.mocked(db.select).mockReturnValueOnce(makeChain([userRow]));

    // When
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`);

    // Then
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      id: 1,
      name: 'Alice',
      email: 'alice@test.com',
      role: 'user',
      created_at: 1714000000,
    });
  });

  it('Validation Error: no Authorization header → 401', async () => {
    // Given — no token provided
    // When
    const res = await request(app).get('/users');

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('Edge Case: malformed / invalid token → 401', async () => {
    // Given — token signed with wrong secret
    const badToken = jwt.sign({ id: 1, role: 'user' }, 'wrong-secret');

    // When
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${badToken}`);

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

});

// ─── POST /users ───────────────────────────────────────────────────────────────

describe('POST /users', () => {

  it('Happy Path: admin creates a new user → 201 with user (no passwordHash)', async () => {
    // Given — admin token; bcrypt.hash returns a fake hash; insert returns user row
    vi.mocked(bcrypt.hash).mockResolvedValueOnce('$2b$10$hashed' as never);
    vi.mocked(db.insert).mockReturnValueOnce(makeChain([userRow]));

    // When
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', email: 'alice@test.com', password: 'secret' });

    // Then
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, name: 'Alice', email: 'alice@test.com', role: 'user' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('Validation Error: missing required name field → 400', async () => {
    // Given — body has no name
    // When
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'alice@test.com', password: 'secret' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Edge Case: duplicate email → 409', async () => {
    // Given — bcrypt.hash succeeds; insert throws SQLite unique constraint error
    vi.mocked(bcrypt.hash).mockResolvedValueOnce('$2b$10$hashed' as never);
    const uniqueErr = Object.assign(new Error('UNIQUE constraint failed'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    vi.mocked(db.insert).mockReturnValueOnce(makeRejectedChain(uniqueErr));

    // When
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Alice', email: 'alice@test.com', password: 'secret' });

    // Then
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already exists' });
  });

});
