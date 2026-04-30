# Prompt para Agente de Correcciones de Seguridad

Eres un ingeniero de seguridad senior. Debes aplicar las correcciones del reporte de seguridad `security-report.md` sobre el backend de este proyecto (Express + TypeScript + Drizzle ORM + SQLite). Aplica las correcciones en orden de severidad: primero CRÍTICO, luego ALTO, luego MEDIO, luego BAJO.

**Reglas estrictas:**
- No cambies lógica de negocio ni rutas existentes salvo lo necesario para la corrección.
- No instales dependencias con binarios nativos (el bundle tiene límite de 250 MB).
- Verifica que los tests existentes en `src/__tests__/` siguen pasando con `npm test` tras cada grupo de cambios.
- No modifiques archivos de tests.

---

## GRUPO 1 — CRÍTICO (aplicar primero)

### C-01: Reemplazar JWT_SECRET en `.env` y añadir validación al arranque

**Acción 1:** En `.env`, reemplaza el valor placeholder por un secreto generado:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Pega el resultado como valor de `JWT_SECRET` en `.env`.

**Acción 2:** En `src/index.ts`, añade una validación al arranque que aborte si `JWT_SECRET` no está definido o tiene menos de 32 caracteres:
```ts
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}
```

**Acción 3:** Añade `.env` a `.gitignore` si no está ya (verifica primero). Solo `.env.example` debe estar en el repositorio.

### C-02: Eliminar credenciales hardcodeadas del seed

**Acción:** En `src/db/seed.ts`, reemplaza la contraseña hardcodeada por una generada aleatoriamente y muéstrala una sola vez en consola al finalizar el seed:
```ts
import crypto from 'crypto';
const adminPassword = crypto.randomBytes(16).toString('hex');
const passwordHash = await bcrypt.hash(adminPassword, 10);
// Al final del seed:
console.log(`Admin creado: admin@example.com / ${adminPassword}`);
console.log('GUARDA esta contraseña: no se volverá a mostrar.');
```

### C-03: Añadir rate limiting al endpoint de login

**Acción:** Instala `express-rate-limit` (pure JS, ~15 KB sin dependencias nativas):
```bash
npm install express-rate-limit
```

En `src/routes/auth.ts`, añade un limiter antes del handler:
```ts
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 20,                    // máx 20 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

router.post('/login', loginLimiter, async (req, res) => { ... });
```

---

## GRUPO 2 — ALTO (aplicar tras completar CRÍTICO)

### A-01: Añadir cabeceras de seguridad HTTP con Helmet

**Acción:** Instala `helmet` (pure JS):
```bash
npm install helmet
npm install --save-dev @types/helmet
```

En `src/app.ts`, añade helmet como primer middleware:
```ts
import helmet from 'helmet';
// ...
const app = express();
app.use(helmet());  // Añadir ANTES de cors()
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```

### A-02: Reforzar validación de contraseñas

**Acción:** En `src/routes/users.ts`, actualiza `createUserSchema` y `patchUserSchema`:
```ts
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer');

const createUserSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: passwordSchema,
  role:     z.enum(['user', 'admin']).default('user'),
});

const patchUserSchema = z.object({
  name:     z.string().min(1).optional(),
  email:    z.string().email().optional(),
  password: passwordSchema.optional(),
  role:     z.enum(['user', 'admin']).optional(),
});
```

### A-03: Restringir creación y borrado de etiquetas a administradores

**Acción:** En `src/routes/labels.ts`, añade `requireAdmin` a `POST /labels` y `DELETE /labels/:id`:
```ts
import { requireAdmin } from '../middleware/requireAdmin';

// POST /labels — solo admin puede crear
router.post('/', authenticate, requireAdmin, async (req, res) => { ... });

// DELETE /labels/:id — solo admin puede eliminar
router.delete('/:id', authenticate, requireAdmin, async (req, res) => { ... });
```

### A-04: Revalidar el rol del usuario en la base de datos en cada request

**Acción:** En `src/middleware/auth.ts`, consulta la DB para obtener el rol actual en lugar de confiar ciegamente en el payload del JWT:
```ts
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number; email: string; role: 'user' | 'admin';
    };
    // Verificar rol actual en DB (síncrono con better-sqlite3 si se usa .get)
    const user = db.select({ id: users.id, email: users.email, role: users.role })
      .from(users).where(eq(users.id, payload.id)).get();  // .get() es síncrono en better-sqlite3
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```
Nota: `better-sqlite3` es síncrono, por lo que `.get()` funciona sin `async/await`. Si prefieres mantenerlo asíncrono, usa `await db.select(...).from(users).where(...).limit(1)` y convierte el middleware a `async`.

### A-05: Añadir valor por defecto seguro para CORS

