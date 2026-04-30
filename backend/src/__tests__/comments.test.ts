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

// Shape returned by the join query in the comments route
const commentDbRow = {
  id: 10,
  body: 'Looks good!',
  authorId: 1,
  authorName: 'Alice',
  createdAt: 1714000000,
};

const commentResponse = {
  id: 10,
  body: 'Looks good!',
  author: { id: 1, name: 'Alice' },
  created_at: 1714000000,
};

beforeEach(() => { vi.clearAllMocks(); });

// ─── GET /tickets/:id/comments ─────────────────────────────────────────────────

describe('GET /tickets/:id/comments', () => {

  it('Happy Path: ticket exists → 200 with comments ordered by created_at', async () => {
    // Given — ticket found; one comment returned
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([{ id: 42 }]))     // ticket existence check
      .mockReturnValueOnce(makeChain([commentDbRow]));  // comments join query

    // When
    const res = await request(app)
      .get('/tickets/42/comments')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toEqual([commentResponse]);
  });

  it('Validation Error: no Authorization header → 401', async () => {
    // Given — unauthenticated request
    // When
    const res = await request(app).get('/tickets/42/comments');

    // Then
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('Edge Case: ticket does not exist → 404', async () => {
    // Given — ticket lookup returns empty
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .get('/tickets/999/comments')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
  });

});

// ─── POST /tickets/:id/comments ────────────────────────────────────────────────

describe('POST /tickets/:id/comments', () => {

  it('Happy Path: valid body → 201 with comment object', async () => {
    // Given — ticket exists; insert returns new id; select fetches full row
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([{ id: 42 }]))     // ticket existence check
      .mockReturnValueOnce(makeChain([commentDbRow]));  // fetch inserted comment
    vi.mocked(db.insert).mockReturnValueOnce(makeChain([{ id: 10 }]));

    // When
    const res = await request(app)
      .post('/tickets/42/comments')
      .set('Authorization', authHeader)
      .send({ body: 'Looks good!' });

    // Then
    expect(res.status).toBe(201);
    expect(res.body).toEqual(commentResponse);
  });

  it('Validation Error: empty body string → 400 "Body is required"', async () => {
    // Given — ticket exists but body is empty (z.string().min(1) fails)
    vi.mocked(db.select).mockReturnValueOnce(makeChain([{ id: 42 }]));

    // When
    const res = await request(app)
      .post('/tickets/42/comments')
      .set('Authorization', authHeader)
      .send({ body: '' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Body is required' });
  });

  it('Edge Case: ticket does not exist → 404', async () => {
    // Given — ticket lookup returns empty (no ticket)
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .post('/tickets/999/comments')
      .set('Authorization', authHeader)
      .send({ body: 'Orphaned comment' });

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
  });

});
