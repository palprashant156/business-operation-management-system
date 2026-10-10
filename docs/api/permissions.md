# Permission matrix (source of truth; code: `policies/access.ts` + service guards)

| Action | ADMIN | MANAGER | EMPLOYEE |
|---|---|---|---|
| List users / change roles | Yes | No | No |
| Create/deactivate employees | Yes | No | No |
| View employees | All | Direct reports (`managerId==self`) + self | Self only |
| Customers create/update | Yes | Yes | No (read allowed) |
| Products create/update/stock | Yes | No (read) | No (read) |
| Projects create | Yes | Yes (becomes owner) | No |
| Projects view | All | Owned or member | Member only |
| Projects edit/add members | All | Owned only | No |
| Tasks create/assign | All | Owned projects, assignee ∈ members | No |
| Tasks edit fields | All | Managed tasks | Own assigned only |
| Tasks status | All (any valid transition) | Managed + own | Own assigned, valid transition |
| Orders create/status | Yes | Yes | No |
| Reports org-wide | Yes | No | No |
| Reports scoped | Yes | Owned projects / team counts | Own tasks |
| Notifications | Own only | Own only | Own only |

Rules: frontend `Shell`/`RequireAuth` hide navigation; backend re-checks every `:id` (IDOR defense). `role`, `ownerId`, `managerId`, `createdBy`, `passwordHash` never accepted from generic PATCH (Zod `.strict()` + allowlisted `$set`).