**Acción:** En `src/app.ts`, añade un fallback que deniega todas las conexiones si `FRONTEND_URL` no está configurada:
```ts
const allowedOrigin = process.env.FRONTEND_URL;
if (!allowedOrigin) {
  console.error('FATAL: FRONTEND_URL env var is not set');
  process.exit(1);
}
app.use(cors({ origin: allowedOrigin, credentials: true }));
```

---

## GRUPO 3 — MEDIO (aplicar tras completar ALTO)

### M-01: Restringir métricas y dashboard a administradores

**Acción:** En `src/routes/metrics.ts`, añade `requireAdmin` a ambos endpoints:
```ts
import { requireAdmin } from '../middleware/requireAdmin';

router.get('/',       authenticate, requireAdmin, async (req, res) => { ... });
router.get('/export', authenticate, requireAdmin, async (req, res) => { ... });
```

En `src/routes/dashboard.ts`:
```ts
import { requireAdmin } from '../middleware/requireAdmin';

router.get('/', authenticate, requireAdmin, async (_req, res) => { ... });
```

### M-02: Añadir paginación a endpoints de listado y límite de tamaño al JSON parser

**Acción 1:** En `src/app.ts`, configura el límite de tamaño del body:
```ts
app.use(express.json({ limit: '16kb' }));
```

**Acción 2:** En `src/routes/tickets.ts`, añade parámetros de paginación al schema y a la query:
```ts
const getTicketsSchema = z.object({
  // ... campos existentes ...
  page:     z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
});

// En el handler, añade .limit() y .offset() a la query de tickets:
const { page, per_page } = parsed.data;
const offset = (page - 1) * per_page;
// Añadir .limit(per_page).offset(offset) a la query principal de tickets
```

**Acción 3:** En `src/routes/users.ts`, añade paginación similar a `GET /users`.

### M-03: Redactar stack traces en logs de producción

**Acción:** Crea `src/lib/logger.ts`:
```ts
export function logError(prefix: string, err: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    const message = err instanceof Error ? err.message : String(err);
    console.error(prefix, message);
  } else {
    console.error(prefix, err);
  }
}
```

Reemplaza todos los `console.error('[...route...]', err)` en todos los archivos de routes por:
```ts
import { logError } from '../lib/logger';
// ...
logError('[POST /auth/login]', err);
```

### M-04: Enviar JWT como cookie httpOnly (cambio de arquitectura coordinado con frontend)

**Nota:** Este cambio requiere coordinación con el equipo de frontend. La cookie reemplaza al token en el body de la respuesta.

**Acción en `src/routes/auth.ts`:**
```ts
// Reemplazar res.json({ token, user }) por:
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 8 * 60 * 60 * 1000,  // 8 horas en ms
});
res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
```

**Acción en `src/middleware/auth.ts`:** actualiza para leer el token también desde la cookie:
```ts
import cookieParser from 'cookie-parser';  // npm install cookie-parser
// En app.ts: app.use(cookieParser());

// En el middleware authenticate:
const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
```

---

## GRUPO 4 — BAJO (aplicar al final)

### B-01: Implementar endpoint de logout con invalidación de token

**Acción:** Si se implementó M-04 (cookie httpOnly), añade en `src/routes/auth.ts`:
```ts
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('token');
  res.status(204).send();
});
```
Si no se implementó M-04, implementa una blacklist en memoria o Redis con el `jti` (JWT ID) del token hasta su expiración.

### B-02: Añadir log de auditoría para acciones administrativas

**Acción:** Crea `src/lib/audit.ts`:
```ts
export function auditLog(action: string, adminId: number, targetId: number | string, details?: string): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    type: 'AUDIT',
    action,
    adminId,
    targetId,
    details,
  }));
}
```

Llama a `auditLog` en las operaciones destructivas:
- `DELETE /users/:id` → `auditLog('user.delete', req.user.id, id)`
- `PATCH /users/:id` (cambio de rol) → `auditLog('user.role_change', req.user.id, id, role)`
- `DELETE /projects/:id` → `auditLog('project.delete', req.user.id, id)`
- `PATCH /users/:id` (cambio de rol o contraseña) → incluir qué campo cambió

### B-03: Eliminar header `X-Powered-By`

**Acción:** Si se implementó Helmet (A-01), este header ya está eliminado automáticamente. Si no, añade en `src/app.ts`:
```ts
app.disable('x-powered-by');
```

---

## Verificación final

Tras aplicar todas las correcciones, ejecuta:
```bash
cd backend
npm test
```

Verifica manualmente con curl:
```bash
# Verificar rate limiting (debe fallar en el intento 21)
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'; done

# Verificar que X-Powered-By ya no existe
curl -I http://localhost:3000/auth/login 2>&1 | grep -i "x-powered"

# Verificar cabeceras de seguridad presentes
curl -I http://localhost:3000/auth/login 2>&1 | grep -i "x-frame\|x-content\|helmet"
```
