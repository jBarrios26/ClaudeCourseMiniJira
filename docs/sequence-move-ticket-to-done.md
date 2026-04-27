# Sequence Diagram — Move a Ticket from To Do to Done

## Flow

```mermaid
sequenceDiagram
    actor User
    participant SPA as Single-Page App
    participant API as API Server
    participant DB as PostgreSQL

    User->>SPA: Opens ticket detail (status: To Do)
    SPA->>API: GET /tickets/:id
    API->>DB: SELECT * FROM tickets WHERE id = :id
    DB-->>API: { id, status: "To Do", version: N, ... }
    API-->>SPA: 200 OK { ticket }
    SPA-->>User: Renders ticket — status "To Do", version N stored in component state

    User->>SPA: Selects status "Done" and clicks Save
    SPA->>API: PATCH /tickets/:id<br/>{ status: "Done", version: N }<br/>Authorization: Bearer <access_token>

    API->>API: Validate JWT signature & expiry

    API->>DB: SELECT version FROM tickets WHERE id = :id
    DB-->>API: { version: currentVersion }

    alt currentVersion === N  (no concurrent edit)
        API->>DB: UPDATE tickets<br/>SET status = "Done", version = N+1, updated_at = NOW()<br/>WHERE id = :id AND version = N
        DB-->>API: 1 row updated
        API-->>SPA: 200 OK { id, status: "Done", version: N+1, updated_at }
        SPA-->>User: Board reflects ticket at "Done"
    else currentVersion > N  (concurrent edit — optimistic lock violation)
        API->>DB: SELECT updated_by FROM tickets WHERE id = :id
        DB-->>API: { updated_by: "User B" }
        API-->>SPA: 409 Conflict { updatedBy: "User B" }
        SPA-->>User: Non-dismissible warning:<br/>"This ticket was updated by User B<br/>while you were editing.<br/>Review their changes before saving."
    end
```

## Notes

| Step | Spec reference |
|---|---|
| Version `N` read on load and held in component state | §2.5 — client sends the version it last read |
| `PATCH` sends `version: N` alongside the change | §2.5 — server compares incoming vs stored version |
| `WHERE id = :id AND version = N` atomic update | Prevents a race between the version check and the write |
| HTTP 409 returned on mismatch | §2.5 — server returns 409 if version has advanced |
| Non-dismissible conflict warning with the other user's name | §2.5 — exact UI requirement |
| No notification email triggered | §2.8 — emails only fire on assignment or @mention, not status change |
