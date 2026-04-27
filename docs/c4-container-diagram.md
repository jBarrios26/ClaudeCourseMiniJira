# C4 Container Diagram — Mini Jira

## Diagram

```mermaid
C4Container
    title Container Diagram — Mini Jira

    Person(user, "Team Member", "Creates and manages tickets, adds comments, views dashboard")
    Person(admin, "Admin", "Full access: archive, restore, member management, metrics export")

    System_Boundary(sys, "Mini Jira") {
        Container(spa, "Single-Page Application", "React 18 · Vite · TanStack Query · React Router v6 · Recharts", "Ticket board, forms, dashboard charts, CSV export, draft preservation via localStorage")
        Container(api, "API Server", "Node.js 20 · Express 5 · JWT", "Authentication (access + refresh tokens), ticket CRUD, optimistic locking (version field + HTTP 409), comments, metrics aggregation, CSV generation")
        ContainerDb(db, "Relational Database", "PostgreSQL 16 · Prisma ORM", "Users, tickets (version integer, soft-delete), comments, labels, refresh tokens, audit history")
    }

    System_Ext(resend, "Resend", "Transactional email delivery for ticket assignments and @mention notifications")

    Rel(user, spa, "Uses", "HTTPS")
    Rel(admin, spa, "Uses", "HTTPS")
    Rel(spa, api, "REST/JSON", "HTTPS")
    Rel(api, db, "Reads / Writes", "TCP · Prisma")
    Rel(api, resend, "Sends notification emails", "HTTPS · REST API")
```

## Notes

| Container | Rationale |
|---|---|
| **SPA** | Single deployable unit — all frontend tech (routing, charts, state) lives here. `localStorage` draft preservation (EC-01) is an internal SPA concern, not a separate container. |
| **API Server** | Owns all business logic: JWT issuance/refresh, optimistic locking, role enforcement, and CSV generation — keeping the SPA thin. |
| **Relational Database** | One DB covers both transactional data and the `version` integer required for optimistic locking. Audit history is retained here per spec §2.4. |
| **Resend (external)** | Crosses the system boundary — the API calls it, but it is not owned by the team. Modeled as `System_Ext`. |
