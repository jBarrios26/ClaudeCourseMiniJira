# Product Requirements Document — Mini Jira
**Version:** 1.0  
**Date:** 2026-04-20  
**Stakeholders:** Laura (PO), Marcos (Tech Lead), Sofia (Dev Junior), Roberto (PM)  
**Target delivery:** 3 weeks from kickoff

---

## 1. Overview

An internal ticket-management tool for a 10-person team. Replaces ad-hoc task tracking with a lightweight system covering the full lifecycle of a work item — from creation to completion — without the overhead of enterprise tools.

---

## 2. In-Scope (v1)

### 2.1 Authentication & Roles

Two roles exist. All access requires a session (no public routes).

| Capability | User | Admin |
|---|---|---|
| Create tickets | Yes | Yes |
| Edit own tickets | Yes | Yes |
| Edit others' tickets | No | Yes |
| Archive own tickets | Yes | Yes |
| Archive others' tickets | No | Yes |
| View archived tickets | No | Yes |
| Restore archived tickets | No | Yes |
| Assign / reassign tickets | Yes (any member) | Yes |
| View all active tickets | Yes | Yes |
| Manage members | No | Yes |

### 2.2 Ticket Fields

| Field | Type | Required |
|---|---|---|
| Title | Short text (max 120 chars) | Yes |
| Description | Rich text (markdown) | No |
| Status | Enum (see 2.3) | Yes — defaults to "To Do" |
| Priority | Enum: Low / Medium / High | Yes — defaults to Medium |
| Assignee | User reference | No |
| Labels | Free tags (multi-select) | No |
| Created by | Auto (current user) | — |
| Created at | Auto (timestamp) | — |
| Updated at | Auto (timestamp) | — |

### 2.3 Ticket Status Flow

Four states (compromise between Laura's 3 and Marcos's 5):

```
To Do → In Progress → In Review → Done
```

- Any state can transition to any other state (no enforced linear flow).
- "Blocked" is handled via Priority: High + a "blocked" label convention, keeping the board to four columns.

### 2.4 Ticket Lifecycle & Data Integrity

- **Archive is not Delete.** The UI button reads "Archive". Archived tickets are soft-deleted — hidden from the active board but retained in the database.
- Only admins can view archived tickets via a dedicated "Archived" filter view.
- Only admins can restore an archived ticket back to active.
- **Archived does not mean Closed.** A ticket must reach **Done** status to count as "closed" in dashboard metrics. Archiving alone has no effect on metrics.
- If a team member leaves and is removed from the system, all tickets they owned or were assigned to become **Unassigned** — they are not deleted or reassigned automatically.
- Comments and full ticket history are preserved indefinitely for audit purposes.

### 2.5 Concurrency

Optimistic locking is applied to all ticket updates:

- The server stores a `version` integer on every ticket row, incremented on each update.
- On save, the client sends the version it last read.
- If the server version has advanced (another user saved first), the API returns HTTP 409.
- The UI shows a non-dismissible conflict warning: *"This ticket was updated by [user] while you were editing. Review their changes before saving."* The user can then merge manually or discard their draft.

### 2.6 Filtering & Search

Board and list views can be filtered by:

- Status
- Priority
- Assignee
- Labels
- Date range (created or updated)

### 2.7 Comments

- Any authenticated user can comment on any ticket.
- Comments are append-only (no editing or deleting in v1).

### 2.8 Email Notifications

Triggered automatically for:

- A ticket is assigned to you.
- You are @mentioned in a comment.

Each notification includes the ticket title, a short excerpt, and a direct link to the ticket. Sent via a transactional email API (see Tech Stack).

### 2.9 Dashboard

A single read-only screen visible to all authenticated users:

- Tickets moved to **Done** per calendar month (bar chart).
- Current ticket count broken down by status (donut chart).
- Top assignees by tickets closed this month.

### 2.10 Metrics CSV Export

An "Export to CSV" button is available on the Dashboard screen.

- Accessible to all authenticated users.
- Exports the currently visible metrics data, respecting any active date range filter.
- CSV columns: Month, Tickets Created, Tickets Closed (Done), Tickets Archived, Open by Status (To Do / In Progress / In Review).
- Generated server-side and returned as a file download (`metrics-YYYY-MM-DD.csv`).

### 2.11 Design

- Component library: **shadcn/ui** (Radix primitives + Tailwind CSS).
- Visual language: white background, soft drop shadows, generous whitespace — clean and modern.
- Desktop-first layout (internal tool; no mobile requirement in v1).

---

## 3. Out-of-Scope (v1)

| Feature | Reason |
|---|---|
| Dark mode | Deferred to v2 |
| Live cursors / collaborative editing | Optimistic locking covers the 10-person scale |
| Comment editing or deletion | Append-only keeps the audit trail clean |
| File / image attachments | Not raised as a core requirement |
| Slack or webhook integrations | No stakeholder request |
| Custom status workflows | Explicitly rejected by Laura |
| Mobile / responsive views | Internal desktop tool |
| OAuth / SSO | Auth strategy not defined; defer pending IT input |
| Audit log UI | Data retained in DB but no viewer in v1 |
| Burndown or velocity charts | Dashboard scoped to closed-per-month only |

---

## 4. Tech Stack

### Frontend

| Layer | Choice |
|---|---|
| Framework | React 18 (Vite) |
| UI components | shadcn/ui + Tailwind CSS |
| Server state | TanStack Query |
| Routing | React Router v6 |
| Charts | Recharts |

### Backend

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |

### Database

| Layer | Choice |
|---|---|
| Engine | PostgreSQL 16 |
| Concurrency | Row-level `version` integer + `updated_at` timestamp |

### Services

| Layer | Choice |
|---|---|
| Transactional email | Resend |
| Hosting | TBD |

---

## 5. Open Issues (must be resolved before end of Week 1)

| # | Question | Owner |
|---|---|---|
| 1 | Login strategy: username/password or company SSO? | Roberto + IT |
| 2 | How is the first Admin account created — seeded or self-registered? | Laura |
| 3 | Which domain/account sends notification emails? | Roberto |
| 4 | What is the target hosting environment? | Marcos |
