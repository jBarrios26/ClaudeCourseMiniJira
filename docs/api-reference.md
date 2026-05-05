# API Reference — Mini Jira

**Base URL:** `http://localhost:3000`  
**Content-Type:** `application/json`  
**Timestamps:** todos los campos `*_at` son Unix timestamps en **segundos** (entero).

---

## Autenticación

El sistema usa **JWT (JSON Web Token)** stateless. El flujo completo es:

1. **Login** — el cliente llama a `POST /auth/login` con email y contraseña.
2. **Token recibido** — el servidor devuelve un `token` JWT firmado junto con el perfil del usuario.
3. **Uso del token** — cada petición a rutas protegidas debe incluir el header:
   ```
   Authorization: Bearer <token>
   ```
4. **Refresh** — el contrato actual no define un endpoint de refresco de token (`POST /auth/refresh`). Cuando el token expire, el cliente debe volver a hacer login para obtener uno nuevo.

> **Nota:** Los roles posibles son `user` y `admin`. Algunas rutas requieren rol `admin` explícitamente; las demás solo requieren un token válido (`auth`).

---

## Códigos de error globales

Todas las respuestas de error siguen el shape: `{ "error": "string" }`

| Código | Significado                              |
|--------|------------------------------------------|
| `400`  | Validación fallida o campo faltante      |
| `401`  | Token ausente o inválido                 |
| `403`  | Rol insuficiente                         |
| `404`  | Recurso no encontrado                    |
| `409`  | Conflicto (version mismatch o duplicado) |
| `500`  | Error interno del servidor               |

---

## Tabla de endpoints

| Método   | Ruta                          | Auth    | Body (campos clave)                                                                 | Response                          | Status codes             |
|----------|-------------------------------|---------|-------------------------------------------------------------------------------------|-----------------------------------|--------------------------|
| `POST`   | `/auth/login`                 | Ninguna | `email`, `password`                                                                 | `{ token, user }`                 | 200, 400, 401            |
| `GET`    | `/users`                      | auth    | —                                                                                   | Array de usuarios                 | 200, 401                 |
| `GET`    | `/users/:id`                  | auth    | —                                                                                   | Objeto usuario                    | 200, 401, 404            |
| `POST`   | `/users`                      | admin   | `name`, `email`, `password`, `role`                                                 | Objeto usuario creado             | 201, 400, 401, 403, 409  |
| `PATCH`  | `/users/:id`                  | admin   | `name`?, `email`?, `password`?, `role`? (todos opcionales)                          | Objeto usuario actualizado        | 200, 400, 401, 403, 404, 409 |
| `DELETE` | `/users/:id`                  | admin   | —                                                                                   | Sin body                          | 204, 401, 403, 404       |
| `GET`    | `/tickets`                    | auth    | Query: `status`, `priority`, `assignee_id`, `label_id`, `from`, `to`, `is_archived`| Array de tickets completos        | 200, 401                 |
| `POST`   | `/tickets`                    | auth    | `title`*, `description`?, `status`?, `priority`?, `assignee_id`?, `label_ids`?      | Objeto ticket completo            | 201, 400, 401            |
| `GET`    | `/tickets/:id`                | auth    | —                                                                                   | Objeto ticket completo            | 200, 401, 404            |
| `PATCH`  | `/tickets/:id`                | auth    | `version`* (obligatorio), `title`?, `description`?, `status`?, `priority`?, `assignee_id`?, `label_ids`? | Ticket actualizado | 200, 400, 401, 403, 404, 409 |
| `PATCH`  | `/tickets/:id/archive`        | auth    | —                                                                                   | Ticket archivado                  | 200, 401, 403, 404, 409  |
| `PATCH`  | `/tickets/:id/restore`        | admin   | —                                                                                   | Ticket restaurado                 | 200, 401, 403, 404       |
| `GET`    | `/labels`                     | auth    | —                                                                                   | Array de labels                   | 200, 401                 |
| `POST`   | `/labels`                     | auth    | `name`                                                                              | Objeto label creado               | 201, 400, 401, 409       |
| `DELETE` | `/labels/:id`                 | auth    | —                                                                                   | Sin body                          | 204, 401, 404            |
| `GET`    | `/tickets/:id/comments`       | auth    | —                                                                                   | Array de comentarios              | 200, 401, 404            |
| `POST`   | `/tickets/:id/comments`       | auth    | `body`                                                                              | Objeto comment creado             | 201, 400, 401, 404       |
| `GET`    | `/dashboard`                  | auth    | —                                                                                   | Estadísticas en tiempo real       | 200, 401                 |
| `GET`    | `/metrics`                    | auth    | Query: `from`* (YYYY-MM), `to`* (YYYY-MM)                                           | Array de métricas por mes         | 200, 400, 401            |
| `GET`    | `/metrics/export`             | auth    | Query: `from`* (YYYY-MM), `to`* (YYYY-MM)                                           | Archivo CSV                       | 200, 400, 401            |

