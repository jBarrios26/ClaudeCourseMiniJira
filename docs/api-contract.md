# API Contract — Mini Jira Backend

**Base URL:** `http://localhost:3000`  
**Content-Type:** `application/json`  
**Auth:** `Authorization: Bearer <token>` en todas las rutas protegidas.

---

## Convenciones

### Error shape
```json
{ "error": "string" }
```

| Código | Significado |
|--------|-------------|
| `400`  | Validación fallida |
| `401`  | Token ausente o inválido |
| `403`  | Rol insuficiente |
| `404`  | Recurso no encontrado |
| `409`  | Conflicto (version mismatch o duplicado) |
| `500`  | Error interno |

### Timestamps
Todos los campos `*_at` son Unix timestamps en **segundos** (entero).

---

## Auth

### `POST /auth/login`
Sin auth.

**Body**
```json
{ "email": "string", "password": "string" }
```

**200**
```json
{
  "token": "string",
  "user": { "id": 1, "name": "string", "email": "string", "role": "user | admin" }
}
```

**Errores:** `400` campos faltantes · `401` credenciales inválidas

---

## Users

### `GET /users` — auth
```json
[{ "id": 1, "name": "string", "email": "string", "role": "user | admin", "created_at": 1714000000 }]
```

### `GET /users/:id` — auth
Mismo shape que el ítem de lista. **`404`** si no existe.

### `POST /users` — admin
**Body**
```json
{ "name": "string", "email": "string", "password": "string", "role": "user | admin" }
```
**201** → usuario creado (sin `password_hash`). **`409`** email duplicado.

### `PATCH /users/:id` — admin
**Body** (todos opcionales)
```json
{ "name": "string", "email": "string", "password": "string", "role": "user | admin" }
```
**200** → usuario actualizado. **`404`** · **`409`**

### `DELETE /users/:id` — admin
**204** sin body. Los tickets asignados quedan con `assignee: null`. **`404`** si no existe.

---

## Tickets

### Objeto ticket completo
```json
{
  "id": 1,
  "title": "string",
  "description": "string | null",
  "status": "to_do | in_progress | in_review | done",
  "priority": "low | medium | high",
  "assignee": { "id": 1, "name": "string" },
  "created_by": { "id": 1, "name": "string" },
  "labels": [{ "id": 1, "name": "string" }],
  "version": 1,
  "is_archived": false,
  "archived_at": null,
  "created_at": 1714000000,
  "updated_at": 1714000000
}
```
`assignee` y `created_by` pueden ser `null` si el usuario fue eliminado.

---

### `GET /tickets` — auth

| Query param  | Tipo                                      | Notas                               |
|-------------|-------------------------------------------|-------------------------------------|
| `status`    | `to_do\|in_progress\|in_review\|done`     |                                     |
| `priority`  | `low\|medium\|high`                       |                                     |
| `assignee_id` | integer                                 |                                     |
| `label_id`  | integer                                   |                                     |
| `from`      | `YYYY-MM-DD`                              | `created_at` ≥ inicio del día UTC   |
| `to`        | `YYYY-MM-DD`                              | `created_at` ≤ fin del día UTC      |
| `is_archived` | `true\|false` (default `false`)         | `true` requiere admin               |

**200** → array de objetos ticket completos.

---

### `POST /tickets` — auth

**Body**
```json
{
  "title": "string (max 120, requerido)",
  "description": "string | null",
  "status": "to_do | in_progress | in_review | done",
  "priority": "low | medium | high",
  "assignee_id": "integer | null",
  "label_ids": [1, 2]
}
```
Defaults: `status = to_do`, `priority = medium`, `label_ids = []`.  
`created_by` se toma del JWT.

**201** → objeto ticket completo. **`400`** validación.

---

### `GET /tickets/:id` — auth
**200** → objeto ticket completo. **`404`**

---

### `PATCH /tickets/:id` — auth
`version` es **obligatorio** (optimistic locking). Un `user` solo puede editar sus propios tickets.

