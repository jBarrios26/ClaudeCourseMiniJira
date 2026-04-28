# CLAUDE.md — Backend

This file provides guidance to Claude Code when working with the backend.

---

## Commands

```bash
npm run dev      # tsx watch src/index.ts
npm run build    # tsc
npm run start    # node dist/index.js
npm run db:push  # drizzle-kit push
npm run db:studio # drizzle-kit studio
```

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 5 |
| ORM | Drizzle ORM (`drizzle-orm/better-sqlite3`) |
| Database | SQLite (`better-sqlite3`) |
| Auth | JWT — single token, no refresh (`jsonwebtoken`) |
| Password hashing | **`bcryptjs`** (pure JS — see rule below) |
| Validation | Zod |
| Env vars | `dotenv` |

---

## Rules

### Usar bcryptjs, nunca bcrypt
Usa siempre **`bcryptjs`** para hashear contraseñas. No instales `bcrypt` (nativo, requiere compilar binarios C++). `bcryptjs` es pure-JS, sin dependencias nativas, y es suficientemente rápido para este proyecto.

```ts
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash(password, 10);
const ok   = await bcrypt.compare(password, hash);
```

### Límite de 250 MB en dependencias
El proyecto se desplegará en un entorno **serverless** con un límite estricto de **250 MB** para el bundle de producción (incluyendo `node_modules`).

Antes de instalar cualquier dependencia nueva:
1. Verifica su tamaño con `npm pack --dry-run <pkg>` o consulta [bundlephobia.com](https://bundlephobia.com).
2. Prefiere librerías pure-JS y sin dependencias transitivas pesadas.
3. Nunca instales SDKs con binarios nativos (ej. `bcrypt`, `canvas`, `sharp`) — usa alternativas pure-JS.
4. Revisa el tamaño total con `du -sh node_modules` después de instalar.

---

## Env Vars (`.env`)

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` \| `production` |
| `PORT` | Puerto del servidor (default `3000`) |
| `DATABASE_URL` | Ruta al archivo SQLite (ej. `./dev.db`) |
| `JWT_SECRET` | Secreto para firmar tokens JWT |
| `JWT_EXPIRES_IN` | Expiración del token (ej. `8h`) |
| `FRONTEND_URL` | Origen permitido por CORS |

---

## Project Structure

```
src/
├── index.ts           # Express app + server bootstrap
├── db/
│   ├── schema.ts      # Drizzle table definitions
│   └── client.ts      # better-sqlite3 + drizzle instance
├── routes/
│   ├── auth.ts
│   ├── users.ts
│   ├── tickets.ts
│   ├── labels.ts
│   ├── comments.ts
│   ├── dashboard.ts
│   └── metrics.ts
├── middleware/
│   ├── auth.ts        # JWT verify → req.user
│   └── requireAdmin.ts
└── lib/
    └── csv.ts         # CSV generation for metrics export
```

---

## API Reference

See `docs/backend-specs.md` for the full endpoint specification.  
See `docs/database-schema.yaml` for the full database schema.