`*` = campo requerido · `?` = campo opcional

---

## Ejemplos cURL — Endpoints P0

> Reemplaza `{token}` con el JWT obtenido en el login.

### POST /auth/login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secret123"
  }'
```

**Respuesta 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

---

### GET /tickets

```bash
curl -X GET "http://localhost:3000/tickets?status=in_progress&priority=high" \
  -H "Authorization: Bearer {token}"
```

**Con filtros de fecha y assignee:**
```bash
curl -X GET "http://localhost:3000/tickets?assignee_id=2&from=2025-01-01&to=2025-05-31" \
  -H "Authorization: Bearer {token}"
```

---

### POST /tickets

```bash
curl -X POST http://localhost:3000/tickets \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Corregir bug en login",
    "description": "El formulario no valida el campo email",
    "priority": "high",
    "assignee_id": 3,
    "label_ids": [1, 2]
  }'
```

**Respuesta 201:**
```json
{
  "id": 42,
  "title": "Corregir bug en login",
  "description": "El formulario no valida el campo email",
  "status": "to_do",
  "priority": "high",
  "assignee": { "id": 3, "name": "María García" },
  "created_by": { "id": 1, "name": "Admin User" },
  "labels": [{ "id": 1, "name": "bug" }, { "id": 2, "name": "frontend" }],
  "version": 1,
  "is_archived": false,
  "archived_at": null,
  "created_at": 1714000000,
  "updated_at": 1714000000
}
```

---

### GET /tickets/:id

```bash
curl -X GET http://localhost:3000/tickets/42 \
  -H "Authorization: Bearer {token}"
```

---

### PATCH /tickets/:id

> `version` es **obligatorio**. Si el valor en DB es mayor que el enviado, se devuelve `409`.

```bash
curl -X PATCH http://localhost:3000/tickets/42 \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "status": "in_progress",
    "priority": "medium"
  }'
```

**Error 409 — conflicto de versión:**
```json
{
  "error": "conflict",
  "updatedById": 5,
  "updatedByName": "Carlos Pérez"
}
```

---

### GET /dashboard

```bash
curl -X GET http://localhost:3000/dashboard \
  -H "Authorization: Bearer {token}"
```

**Respuesta 200:**
```json
{
  "tickets_by_status": {
    "to_do": 4,
    "in_progress": 3,
    "in_review": 1,
    "done": 12
  },
  "closed_per_month": [
    { "month": "2025-05", "count": 7 }
  ],
  "top_assignees": [
    { "id": 2, "name": "María García", "closed_this_month": 5 }
  ]
}
```

---

## Endpoints adicionales

### PATCH /tickets/:id/archive

```bash
curl -X PATCH http://localhost:3000/tickets/42/archive \
  -H "Authorization: Bearer {token}"
```

Un `user` solo puede archivar sus propios tickets. Devuelve `409` si el ticket ya está archivado.

---

### PATCH /tickets/:id/restore — solo admin

```bash
curl -X PATCH http://localhost:3000/tickets/42/restore \
  -H "Authorization: Bearer {token}"
```

---

### GET /metrics

```bash
curl -X GET "http://localhost:3000/metrics?from=2025-01&to=2025-05" \
  -H "Authorization: Bearer {token}"
```

Rango máximo: **12 meses**. Si se excede: `400 { "error": "Export range cannot exceed 12 months." }`

---

### GET /metrics/export (CSV)

```bash
curl -X GET "http://localhost:3000/metrics/export?from=2025-01&to=2025-05" \
  -H "Authorization: Bearer {token}" \
  -o metrics-2025-05.csv
```

**Headers de respuesta:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="metrics-2025-05.csv"
```

**Columnas:** `Month, Tickets Created, Tickets Closed (Done), Tickets Archived, Open To Do, Open In Progress, Open In Review`

---

## Reglas de negocio relevantes

| Regla               | Detalle                                                                                      |
|---------------------|----------------------------------------------------------------------------------------------|
| Optimistic locking  | `PATCH /tickets/:id` exige `version`. Si el valor en DB es mayor → `409 conflict`            |
| Archivo (soft delete) | `is_archived = true` oculta el ticket del board. No se elimina físicamente de la base de datos |
| Archivo ≠ cerrado   | Solo `status = done` cuenta como "cerrado" en métricas y dashboard                           |
| Borrado de usuario  | Los tickets del usuario eliminado conservan `created_by`; `assignee` pasa a `null`           |
| Comments            | Append-only — no existe PATCH ni DELETE sobre comentarios                                    |
| `is_archived=true`  | Solo accesible con rol `admin` vía query param en `GET /tickets`                             |
