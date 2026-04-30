# Security Report — Jira Clone Backend
**Fecha:** 2026-04-29  
**Auditor:** OWASP Security Specialist (Claude)  
**Alcance:** `backend/src/` (routes, middleware, db, lib), `backend/.env`, `backend/package.json`  
**Metodología:** Revisión estática de código contra OWASP Top 10 (2021)

---

## Resumen Ejecutivo

| Severidad | Hallazgos |
|-----------|-----------|
| CRÍTICO   | 3         |
| ALTO      | 5         |
| MEDIO     | 4         |
| BAJO      | 3         |
| **Total** | **15**    |

El riesgo más grave es la combinación de un secreto JWT predecible commiteado al repositorio más la ausencia de rate limiting en el login: cualquier persona con acceso al repo puede forjar tokens de administrador sin necesidad de credenciales.

---

## HALLAZGOS CRÍTICOS

---

### [C-01] Secreto JWT débil y predecible commiteado al repositorio
**Categoría OWASP:** A02:2021 – Cryptographic Failures  
**Archivo:** `backend/.env:7`  
**Evidencia:**
```
JWT_SECRET=change_this_to_a_long_random_secret
```
**Impacto:** Cualquier persona con acceso al repositorio (o que adivine este valor literal) puede forjar tokens JWT válidos firmados con este secreto, incluyendo tokens con `role: "admin"`. Esto equivale a control total de la aplicación sin necesitar credenciales. El valor es un placeholder que nunca fue reemplazado por un secreto real y está persistido en git history.

---

### [C-02] Credenciales de administrador hardcodeadas en seed
**Categoría OWASP:** A07:2021 – Identification and Authentication Failures  
**Archivo:** `backend/src/db/seed.ts:7`  
**Evidencia:**
```ts
const passwordHash = await bcrypt.hash("admin123", 10);
// ...
email: "admin@example.com",
```
**Impacto:** Si el seed fue ejecutado en cualquier entorno (desarrollo, staging o producción), existe una cuenta `admin@example.com` con contraseña `admin123` que otorga acceso total al sistema. La contraseña es trivialmente débil y está documentada en el propio código fuente, accesible a cualquiera con acceso al repositorio.

---

### [C-03] Ausencia de rate limiting en el endpoint de login
**Categoría OWASP:** A07:2021 – Identification and Authentication Failures  
**Archivo:** `backend/src/routes/auth.ts:17` / `backend/src/app.ts:15`  
**Evidencia:**
```ts
// app.ts — sin rate limiter global ni por ruta
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use('/auth', authRouter);

// auth.ts — POST /login sin ninguna protección contra fuerza bruta
router.post('/login', async (req, res) => { ... });
```
**Impacto:** Un atacante puede realizar miles de intentos de login por segundo contra cualquier cuenta sin restricción alguna. Combinado con C-01 (secreto conocido) y C-02 (contraseña débil), un ataque de fuerza bruta puede comprometer cualquier cuenta de usuario ordinaria en minutos.

---

## HALLAZGOS ALTOS

---

### [A-01] Ausencia total de cabeceras de seguridad HTTP
**Categoría OWASP:** A05:2021 – Security Misconfiguration  
**Archivo:** `backend/src/app.ts:13-26`  
**Evidencia:**
```ts
const app = express();
app.use(cors({ ... }));
app.use(express.json());
// Sin helmet, sin CSP, sin X-Frame-Options, sin HSTS
```
**Impacto:** Sin cabeceras como `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` y `Strict-Transport-Security`, la aplicación es vulnerable a ataques de clickjacking, MIME sniffing y otros vectores del lado del cliente. Express por defecto expone además el header `X-Powered-By: Express`, revelando el stack tecnológico.

---

### [A-02] Longitud mínima de contraseña de 1 carácter
**Categoría OWASP:** A07:2021 – Identification and Authentication Failures  
**Archivo:** `backend/src/routes/users.ts:46` y `backend/src/routes/auth.ts:13`  
**Evidencia:**
```ts
// users.ts
const createUserSchema = z.object({
  password: z.string().min(1),  // acepta "a" como contraseña válida
});

// auth.ts
const loginSchema = z.object({
  password: z.string().min(1),
});
```
**Impacto:** El sistema acepta contraseñas de un solo carácter. Un administrador puede crear usuarios con contraseñas triviales sin recibir ningún error de validación. Sin políticas de complejidad, los ataques de diccionario tienen una superficie masiva.

