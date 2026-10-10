# NexaOps — Business Operations Management System

Portfolio-quality modular monolith: **React + Vite + TypeScript** frontend, **Express + TypeScript + Mongoose** backend, **MongoDB** persistence.

Covers: secure JWT auth with rotating refresh cookies, centralized RBAC + resource-level ownership checks, users/employees/customers/products/projects/tasks/orders/reports/notifications, pagination/filtering/sorting, Zod + Mongoose validation, mass-assignment guards, rate limiting, helmet, CORS, structured errors, Vitest + Supertest security tests.

## Quickstart (free, local only)

Requirements: Node >= 20, local MongoDB.

```zsh
# 1. Start Mongo
brew services start mongodb-community
mongosh --eval "db.runCommand({ping:1})" # expect { ok: 1 }

# 2. Configure
cp .env.example apps/api/.env
# edit apps/api/.env if needed (MONGO_URI, JWT secrets >= 32 chars)

# 3. Install + seed + run
npm install
npm run seed -w apps/api        # creates admin/manager/employee + demo project
npm run dev:api                  # http://localhost:5001/api/health (5001 avoids macOS AirPlay on 5000)
npm run dev:web                  # http://localhost:5173 (proxies /api)
```

Demo logins (seeded): `admin@nexaops.local / Admin123!`, `manager@nexaops.local / Manager123!`, `employee@nexaops.local / Employee123!`

## Scripts

| Command | What |
|---|---|
| `npm run dev:api` | Express with tsx watch |
| `npm run dev:web` | Vite dev |
| `npm test -w apps/api` | 11 unit + integration security tests (mongodb-memory-server) |
| `npm run build` | Typecheck + build both apps |

## Auth strategy

Short-lived access JWT (15m, sent as `Authorization: Bearer` + HttpOnly cookie fallback) and rotating refresh JWT (7d, HttpOnly `SameSite=Lax` cookie scoped to `/api/auth`). Refresh rotates on each use; logout revokes the stored hash. Public `/register` always creates `EMPLOYEE`; promotion only via `PATCH /users/:id/role` (ADMIN, cannot self-promote).

Limitations: no email verification, no refresh reuse-detection alerts, single-device revocation is per-token not per-user.

## Permission matrix (enforced server-side; UI only hides)

| Action | ADMIN | MANAGER | EMPLOYEE |
|---|---|---|---|
| Manage users/roles | Yes | No | No |
| Employees | All | Direct reports only | Own only |
| Customers | Full | Read + create/update | Read |
| Products | Full | Read | Read |
| Projects | All | Own (manage) / member (view) | Member view |
| Tasks | All | Own projects (create/assign) | Own assigned (edit status) |
| Orders | Full | Create + status | No |
| Org reports | Yes | No (scoped only) | Own only |
| Notifications | Own | Own | Own |

See `docs/api/permissions.md` and `src/policies/access.ts`.

## API

Consistent envelope `{ success, data, pagination? }` / `{ success:false, error:{code,message,details} }`. No stack traces, hashes, or secrets leak. Pagination `?page&limit(max 100)&sort&search` + per-module filters. Status lifecycles: tasks `TODO→IN_PROGRESS→REVIEW→DONE`, orders `DRAFT→CONFIRMED→PROCESSING→COMPLETED` (+ `CANCELLED` branches). Orders snapshot `productName/unitPrice` and decrement stock (MVP, no distributed transaction claimed).

Full list: `docs/api/endpoints.md`.

## Project layout

```
apps/api/src/{config,database,errors,middleware,models,validators,services,controllers,routes,policies,utils,scripts}
apps/web/src/{app,layouts,pages,components,features/auth,services,hooks,types}
docs/{architecture,decisions,api}
```

## Testing

`apps/api/tests/security.test.ts` proves: unauthenticated blocked, no self-elevation, no cross-task edit, manager out-of-scope denied, manager ≠ admin, mass-assignment rejected, org reports blocked, pagination capped, invalid transitions rejected. Plus unit tests for transitions, subtotal, progress.

## Known limitations

- Order stock decrement is not transactional across replica sets; for correctness use Mongo transactions + reservations.
- No file uploads, email/push notifications (in-app only).
- Reports capped at 50 projects / top-20 workload for MVP performance.
