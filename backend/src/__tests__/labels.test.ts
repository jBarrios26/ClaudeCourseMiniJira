import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { db } from '../db/client';
import { makeChain, makeRejectedChain } from './helpers/mockDb';

vi.mock('../db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const userToken = jwt.sign({ id: 1, email: 'u@test.com', role: 'user' }, 'test-secret');
const authHeader = `Bearer ${userToken}`;

const labelRow = { id: 1, name: 'frontend' };

beforeEach(() => { vi.clearAllMocks(); });

// ─── GET /labels ───────────────────────────────────────────────────────────────

describe('GET /labels', () => {

  it('Happy Path: authenticated request → 200 with label array', async () => {
    // Given — DB returns one label
    vi.mocked(db.select).mockReturnValueOnce(makeChain([labelRow]));

    // When
    const res = await request(app)
      .get('/labels')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, name: 'frontend' }]);
  });

  it('Validation Error: no Authorization header → 401', async () => {
    // Given — no token
    // When
    const res = await request(app).get('/labels');

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('Edge Case: empty labels table → 200 with empty array', async () => {
    // Given — DB returns nothing
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .get('/labels')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

});

// ─── POST /labels ──────────────────────────────────────────────────────────────

describe('POST /labels', () => {

  it('Happy Path: new label → 201 with id and name', async () => {
    // Given — insert succeeds
    vi.mocked(db.insert).mockReturnValueOnce(makeChain([labelRow]));

    // When
    const res = await request(app)
      .post('/labels')
      .set('Authorization', authHeader)
      .send({ name: 'frontend' });

    // Then
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 1, name: 'frontend' });
  });

  it('Validation Error: empty name → 400', async () => {
    // Given — empty string fails z.string().min(1)
    // When
    const res = await request(app)
      .post('/labels')
      .set('Authorization', authHeader)
      .send({ name: '' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Edge Case: duplicate label name → 409', async () => {
    // Given — insert throws unique constraint error
    const uniqueErr = Object.assign(new Error('UNIQUE constraint failed'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    vi.mocked(db.insert).mockReturnValueOnce(makeRejectedChain(uniqueErr));

    // When
    const res = await request(app)
      .post('/labels')
      .set('Authorization', authHeader)
      .send({ name: 'frontend' });

    // Then
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Label name already exists' });
  });

});

// ─── DELETE /labels/:id ────────────────────────────────────────────────────────

describe('DELETE /labels/:id', () => {

  it('Happy Path: existing label → 204 no body', async () => {
    // Given — label found; delete succeeds
    vi.mocked(db.select).mockReturnValueOnce(makeChain([labelRow]));
    vi.mocked(db.delete).mockReturnValue(makeChain([]));

    // When
    const res = await request(app)
      .delete('/labels/1')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(204);
  });

  it('Validation Error: label not found → 404', async () => {
    // Given — DB returns empty (label does not exist)
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .delete('/labels/999')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Label not found' });
  });

  it('Edge Case: no Authorization header → 401', async () => {
    // Given — unauthenticated request
    // When
    const res = await request(app).delete('/labels/1');

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

});