**Body**
```json
{
  "version": 1,
  "title": "string",
  "description": "string | null",
  "status": "to_do | in_progress | in_review | done",
  "priority": "low | medium | high",
  "assignee_id": "integer | null",
  "label_ids": [1, 2]
}
```

**200** → ticket actualizado (version incrementada en 1).

**Errores:**
- `400` falta `version` o validación
- `403` usuario editando ticket ajeno
- `404` ticket no encontrado
- `409` conflicto de versión:
  ```json
  { "error": "conflict", "updatedById": 5, "updatedByName": "string" }
  ```

---

### `PATCH /tickets/:id/archive` — auth
Un `user` solo puede archivar sus propios tickets. Establece `is_archived = true`.

**200** → ticket actualizado. **`403`** · **`404`** · **`409`** si ya archivado.

---

### `PATCH /tickets/:id/restore` — admin
Establece `is_archived = false`, `archived_at = null`.

**200** → ticket actualizado. **`403`** · **`404`**

---

## Labels

### `GET /labels` — auth
```json
[{ "id": 1, "name": "string" }]
```

### `POST /labels` — auth
**Body:** `{ "name": "string" }`  
**201** → `{ "id": 1, "name": "string" }`. **`409`** nombre duplicado.

### `DELETE /labels/:id` — auth
**204** sin body. Elimina en cascada las filas `ticket_labels`. **`404`**

---

## Comments

### `GET /tickets/:id/comments` — auth
```json
[{
  "id": 1,
  "body": "string",
  "author": { "id": 1, "name": "string" },
  "created_at": 1714000000
}]
```
`author` puede ser `null` si el usuario fue eliminado. Orden: `created_at ASC`.

**`404`** si el ticket no existe.

### `POST /tickets/:id/comments` — auth
Append-only — no hay PATCH ni DELETE.

**Body:** `{ "body": "string" }`  
**201** → objeto comment. **`400`** body vacío · **`404`** ticket no encontrado.

---

## Dashboard

### `GET /dashboard` — auth
Valores calculados en tiempo real. Solo tickets activos (no archivados) para `tickets_by_status`.

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
    { "id": 2, "name": "string", "closed_this_month": 5 }
  ]
}
```

- `closed_per_month`: últimos 12 meses calendario.
- `top_assignees`: mes actual, top 5. "Cerrado" = `status = done`.

---

## Metrics

### `GET /metrics` — auth

| Query param | Tipo      | Requerido | Descripción             |
|-------------|-----------|-----------|-------------------------|
| `from`      | `YYYY-MM` | Sí        | Mes inicio (inclusivo)  |
| `to`        | `YYYY-MM` | Sí        | Mes fin (inclusivo)     |

Rango máximo: 12 meses. Si se excede → `400 { "error": "Export range cannot exceed 12 months." }`

```json
[{
  "month": "2025-05",
  "tickets_created": 10,
  "tickets_closed": 7,
  "tickets_archived": 2,
  "open_by_status": {
    "to_do": 3,
    "in_progress": 2,
    "in_review": 1
  }
}]
```

---

### `GET /metrics/export` — auth
Mismos query params que `GET /metrics`. Descarga CSV.

**Headers de respuesta:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="metrics-{to}.csv"
```

**Columnas CSV:**
```
Month, Tickets Created, Tickets Closed (Done), Tickets Archived, Open To Do, Open In Progress, Open In Review
```

---

## Reglas de negocio

| Regla | Detalle |
|-------|---------|
| Optimistic locking | `PATCH /tickets/:id` requiere `version`. Si el valor en DB es mayor → `409` |
| Archivo (soft delete) | `is_archived = true` oculta el ticket del board activo. No se borra físicamente |
| Archivo ≠ cerrado | Solo `status = done` cuenta como "cerrado" en métricas |
| Borrado de usuario | `assignee_id` se pone a `NULL`; `created_by` queda preservado (SET NULL) |
| Comments | Append-only. Sin edición ni borrado |
