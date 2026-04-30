import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { db } from '../db/client';
import { makeChain, makeRejectedChain } from './helpers/mockDb';

vi.mock('../db/client', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const userToken  = jwt.sign({ id: 1, email: 'u@test.com', role: 'user'  }, 'test-secret');
const adminToken = jwt.sign({ id: 2, email: 'a@test.com', role: 'admin' }, 'test-secret');
const authHeader = `Bearer ${userToken}`;
const adminHeader = `Bearer ${adminToken}`;

// Base fixture that matches TICKET_SELECT shape (DB row before shaping)
const ticketRow = {
  id: 42,
  title: 'Fix the bug',
  description: null,
  status: 'to_do',
  priority: 'medium',
  assigneeId: null,
  assigneeName: null,
  createdById: 1,
  createdByName: 'Alice',
  projectId: null,
  version: 1,
  isArchived: false,
  archivedAt: null,
  createdAt: 1714000000,
  updatedAt: 1714000000,
};

// Expected API response shape after shapeTicket()
const ticketResponse = {
  id: 42,
  title: 'Fix the bug',
  description: null,
  status: 'to_do',
  priority: 'medium',
  assignee: null,
  created_by: { id: 1, name: 'Alice' },
  project_id: null,
  labels: [],
  version: 1,
  is_archived: false,
  archived_at: null,
  created_at: 1714000000,
  updated_at: 1714000000,
};

beforeEach(() => { vi.clearAllMocks(); });

// ─── GET /tickets ──────────────────────────────────────────────────────────────

describe('GET /tickets', () => {

  it('Happy Path: authenticated request → 200 with ticket array', async () => {
    // Given — two parallel selects: ticket rows + label rows
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([ticketRow]))  // TICKET_SELECT query
      .mockReturnValueOnce(makeChain([]));           // ticketLabels join query

    // When
    const res = await request(app)
      .get('/tickets')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject(ticketResponse);
  });

  it('Validation Error: invalid status query param → 400', async () => {
    // Given — no db call expected (Zod rejects first)
    // When
    const res = await request(app)
      .get('/tickets?status=invalid_status')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Edge Case: non-admin sends is_archived=true → 403', async () => {
    // Given — user role cannot read archived tickets
    // When
    const res = await request(app)
      .get('/tickets?is_archived=true')
      .set('Authorization', authHeader);  // user token, not admin

    // Then
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Insufficient role' });
  });

});

// ─── POST /tickets ─────────────────────────────────────────────────────────────

describe('POST /tickets', () => {

  it('Happy Path (US-02): valid title + defaults → 201 with complete ticket', async () => {
    // Given — insert returns new id; two parallel selects fetch the full ticket
    vi.mocked(db.insert).mockReturnValueOnce(makeChain([{ id: 42 }]));
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([ticketRow]))  // TICKET_SELECT
      .mockReturnValueOnce(makeChain([]));           // labels

    // When
    const res = await request(app)
      .post('/tickets')
      .set('Authorization', authHeader)
      .send({ title: 'Fix the bug' });

    // Then
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Fix the bug',
      status: 'to_do',
      priority: 'medium',
      version: 1,
      is_archived: false,
    });
  });

  it('Validation Error (US-02): title exceeds 120 characters → 400', async () => {
    // Given — title is 121 chars (one over the limit)
    const longTitle = 'A'.repeat(121);

    // When
    const res = await request(app)
      .post('/tickets')
      .set('Authorization', authHeader)
      .send({ title: longTitle });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Title must be 120 characters or fewer' });
  });

  it('Edge Case (US-02): empty title string → 400 "Title is required"', async () => {
    // Given — empty string hits z.string().min(1, 'Title is required')
    // When
    const res = await request(app)
      .post('/tickets')
      .set('Authorization', authHeader)
      .send({ title: '' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Title is required' });
  });

});

// ─── GET /tickets/:id ──────────────────────────────────────────────────────────

