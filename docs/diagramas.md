# Diagramas Técnicos — Mini Jira

---

## Diagrama 1 — Flujo de Autenticación JWT

Muestra el ciclo completo de login desde que el usuario introduce sus credenciales hasta que la SPA almacena el token y redirige al board. Refleja fielmente el código de `backend/src/routes/auth.ts`: validación Zod, consulta a SQLite, comparación con bcryptjs y emisión del JWT.

```mermaid
sequenceDiagram
    participant Usuario
    participant SPA as React SPA
    participant API as Express API
    participant DB as SQLite DB

    Usuario->>SPA: Introduce email y password
    SPA->>API: POST /auth/login { email, password }

    alt Body inválido (Zod safeParse falla)
        API-->>SPA: 400 { error: "mensaje de validación" }
        SPA-->>Usuario: Muestra error de formulario
    else Body válido
        API->>DB: SELECT * FROM users WHERE email = ?
        DB-->>API: Resultado de la consulta

        alt Usuario no encontrado
            API-->>SPA: 401 { error: "Invalid credentials" }
            SPA-->>Usuario: Muestra error de credenciales
        else Usuario encontrado
            API->>API: bcrypt.compare(password, passwordHash)

            alt Contraseña inválida
                API-->>SPA: 401 { error: "Invalid credentials" }
                SPA-->>Usuario: Muestra error de credenciales
            else Contraseña válida
                API->>API: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn })
                API-->>SPA: 200 { token, user: { id, name, email, role } }
                SPA->>SPA: Almacena token en estado/localStorage
                SPA-->>Usuario: Redirige al board
            end
        end
    end
```

---

## Diagrama 2 — Mover Ticket Entre Columnas (PATCH /tickets/:id)

Detalla el flujo completo para actualizar el estado de un ticket, incluyendo la verificación JWT del middleware `authenticate`, el control de acceso por rol, y el optimistic locking mediante el campo `version`. Refleja el código real de `backend/src/routes/tickets.ts` y `backend/src/middleware/auth.ts`.

> **Nota sobre AuditLog:** La tabla `audit_log` **no existe** en `backend/src/db/schema.ts`. El schema actual define las tablas: `users`, `projects`, `tickets`, `labels`, `ticket_labels` y `comments`. El registro de auditoría está previsto en la arquitectura pero pendiente de implementar.

```mermaid
sequenceDiagram
    participant Usuario
    participant SPA as React SPA
    participant API as Express API
    participant DB as SQLite DB

    Usuario->>SPA: Arrastra ticket a nueva columna
    SPA->>API: PATCH /tickets/:id { version: N, status: "nuevo_estado" }<br/>Authorization: Bearer {token}

    Note over API: Middleware authenticate
    API->>API: jwt.verify(token, JWT_SECRET)

    alt Token ausente o inválido
        API-->>SPA: 401 { error: "Unauthorized" }
        SPA-->>Usuario: Redirige a login
    else Token válido — req.user = { id, email, role }
        API->>API: Zod safeParse(req.body) — valida version obligatorio

        alt Body inválido (falta version u otro campo)
            API-->>SPA: 400 { error: "mensaje de validación" }
            SPA-->>Usuario: Muestra error
        else Body válido
            API->>DB: SELECT ticket con JOIN usuarios WHERE id = ?
            DB-->>API: Fila del ticket actual

            alt Ticket no encontrado
                API-->>SPA: 404 { error: "Ticket not found" }
                SPA-->>Usuario: Muestra error
            else Ticket encontrado
                API->>API: Verifica rol:<br/>si role == "user" y createdById != req.user.id

                alt Acceso denegado (usuario editando ticket ajeno)
                    API-->>SPA: 403 { error: "Forbidden" }
                    SPA-->>Usuario: Muestra error de permisos
                else Permiso concedido
                    API->>API: Compara current.version === N

                    alt Conflicto de versión (version en DB != N)
                        API-->>SPA: 409 { error: "conflict", updatedById, updatedByName }
                        SPA-->>Usuario: Avisa que otro usuario modificó el ticket
                    else Versión coincide
                        API->>DB: UPDATE tickets SET status=?, version=N+1,<br/>updated_at=now() WHERE id=?
                        DB-->>API: OK

                        Note over DB: AuditLog pendiente de implementar:<br/>no existe tabla audit_log en el schema actual

                        API->>DB: SELECT ticket actualizado con JOIN usuarios
                        DB-->>API: Ticket con version N+1

                        API-->>SPA: 200 { ticket actualizado }
                        SPA-->>Usuario: Actualiza columna en el board
                    end
                end
            end
        end
    end
```

---

## Diagrama 3 — Ciclo de Vida de un Ticket

Muestra todos los estados posibles de un ticket desde su creación hasta su archivo o restauración. Incluye las transiciones libres entre los 4 estados activos, el mecanismo de optimistic locking (campo `version`) que protege las actualizaciones concurrentes, y el flujo de soft delete mediante archivo y restauración. El estado `done` es el único que computa como "cerrado" en métricas y dashboard.

> **Nota:** El sistema implementa **Optimistic Locking** (no pessimistic). No hay bloqueo de fila en DB; la concurrencia se controla comparando el campo `version` del cliente contra el valor en DB en el momento del PATCH.

```mermaid
flowchart LR
    CREAR["POST /tickets\ncreatedBy = JWT user\nversion = 1"]

    TODO["to_do"]
    INPROGRESS["in_progress"]
    INREVIEW["in_review"]
    DONE["done\n(cerrado en metricas)"]

    ARCHIVADO["Archivado\nis_archived = true\narchivedAt = now()"]

    CREAR --> TODO

    TODO --> INPROGRESS
    TODO --> INREVIEW
    TODO --> DONE

    INPROGRESS --> TODO
    INPROGRESS --> INREVIEW
    INPROGRESS --> DONE

    INREVIEW --> TODO
    INREVIEW --> INPROGRESS
    INREVIEW --> DONE

    DONE --> TODO
    DONE --> INPROGRESS
    DONE --> INREVIEW

    subgraph OL["Optimistic Lock — PATCH /tickets/:id"]
        direction TB
        CHECK{"version client == DB?"}
        UPDATE["version + 1\nupdated_at = now()"]
        CONFLICT["409 Conflict\nupdatedById + updatedByName"]

        CHECK -- "Si" --> UPDATE
        CHECK -- "No" --> CONFLICT
    end

    TODO --> CHECK
    INPROGRESS --> CHECK
    INREVIEW --> CHECK
    DONE --> CHECK

    UPDATE --> TODO
    UPDATE --> INPROGRESS
    UPDATE --> INREVIEW
    UPDATE --> DONE

    TODO -- "PATCH /archive\n(user: solo propio)" --> ARCHIVADO
    INPROGRESS -- "PATCH /archive\n(user: solo propio)" --> ARCHIVADO
    INREVIEW -- "PATCH /archive\n(user: solo propio)" --> ARCHIVADO
    DONE -- "PATCH /archive\n(user: solo propio)" --> ARCHIVADO

    ARCHIVADO -- "PATCH /restore\n(solo admin)" --> TODO
```