---

### [A-03] Cualquier usuario autenticado puede crear y eliminar etiquetas globales
**Categoría OWASP:** A01:2021 – Broken Access Control  
**Archivo:** `backend/src/routes/labels.ts:24` y `labels.ts:48`  
**Evidencia:**
```ts
// POST /labels — solo require authenticate, no requireAdmin
router.post('/', authenticate, async (req, res) => { ... });

// DELETE /labels/:id — solo require authenticate, no requireAdmin
router.delete('/:id', authenticate, async (req, res) => { ... });
```
**Impacto:** Cualquier usuario con una cuenta válida puede crear etiquetas arbitrarias para contaminar el sistema, o eliminar etiquetas existentes afectando todos los tickets que las referencian (la FK tiene `onDelete: 'cascade'` para `ticket_labels`, eliminando silenciosamente la relación). Esto viola el principio de mínimo privilegio.

---

### [A-04] El rol del JWT no se revalida contra la base de datos
**Categoría OWASP:** A01:2021 – Broken Access Control  
**Archivo:** `backend/src/middleware/auth.ts:16-21`  
**Evidencia:**
```ts
const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
  id: number;
  email: string;
  role: 'user' | 'admin';
};
req.user = { id: payload.id, email: payload.email, role: payload.role };
// Nunca se consulta la DB para verificar el rol actual
```
**Impacto:** Si un admin es degradado a usuario ordinario en la DB (vía `PATCH /users/:id`), su token JWT existente seguirá teniendo `role: "admin"` durante hasta 8 horas (`JWT_EXPIRES_IN=8h`). Durante ese tiempo puede seguir ejecutando acciones administrativas. No existe mecanismo de revocación de tokens.

---

### [A-05] CORS puede permitir cualquier origen si FRONTEND_URL no está definida
**Categoría OWASP:** A05:2021 – Security Misconfiguration  
**Archivo:** `backend/src/app.ts:15` / `backend/.env.example:10`  
**Evidencia:**
```ts
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```
```
# .env.example
FRONTEND_URL=http://localhost:5173   # sin valor por defecto si no se define
```
**Impacto:** Cuando `origin` en la librería `cors` recibe `undefined`, permite cualquier origen (`*`). Si `FRONTEND_URL` no está definida en el entorno de producción, la API aceptará solicitudes cross-origin desde cualquier dominio, habilitando ataques CSRF y exfiltración de datos desde sitios maliciosos.

---

## HALLAZGOS MEDIOS

---

### [M-01] Métricas y dashboard expuestos a todos los usuarios autenticados
**Categoría OWASP:** A01:2021 – Broken Access Control  
**Archivo:** `backend/src/routes/metrics.ts:86,121` / `backend/src/routes/dashboard.ts:11`  
**Evidencia:**
```ts
// metrics.ts — sin requireAdmin
router.get('/', authenticate, async (req, res) => { ... });
router.get('/export', authenticate, async (req, res) => { ... });

// dashboard.ts — sin requireAdmin
router.get('/', authenticate, async (_req, res) => { ... });
```
**Impacto:** Cualquier usuario autenticado (rol `user`) puede acceder a métricas de negocio agregadas de toda la organización (tickets creados, cerrados, archivados, top asignados) y exportarlas en CSV. Esto expone información sensible sobre la productividad del equipo que debería estar restringida a administradores.

---

