# ADR-001 — Use PostgreSQL over MongoDB as the Primary Database

**Status:** Accepted  
**Date:** 2026-04-20  
**Deciders:** Marcos (Tech Lead), Laura (PO), Roberto (PM)

---

## Context

Mini Jira is an internal ticket-management tool for a 10-person team. The data model centers on **tickets** — structured entities with a fixed set of fields (title, status, priority, assignee, labels, timestamps) and well-defined relationships to users and comments.

Several constraints shaped this decision:

- **Optimistic locking is a hard requirement.** Every ticket update must carry a `version` integer. On conflict, the server must return HTTP 409. This demands atomic compare-and-update semantics at the row level.
- **Referential integrity matters.** Tickets reference users (creator, assignee). When a user is removed, all their tickets must become *Unassigned* without data loss — a cascade-style rule that is native to relational databases.
- **Soft deletes with audit trail.** Archived tickets are never physically deleted. Comments and full ticket history must be preserved indefinitely. This benefits from strong schema guarantees.
- **Dashboard metrics require aggregations.** Monthly closed-ticket counts, status breakdowns, and top-assignee rankings are served directly from the database. SQL aggregations (GROUP BY, COUNT, DATE_TRUNC) are well-suited for this.
- **CSV export.** Metrics are exported server-side. Generating structured reports from a relational schema is straightforward with SQL queries.
- **Team scale is known and small.** The user base is fixed at ~10 people, so document-store horizontal scaling offers no advantage at this stage.

---

## Options Considered

### Option A — PostgreSQL 16 (chosen)

A mature, open-source relational database with strong ACID guarantees, row-level locking, and a rich SQL feature set.

### Option B — MongoDB (Atlas or self-hosted)

A document-oriented NoSQL database that stores data as BSON documents, offering flexible schemas and horizontal scaling.

---

## Comparison

| Criterion | PostgreSQL | MongoDB |
|---|---|---|
| ACID transactions | Native, row-level | Multi-document transactions added in v4.0 — more complex to configure |
| Optimistic locking (`version` field + atomic update) | `UPDATE … WHERE id = :id AND version = :v` — single atomic statement | Requires `findOneAndUpdate` with `$inc` + manual version check — achievable but more error-prone |
| Referential integrity (user → ticket FK) | Enforced by foreign keys + `ON DELETE SET NULL` | Application-level only — no native FK enforcement |
| Schema enforcement | Strong — Prisma migrations produce a versioned, auditable schema | Flexible by design — schema drift is possible without extra tooling |
| Aggregation for dashboard metrics | SQL `GROUP BY`, `DATE_TRUNC`, `COUNT` — concise and well-understood | Aggregation pipeline — powerful but verbose for simple reporting queries |
| Soft delete + audit history | Standard pattern with a nullable `archived_at` column | Equally viable with a flag field |
| ORM support (Prisma) | First-class support, mature migration tooling | Prisma supports MongoDB but with a reduced feature set (no raw SQL, limited relation support) |
| Horizontal scaling | Vertical scaling + read replicas sufficient for 10 users | Sharding available but unnecessary at this scale |
| Operational complexity | Single instance sufficient for MVP | Atlas managed service reduces ops burden, but adds an external dependency |
| Team familiarity | SQL is universally known | Requires learning aggregation pipeline and document modeling |

---

## Decision

**PostgreSQL 16** is selected as the primary database, accessed via **Prisma ORM**.

The optimistic locking requirement is the decisive factor. Implementing `WHERE id = :id AND version = :N` as a single atomic `UPDATE` in PostgreSQL is the simplest and most reliable approach. MongoDB can achieve the same result, but it requires application-level orchestration that introduces more surface area for bugs in a correctness-critical feature.

Beyond locking, PostgreSQL's foreign key constraints, Prisma migration tooling, and native SQL aggregations align directly with the data integrity, audit, and reporting requirements described in the spec — without requiring any workarounds.

---

## Consequences

### Positive

- Optimistic locking is implemented with a single atomic SQL statement — no risk of a time-of-check/time-of-use race.
- Foreign key `ON DELETE SET NULL` on `assignee_id` and `created_by` automatically handles the "user removed → tickets become Unassigned" rule from §2.4.
- Prisma migrations produce a versioned, reviewable schema history that doubles as part of the audit trail.
- Dashboard queries (monthly closed tickets, status breakdown, top assignees) map directly to SQL aggregations — no ORM workarounds needed.
- The entire team can read and reason about the schema and queries without NoSQL-specific knowledge.

### Negative

- PostgreSQL requires a running server (local or hosted). MongoDB Atlas offers a generous free tier that lowers the ops barrier for early development.
- Schema changes require explicit Prisma migrations. MongoDB's flexible schema can be faster to iterate on during early prototyping.
- If future requirements demand storing large, highly variable document structures (e.g., rich activity feeds, deeply nested metadata), a relational schema may require more design work.

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hosting environment is TBD (Open Issue #4) | PostgreSQL is available on all major cloud providers (RDS, Cloud SQL, Supabase, Railway) — decision is not blocked |
| Schema migrations in production | Prisma's `migrate deploy` command is safe for CI/CD pipelines; all migrations are reviewed before merge |
| Single point of failure for MVP | Acceptable for a 10-person internal tool; read replicas or managed HA can be added in v2 if uptime requirements increase |
