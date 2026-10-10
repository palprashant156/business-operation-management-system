# Decisions

## ADR-001 Monorepo with npm workspaces
`apps/api`, `apps/web`. No Turborepo/Nx yet — unnecessary for MVP team-of-one.

## ADR-002 TypeScript strict, no `any`
`strict:true`; `exactOptionalPropertyTypes` off to reduce friction. `any` banned without documented reason; services use explicit DTO types.

## ADR-003 Zod at boundary + Mongoose in depth
Zod validates body/query (strict, rejects operators); Mongoose enforces schema/index constraints. Never `findByIdAndUpdate(id, req.body)`.

## ADR-004 JWT access (15m) + rotating refresh (7d HttpOnly cookie)
Avoids long-lived localStorage tokens. Refresh stored as SHA-256 hash for revocation/rotation. CSRF mitigated via SameSite=Lax + origin allowlist; no cross-site writes by design.

## ADR-005 bcryptjs cost 12
Pure-JS, zero native build (vs argon2). Adequate for portfolio + local dev.

## ADR-006 Offset pagination, limit ≤ 100
`?page&limit&sort&search`. Simple, predictable. Cursor pagination deferred until collection growth demands it.

## ADR-007 mongodb-memory-server for tests
Zero external DB for CI; integration tests prove 7 authorization boundaries.