### [M-02] Sin límite de tamaño en requests ni paginación en endpoints de listado
**Categoría OWASP:** A04:2021 – Insecure Design  
**Archivo:** `backend/src/app.ts:16` / `backend/src/routes/tickets.ts:80` / `backend/src/routes/users.ts:17`  
**Evidencia:**
```ts
// Sin límite de tamaño explícito en JSON parser
app.use(express.json());  // default 100kb pero sin configuración explícita

// GET /tickets — sin LIMIT en la query
const ticketRows = await db.select(TICKET_SELECT).from(tickets)...where(and(...conditions));

// GET /users — sin paginación
const rows = await db.select().from(users).orderBy(asc(users.createdAt));
```
**Impacto:** Con miles de tickets o usuarios, una solicitud a `GET /tickets` o `GET /users` devuelve el conjunto completo, pudiendo saturar la memoria del servidor. Igualmente, requests con payloads JSON grandes (hasta 100kb) pueden ser usados para degradar el rendimiento.

---

### [M-03] Información de errores internos en logs sin redacción
**Categoría OWASP:** A09:2021 – Security Logging and Monitoring Failures  
**Archivo:** Todos los archivos de routes (patrón repetido)  
**Evidencia:**
```ts
// Ejemplo en auth.ts:49
} catch (err) {
  console.error('[POST /auth/login]', err);  // err puede contener stack traces con paths internos
  res.status(500).json({ error: 'Internal server error' });
}
```
**Impacto:** Los objetos de error se loguean completos incluyendo stack traces que pueden revelar rutas internas del filesystem, versiones de dependencias y estructura del código. En entornos donde los logs son accesibles por múltiples personas, esto amplía la superficie de ataque para un actor malicioso interno.

---

### [M-04] JWT devuelto en el cuerpo de respuesta (no como cookie httpOnly)
**Categoría OWASP:** A07:2021 – Identification and Authentication Failures  
**Archivo:** `backend/src/routes/auth.ts:45-48`  
**Evidencia:**
```ts
res.json({
  token,   // JWT enviado en el body, no en Set-Cookie httpOnly
  user: { id: user.id, name: user.name, email: user.email, role: user.role },
});
```
**Impacto:** El token JWT es accesible desde JavaScript en el cliente. Si existe alguna vulnerabilidad XSS en el frontend, el token puede ser robado desde `localStorage` o cualquier variable JS donde el cliente lo almacene, permitiendo al atacante suplantar la identidad de cualquier usuario indefinidamente (hasta expiración del token).

---

## HALLAZGOS BAJOS

---

### [B-01] Sin mecanismo de revocación de tokens (logout no invalida el JWT)
**Categoría OWASP:** A07:2021 – Identification and Authentication Failures  
**Archivo:** `backend/src/routes/auth.ts` (ausencia)  
**Evidencia:** No existe endpoint `POST /auth/logout` ni blacklist/allowlist de tokens.  
**Impacto:** Un token comprometido (robo, phishing, dispositivo perdido) permanece válido durante 8 horas sin posibilidad de revocación. El usuario afectado no puede invalidar su sesión activa.

---

### [B-02] Sin trazabilidad de acciones administrativas (audit log)
**Categoría OWASP:** A09:2021 – Security Logging and Monitoring Failures  
**Archivo:** `backend/src/routes/users.ts`, `projects.ts`, `tickets.ts` (patrón general)  
**Evidencia:** Operaciones destructivas como `DELETE /users/:id`, `PATCH /users/:id` (cambio de rol) o `DELETE /projects/:id` no registran quién realizó la acción.  
**Impacto:** En caso de incidente de seguridad (cuenta admin comprometida, borrado malicioso de datos), no hay forma de determinar qué acciones tomó el atacante ni cuándo, dificultando la respuesta al incidente y el cumplimiento normativo.

---

### [B-03] Header `X-Powered-By: Express` expuesto
**Categoría OWASP:** A05:2021 – Security Misconfiguration  
**Archivo:** `backend/src/app.ts:13`  
**Evidencia:** Express envía `X-Powered-By: Express` por defecto. No hay `app.disable('x-powered-by')` ni `helmet()` que lo elimine.  
**Impacto:** Revela el stack tecnológico al atacante, permitiéndole focalizar exploits conocidos para la versión de Express en uso.

---

## Referencias OWASP
- [A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [A02:2021 Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- [A04:2021 Insecure Design](https://owasp.org/Top10/A04_2021-Insecure_Design/)
- [A05:2021 Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [A07:2021 Identification and Authentication Failures](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- [A09:2021 Security Logging and Monitoring Failures](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)
