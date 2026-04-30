import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { db } from '../db/client';
import { makeChain } from './helpers/mockDb';

vi.mock('../db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const userToken = jwt.sign({ id: 1, email: 'u@test.com', role: 'user' }, 'test-secret');
const authHeader = `Bearer ${userToken}`;

beforeEach(() => { vi.clearAllMocks(); });

// ─── GET /dashboard ────────────────────────────────────────────────────────────

describe('GET /dashboard', () => {

  it('Happy Path: authenticated → 200 with correct structure and computed values', async () => {
    // Given — Promise.all fires 3 parallel selects in order:
    //   1. tickets_by_status  2. closed_per_month  3. top_assignees
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([
        { status: 'to_do',       total: 4 },
        { status: 'in_progress', total: 3 },
        { status: 'in_review',   total: 1 },
        { status: 'done',        total: 12 },
      ]))
      .mockReturnValueOnce(makeChain([
        { month: '2025-04', total: 5 },
        { month: '2025-05', total: 7 },
      ]))
      .mockReturnValueOnce(makeChain([
        { id: 2, name: 'Bob', closed_this_month: 5 },
      ]));

    // When
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.tickets_by_status).toEqual({
      to_do: 4,
      in_progress: 3,
      in_review: 1,
      done: 12,
    });
    expect(res.body.closed_per_month).toEqual([
      { month: '2025-04', count: 5 },
      { month: '2025-05', count: 7 },
    ]);
    expect(res.body.top_assignees).toEqual([
      { id: 2, name: 'Bob', closed_this_month: 5 },
    ]);
  });

  it('Validation Error: no Authorization header → 401', async () => {
    // Given — unauthenticated request
    // When
    const res = await request(app).get('/dashboard');

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('Edge Case: all counts are zero (empty DB) → 200 with valid zero-value structure', async () => {
    // Given — all three queries return empty arrays
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([]))  // tickets_by_status: no rows
      .mockReturnValueOnce(makeChain([]))  // closed_per_month: no rows
      .mockReturnValueOnce(makeChain([])); // top_assignees: no rows

    // When
    const res = await request(app)
      .get('/dashboard')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      tickets_by_status: { to_do: 0, in_progress: 0, in_review: 0, done: 0 },
      closed_per_month:  [],
      top_assignees:     [],
    });
  });

});