describe('GET /tickets/:id', () => {

  it('Happy Path: existing ticket → 200 with shaped ticket object', async () => {
    // Given — ticket found + labels
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([ticketRow]))
      .mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .get('/tickets/42')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(ticketResponse);
  });

  it('Validation Error: non-integer id → 404', async () => {
    // Given — route parses id as Number('abc') = NaN, fails isInteger check
    // When
    const res = await request(app)
      .get('/tickets/abc')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
  });

  it('Edge Case: id not in DB → 404', async () => {
    // Given — both queries return empty arrays (ticket does not exist)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([]))  // TICKET_SELECT
      .mockReturnValueOnce(makeChain([])); // labels

    // When
    const res = await request(app)
      .get('/tickets/999')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
  });

});

// ─── PATCH /tickets/:id ────────────────────────────────────────────────────────

describe('PATCH /tickets/:id', () => {

  it('Happy Path (US-03): correct version → 200 with version incremented by 1', async () => {
    // Given — current ticket at version 1, request sends version 1 (match)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([ticketRow]))                              // fetch current
      .mockReturnValueOnce(makeChain([{ ...ticketRow, version: 2, title: 'Updated' }])) // fetch after update
      .mockReturnValueOnce(makeChain([]));                                      // labels after update
    vi.mocked(db.update).mockReturnValue(makeChain([]));

    // When
    const res = await request(app)
      .patch('/tickets/42')
      .set('Authorization', authHeader)
      .send({ version: 1, title: 'Updated' });

    // Then
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.title).toBe('Updated');
  });

  it('Validation Error: missing version field → 400', async () => {
    // Given — body has no version (required by ticketPatchSchema)
    // When
    const res = await request(app)
      .patch('/tickets/42')
      .set('Authorization', authHeader)
      .send({ title: 'No version provided' });

    // Then
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Edge Case (US-03): version mismatch → 409 conflict with last updater info', async () => {
    // Given — DB has version 4; admin sends stale version 3
    // Admin token bypasses the creator-only guard so we reach the version check
    vi.mocked(db.select).mockReturnValueOnce(makeChain([{
      ...ticketRow,
      version: 4,
      createdById: 99,
      createdByName: 'User B',
    }]));

    // When
    const res = await request(app)
      .patch('/tickets/42')
      .set('Authorization', adminHeader)
      .send({ version: 3, title: 'Stale edit' });

    // Then
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: 'conflict',
      updatedById: 99,
      updatedByName: 'User B',
    });
  });

});

// ─── PATCH /tickets/:id/archive ────────────────────────────────────────────────

describe('PATCH /tickets/:id/archive', () => {

  it("Happy Path: user archives own ticket → 200 with is_archived: true", async () => {
    // Given — ticket exists, not archived, owned by user (id:1)
    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([{ ...ticketRow, isArchived: false }]))     // fetch current
      .mockReturnValueOnce(makeChain([{ ...ticketRow, isArchived: true, archivedAt: 1714001000 }])) // fetch after update
      .mockReturnValueOnce(makeChain([]));                                        // labels after update
    vi.mocked(db.update).mockReturnValue(makeChain([]));

    // When
    const res = await request(app)
      .patch('/tickets/42/archive')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.is_archived).toBe(true);
  });

  it('Validation Error: ticket not found → 404', async () => {
    // Given — DB returns empty for the ticket lookup
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]));

    // When
    const res = await request(app)
      .patch('/tickets/999/archive')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
  });

  it('Edge Case: ticket already archived → 409', async () => {
    // Given — ticket is already archived
    vi.mocked(db.select).mockReturnValueOnce(makeChain([{
      ...ticketRow,
      isArchived: true,
      archivedAt: 1714000500,
    }]));

    // When
    const res = await request(app)
      .patch('/tickets/42/archive')
      .set('Authorization', authHeader);

    // Then
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Already archived' });
  });

});
