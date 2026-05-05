---
name: generador-diagramas
description: Genera docs/diagramas.md con 3 diagramas Mermaid del Mini Jira: flujo JWT, mover ticket entre columnas con optimistic lock, y ciclo de vida de un ticket.
tools: Read, Write
---

Rol: Generador de diagramas técnicos del Mini Jira.

## Contexto a leer (en este orden, antes de generar nada)

1. `docs/api-contract.md` — fuente de verdad de endpoints y shapes.
2. Cualquier archivo de arquitectura disponible en `docs/` que describa contenedores,
   stack o diseño de sistema (busca nombres como `c4-container-diagram.md`,
   `architecture.md`, `backend-specs.md`, `specs.md`).
3. Todos los archivos `.ts` dentro de `backend/src/routes/`
   (auth, tickets, users, labels, comments, dashboard, metrics).
4. `backend/src/middleware/auth.ts` — para el flujo real de verificación JWT.
5. `backend/src/db/schema.ts` — para confirmar qué tablas existen (p. ej. AuditLog).

Lee estos archivos antes de escribir cualquier diagrama.

## Tarea

Genera el archivo `docs/diagramas.md` con exactamente 3 diagramas Mermaid.

---

### Diagrama 1 — sequenceDiagram: flujo de autenticación JWT

Participantes: `Usuario`, `React SPA`, `Express API`, `SQLite DB`.

El diagrama debe reflejar el código real de `backend/src/routes/auth.ts`:

- SPA envía `POST /auth/login` con `{ email, password }`.
- API valida el body con Zod (rama `alt` para fallo de validación → 400).
- API consulta `SELECT * FROM users WHERE email = ?`.
- Rama `alt` si el usuario no existe → 401.
- API ejecuta `bcrypt.compare(password, passwordHash)`.
- Rama `alt` si la contraseña es inválida → 401.
- API emite `jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn })`.
- API responde 200 `{ token, user }`.
- SPA almacena el token y redirige al board.

### Diagrama 2 — sequenceDiagram: mover ticket entre columnas

Participantes: `Usuario`, `React SPA`, `Express API`, `SQLite DB`, `AuditLog`.

El diagrama debe reflejar el código real de `PATCH /tickets/:id` en
`backend/src/routes/tickets.ts`:

- SPA envía `PATCH /tickets/:id` con `{ version: N, status: "nuevo_estado" }`
  y header `Authorization: Bearer {token}`.
- API ejecuta el middleware `authenticate` → `jwt.verify(token, JWT_SECRET)`.
- Rama `alt` si el token es inválido → 401.
- API consulta el ticket actual en DB.
- Rama `alt` si no existe → 404.
- API verifica permisos de rol (`user` solo puede editar sus propios tickets).
- Rama `alt` si acceso denegado → 403.
- API compara `current.version === N` (optimistic locking).
- Rama `alt` si hay conflicto de versión → 409 `{ error: "conflict", updatedById, updatedByName }`.
- API ejecuta `UPDATE tickets SET status=?, version=N+1, updated_at=now() WHERE id=?`.
- **Nota sobre AuditLog**: si `backend/src/db/schema.ts` no contiene una tabla
  `audit_log`, incluye el paso como `Note` de Mermaid indicando que está
  previsto en la arquitectura pero pendiente de implementar. No lo inventes
  como un paso real si no existe en el schema.
- API re-fetcha el ticket y responde 200 con el ticket actualizado.
- SPA actualiza el board.

### Diagrama 3 — flowchart LR: ciclo de vida de un ticket

Debe mostrar:

- Nodo de entrada: `POST /tickets` → estado inicial `to_do`.
- Los 4 estados activos: `to_do`, `in_progress`, `in_review`, `done`.
- Transiciones libres entre cualquier par de estados activos
  (según specs: "Any state can transition to any other state").
- Un subgraph **"Optimistic Lock — PATCH /tickets/:id"** con:
  - Nodo de decisión `¿version client == DB?`
  - Rama Sí → `version + 1 / updated_at = now()` → vuelve a los estados activos.
  - Rama No → `409 Conflict ⚠️ updatedById`.
- Ruta de archivo (soft delete): cualquier estado activo →
  `PATCH /archive` → `is_archived = true` (nodo `Archivado 🗄️`).
- Restauración: `Archivado` → `PATCH /restore (admin)` → `to_do`.
- Nota visual: `done` es el único estado que cuenta como "cerrado" en métricas.

**Corrección importante**: el sistema usa **optimistic locking** (campo `version`),
NO pessimistic locking. Si el prompt original decía "Pessimistic Lock", usa
"Optimistic Lock" que es lo que está implementado, y añade una nota en el
diagrama aclarando esto.

---

## Restricciones

- **NO modificar ningún archivo de código fuente** (`.ts`, `.js`, `.json`, etc.).
- El único archivo a crear o sobreescribir es `docs/diagramas.md`.
- Todos los bloques de código deben usar la sintaxis ` ```mermaid ` para que
  se rendericen correctamente en GitHub y en el IDE.
- Verifica que la sintaxis Mermaid sea válida antes de escribir:
  - Los `sequenceDiagram` deben cerrar todos los bloques `alt/else/end`.
  - Los `flowchart` deben usar `-->` para aristas y no mezclar con `->`.
  - Los `subgraph` deben cerrar con `end`.
  - Los textos con caracteres especiales (`<`, `>`, `"`) deben ir entre comillas
    o usar entidades HTML dentro de los nodos.
- Cada diagrama debe ir precedido de un encabezado `## Diagrama N — Título`
  y una descripción de 2-3 líneas explicando qué muestra y por qué es relevante.

## Output

Archivo: `docs/diagramas.md`
