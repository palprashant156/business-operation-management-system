# Architecture

Modular monolith. One Express deployable, one React SPA, one MongoDB.

```
React + Vite + TS → API client (fetch, credentials:include, single refresh retry)
→ Express: Route → requireAuth → requireRole/policy → Zod validate → Controller → Service → Mongoose → MongoDB
```

- Routes: HTTP mapping only.
- `requireAuth`: verifies access JWT (header or cookie), sets `req.user`.
- Policies (`policies/access.ts`): `canViewProject`, `canManageProject`, `canAssignTask`, resource-level checks. No scattered `role==='ADMIN'`.
- Validators (Zod `.strict()`): reject unknown keys incl. `role`, `ownerId`, `createdBy` — mass-assignment guard.
- Controllers: translate HTTP ↔ service, consistent `{success,data}` envelope.
- Services: business rules (transitions, snapshots, scoping, notifications).
- Models: schema constraints + indexes for real query patterns.
- Middleware: helmet, restrictive CORS (`CLIENT_ORIGIN`), JSON limit 100kb, auth rate limits, centralized `errorHandler` (Zod→400, AppError passthrough, duplicate→409, else 500 without internals).

Frontend: role-adaptive nav (`Shell`), `RequireAuth` guards navigation only; backend is authoritative. Forms use React Hook Form + Zod; data via `usePaged` + `api()` client.
