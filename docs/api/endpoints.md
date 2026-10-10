# API endpoints (MVP contract)

Base: `/api`. Auth: `Authorization: Bearer <access>` or HttpOnly cookie; `credentials:include`.

- `GET /health`
- Auth: `POST /auth/register|login|refresh|logout`, `GET /auth/me`
- Users (ADMIN): `GET /users`, `GET /users/:id`, `PATCH /users/:id {name,status}`, `PATCH /users/:id/role {role}`
- Employees: `GET /employees?status&department&search`, `POST /employees` (ADMIN), `GET /employees/:id`, `PATCH /employees/:id`
- Customers: `GET /customers`, `POST /customers` (ADMIN/MANAGER), `GET /customers/:id`, `PATCH /customers/:id`
- Products: `GET /products`, `POST /products` (ADMIN), `GET /products/:id`, `PATCH /products/:id`
- Projects: `GET /projects`, `POST /projects` (ADMIN/MANAGER), `GET /projects/:id` (+progress), `PATCH /projects/:id` (owner/admin), `POST /projects/:id/members`
- Tasks: `GET /tasks?status&priority&projectId&assigneeId`, `POST /tasks` (ADMIN/MANAGER), `GET /tasks/:id`, `PATCH /tasks/:id`, `PATCH /tasks/:id/status`, `PATCH /tasks/:id/assignee`, `POST /tasks/:id/comments`
- Orders (ADMIN/MANAGER): `GET /orders`, `POST /orders {customerId, items:[{productId,quantity}]}`, `GET /orders/:id`, `PATCH /orders/:id/status`
- Reports: `GET /reports/tasks|projects|workload|orders` (scoped pre-aggregation)
- Notifications: `GET /notifications?status=unread`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`

Errors: `{success:false,error:{code,message,details}}`, codes `VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|RATE_LIMITED|INTERNAL_ERROR`.
