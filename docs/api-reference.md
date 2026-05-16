# API Reference

Base URL: `http://localhost:8080` (Docker: `http://localhost:8081`)

All endpoints (except `/api/auth/**` and `/health`) require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

---

## Authentication (`/api/auth`)

### POST `/api/auth/login`
Authenticate a user (LDAP or local).

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "username": "admin",
  "fullName": "System Administrator",
  "email": "admin@tora.local",
  "roles": ["ADMIN"],
  "teams": [
    { "id": 1, "name": "Yazılım Birimi" }
  ]
}
```

**Error (401):** Invalid credentials
**Error (429):** Rate limited (too many attempts)

---

### GET `/api/auth/me`
Get the current authenticated user's information.

**Response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@tora.local",
  "fullName": "System Administrator",
  "roles": ["ADMIN"],
  "teams": [
    { "id": 1, "name": "Yazılım Birimi", "color": "#cba6f7", "icon": "💻" }
  ]
}
```

---

### POST `/api/auth/register`
Create a local user account.

**Request Body:**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "fullName": "Test User",
  "password": "password123",
  "role": "YAZILIMCI"
}
```

---

### GET `/api/auth/users`
Get all users (basic info).

---

## Tasks (`/api/tasks`)

### GET `/api/tasks`
List tasks with optional filters.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `teamId` | Long | No | Filter by team ID |
| `year` | Integer | No | Filter by year |
| `month` | Integer | No | Filter by month (1-12) |
| `projectId` | Long | No | Filter by project ID |

**Response (200):** Array of `TaskDTO`
```json
[
  {
    "id": 1,
    "title": "Implement login page",
    "content": "Create the login page with form validation",
    "startDate": "2026-02-01",
    "endDate": "2026-02-15",
    "status": "IN_PROGRESS",
    "taskType": "FEATURE",
    "priority": "HIGH",
    "teamId": 4,
    "teamName": "Yazılım Birimi",
    "teamColor": "#cba6f7",
    "teamIcon": "💻",
    "projectId": 1,
    "projectName": "Portal v2",
    "createdBy": { "id": 1, "username": "admin", "fullName": "Admin" },
    "assignees": [
      { "id": 2, "username": "dev1", "fullName": "Developer 1" }
    ],
    "subtasks": [
      {
        "id": 1,
        "title": "Design mockup",
        "isCompleted": true,
        "assigneeId": 2
      }
    ],
    "isPostponed": false,
    "createdAt": "2026-01-15T10:30:00",
    "updatedAt": "2026-02-10T14:22:00"
  }
]
```

---

### GET `/api/tasks/{id}`
Get a single task by ID.

---

### POST `/api/tasks`
Create a new task.

**Request Body:**
```json
{
  "title": "Fix login bug",
  "content": "Users cannot login with special characters in password",
  "startDate": "2026-02-24",
  "endDate": "2026-02-28",
  "status": "OPEN",
  "taskType": "BUG",
  "priority": "URGENT",
  "teamId": 4,
  "projectId": 1,
  "assigneeIds": [2, 3],
  "subtasks": [
    {
      "title": "Reproduce the issue",
      "startDate": "2026-02-24",
      "endDate": "2026-02-25"
    }
  ]
}
```

---

### PUT `/api/tasks/{id}`
Update an existing task (full update).

---

### DELETE `/api/tasks/{id}`
Delete a task. Task logs are preserved with the task title.

---

### PUT `/api/tasks/{id}/status`
Update only the status of a task.

**Request Body:**
```json
{
  "status": "COMPLETED",
  "changeReason": "All subtasks finished",
  "postponedToDate": null
}
```

---

### GET `/api/tasks/date-range`
Get tasks within a date range.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `teamId` | Long | No | Filter by team ID |
| `startDate` | String | Yes | Start date (YYYY-MM-DD) |
| `endDate` | String | Yes | End date (YYYY-MM-DD) |

---

## Task Comments (`/api/tasks/{taskId}/comments`, `/api/comments/{id}`)

Yorumlar sadece görevin ait olduğu birime erişimi olan kullanıcılar tarafından
okunabilir/yazılabilir. `update` ve `delete` yalnızca yorumun yazarı veya `ADMIN`
rolündeki kullanıcılar tarafından yapılabilir.

İçerikteki `@kullaniciadi` formatındaki etiketler otomatik olarak parse edilir
ve `mentions` alanına eşlenmiş kullanıcılar olarak yansıtılır. Eşleşme bulunmayan
etiketler sessizce yok sayılır.

### GET `/api/tasks/{taskId}/comments`
Bir göreve ait tüm yorumları kronolojik sırayla döner.

**Response (200):**
```json
[
  {
    "id": 1,
    "taskId": 42,
    "authorId": 7,
    "authorUsername": "melda",
    "authorFullName": "Melda Betül KOCAMAN",
    "content": "@murat bu işe bakar mısın?",
    "isEdited": false,
    "mentions": [
      { "userId": 9, "username": "murat", "fullName": "Murat AKPINAR" }
    ],
    "createdAt": "2026-05-04T08:30:12",
    "updatedAt": "2026-05-04T08:30:12"
  }
]
```

### POST `/api/tasks/{taskId}/comments`
Göreve yeni yorum ekler.

**Request Body:**
```json
{
  "content": "Yorum metni — @kullaniciadi etiketleri otomatik algılanır."
}
```

**Validation:** `content` zorunludur, boş olamaz, en fazla 5000 karakter.

**Response (200):** Tek bir `TaskCommentDTO` (yukarıdaki yapı).

### PUT `/api/comments/{commentId}`
Yorumu günceller. Sadece yazar veya `ADMIN`. Güncellenen yorumda
`isEdited` `true` olur.

**Request Body:** `{ "content": "..." }` (POST ile aynı doğrulama).

### DELETE `/api/comments/{commentId}`
Yorumu siler. Sadece yazar veya `ADMIN`. **Response: 204 No Content.**

---

## Notifications (`/api/notifications`)

Bildirimler sadece sahibi tarafından okunabilir/işlenebilir. Sistem aşağıdaki
durumlarda otomatik bildirim üretir:

- `TASK_ASSIGNED` — yeni iş oluşturulduğunda veya kullanıcı sonradan eklendiğinde
- `TASK_STATUS_CHANGED` — durum değiştirildiğinde (atananlar + oluşturan)
- `TASK_DUE_SOON` — her gün 08:00'da bitiş tarihi yarın olan açık işler için
- `COMMENT_MENTION` — yorum içeriğinde `@kullaniciadi` ile bahsedildiğinde
- `COMMENT_ON_TASK` — atanan/oluşturan kullanıcılara yeni yorum bildirimi (mention edilen kullanıcı çift bildirim almaz)

### GET `/api/notifications?page=0&size=20`
Aktif kullanıcının bildirimlerini sayfalı şekilde, en yeniden eskiye döner.

**Response (200):**
```json
{
  "content": [
    {
      "id": 17,
      "type": "TASK_ASSIGNED",
      "title": "Yeni iş atandı",
      "message": "\"Bug fix\" işine atandınız.",
      "relatedTaskId": 42,
      "relatedTaskTitle": "Bug fix",
      "relatedCommentId": null,
      "actorUserId": 3,
      "actorUsername": "admin",
      "actorFullName": "System Administrator",
      "isRead": false,
      "createdAt": "2026-05-04T08:30:12",
      "readAt": null
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "unreadCount": 1
}
```

### GET `/api/notifications/unread-count`
Okunmamış bildirim sayısını döner. Frontend tarafından her ~30 sn'de polling
edilir; `X-Silent-Error: true` header'ı ile hatalarda global toast tetiklemez.

**Response (200):** `{ "unreadCount": 3 }`

### PUT `/api/notifications/{id}/read`
Tek bildirimi okundu işaretler. Sadece sahibi.

**Response (200):** Güncellenmiş `NotificationDTO`.

### PUT `/api/notifications/read-all`
Aktif kullanıcının tüm okunmamış bildirimlerini okundu yapar.

**Response (200):** `{ "updated": 7 }`

### DELETE `/api/notifications/{id}`
Tek bildirim siler. Sadece sahibi. **Response: 204 No Content.**

### DELETE `/api/notifications`
Aktif kullanıcının tüm bildirimlerini siler.

**Response (200):** `{ "removed": 12 }`

---

## Projects (`/api/projects`)

### GET `/api/projects`
List all accessible projects.

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Portal v2",
    "description": "Next generation portal",
    "startDate": "2026-01-01",
    "endDate": "2026-06-30",
    "status": "ACTIVE",
    "createdBy": { "id": 1, "fullName": "Admin" },
    "teams": [
      { "id": 4, "name": "Yazılım Birimi" }
    ],
    "taskCount": 25,
    "completedTaskCount": 10
  }
]
```

---

### GET `/api/projects/{id}`
Get project details including tasks and statistics.

---

### POST `/api/projects`
Create a new project.

**Request Body:**
```json
{
  "name": "Portal v2",
  "description": "Next generation portal",
  "startDate": "2026-01-01",
  "endDate": "2026-06-30",
  "teamIds": [4, 5]
}
```

---

### PUT `/api/projects/{id}`
Update a project.

---

### DELETE `/api/projects/{id}`
Delete a project (tasks are not deleted, only unlinked).

---

## Teams (`/api/teams`)

### GET `/api/teams`
List all accessible teams. Results vary by role:
- **ADMIN**: All active teams
- **BIRIM_AMIRI**: Teams where user is leader
- **Staff**: Teams where user is a member

---

### GET `/api/teams/{id}`
Get team details including member list.

---

## Dashboard (`/api/teams`)

### GET `/api/teams/{id}/dashboard`
Get dashboard statistics for a specific team.

**Response (200):**
```json
{
  "teamId": 4,
  "teamName": "Yazılım Birimi",
  "totalTasks": 150,
  "openTasks": 20,
  "inProgressTasks": 35,
  "completedTasks": 80,
  "postponedTasks": 10,
  "cancelledTasks": 3,
  "overdueTasks": 2,
  "completionRate": 53.3
}
```

---

### GET `/api/teams/dashboard`
Get dashboard statistics for all accessible teams.

---

### GET `/api/teams/{id}/dashboard/details`
Get detailed dashboard data including member list, leaderboard, and progress bars.

**Response (200):**
```json
{
  "stats": { ... },
  "members": [
    {
      "id": 2,
      "fullName": "Developer 1",
      "username": "dev1",
      "roles": ["YAZILIMCI"],
      "isLeader": false
    }
  ],
  "leaderboard": [
    {
      "userId": 2,
      "fullName": "Developer 1",
      "completedTasks": 25,
      "totalAssigned": 30
    }
  ]
}
```

---

### GET `/api/teams/dashboard/details`
Get detailed dashboard data for all accessible teams.

---

## Calendar (`/api/calendar`)

### GET `/api/calendar/{year}`
Get all tasks for a given year, grouped by month.

---

### GET `/api/calendar/{year}/{month}`
Get all tasks for a specific month.

---

## User Profile (`/api/users/me`)

### GET `/api/users/me/tasks`
Get all tasks assigned to the current user.

---

### PUT `/api/users/me/profile`
Update the current user's profile.

**Request Body:**
```json
{
  "fullName": "Updated Name"
}
```

---

### PUT `/api/users/me/password`
Change the current user's password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

## Admin - User Management (`/api/admin`) 🔒 ADMIN only

### GET `/api/admin/users`
List all users with full details.

### GET `/api/admin/users/{id}`
Get user by ID.

### POST `/api/admin/users`
Create a new user (admin).

**Request Body:**
```json
{
  "username": "newuser",
  "email": "new@example.com",
  "fullName": "New User",
  "password": "password123",
  "roleIds": [3],
  "teamIds": [4]
}
```

### PUT `/api/admin/users/{id}`
Update a user.

### DELETE `/api/admin/users/{id}`
Soft-delete a user (sets `isActive = false`).

### POST `/api/admin/users/{id}/password`
Change a user's password (admin override).

---

## Admin - Team Management (`/api/admin`) 🔒 ADMIN only

### GET `/api/admin/teams`
List all teams.

### GET `/api/admin/teams/{id}`
Get team by ID.

### POST `/api/admin/teams`
Create a team.

**Request Body:**
```json
{
  "name": "New Department",
  "description": "Department description",
  "color": "#89b4fa",
  "icon": "🖥️",
  "leaderId": 2
}
```

### PUT `/api/admin/teams/{id}`
Update a team.

### DELETE `/api/admin/teams/{id}`
Soft-delete a team (sets `isActive = false`).

---

## Admin - Role Management (`/api/admin`) 🔒 ADMIN only

### GET `/api/admin/roles`
List all roles.

### GET `/api/admin/roles/{id}`
Get role by ID.

### POST `/api/admin/roles`
Create a role.

### PUT `/api/admin/roles/{id}`
Update a role.

### DELETE `/api/admin/roles/{id}`
Delete a role.

---

## Admin - LDAP Settings (`/api/admin/ldap/settings`) 🔒 ADMIN only

### GET `/api/admin/ldap/settings`
Get current LDAP configuration.

### PUT `/api/admin/ldap/settings`
Update LDAP configuration.

**Request Body:**
```json
{
  "urls": "ldap://ldap-server:389",
  "base": "dc=company,dc=com",
  "username": "cn=admin,dc=company,dc=com",
  "password": "adminpassword",
  "userSearchBase": "ou=users",
  "userSearchFilter": "(uid={0})",
  "isEnabled": true
}
```

### POST `/api/admin/ldap/settings/test`
Test LDAP connection with provided settings.

### POST `/api/admin/ldap/settings/test/auto`
Test LDAP connection with currently saved settings.

---

## Admin - LDAP Import (`/api/admin/ldap`) 🔒 ADMIN only

### POST `/api/admin/ldap/search`
Search for users in LDAP directory.

**Request Body:**
```json
{
  "searchTerm": "john"
}
```

### POST `/api/admin/ldap/import`
Import an LDAP user into the local database.

---

## Admin - System Logs (`/api/admin/logs`) 🔒 ADMIN only

### GET `/api/admin/logs/system`
Get system logs with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `source` | String | `BACKEND` or `FRONTEND` |
| `level` | String | `INFO`, `WARN`, `ERROR`, `DEBUG` |
| `userId` | Long | Filter by user |
| `startDate` | String | Start date (ISO format) |
| `endDate` | String | End date (ISO format) |
| `page` | Integer | Page number (default: 0) |
| `size` | Integer | Page size (default: 50) |

### GET `/api/admin/logs/system/backend`
Get backend logs only.

### GET `/api/admin/logs/system/frontend`
Get frontend logs only.

### POST `/api/admin/logs/system/frontend`
Receive a log entry from the frontend.

**Request Body:**
```json
{
  "level": "ERROR",
  "message": "Unhandled promise rejection in DashboardView",
  "endpoint": "/dashboard",
  "exception": "TypeError: Cannot read property 'id' of undefined"
}
```

---

## Admin - Task Logs (`/api/admin/logs`) 🔒 ADMIN only

### GET `/api/admin/logs/tasks`
Get task audit logs with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `taskId` | Long | Filter by task |
| `userId` | Long | Filter by user who made the change |
| `action` | String | `CREATED`, `UPDATED`, `DELETED`, `STATUS_CHANGED`, `ASSIGNEE_ADDED`, `ASSIGNEE_REMOVED` |
| `startDate` | String | Start date |
| `endDate` | String | End date |
| `page` | Integer | Page number |
| `size` | Integer | Page size |

### GET `/api/admin/logs/tasks/user/{userId}`
Get all task operations by a specific user.

---

## Admin - System Health (`/api/admin/health`) 🔒 ADMIN or BIRIM_AMIRI

### GET `/api/admin/health`
Get detailed system health status.

**Response (200):**
```json
{
  "backend": { "status": "UP", "responseTime": 5 },
  "database": { "status": "UP", "responseTime": 12 },
  "frontend": { "status": "UP", "responseTime": 150 }
}
```

---

## Health Check (`/health`)

### GET `/health`
Basic health check (no auth required).

**Response (200):**
```json
{
  "status": "UP"
}
```

---

## Error Responses

All endpoints return standard error format:

```json
{
  "timestamp": "2026-02-24T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed: title must not be blank",
  "path": "/api/tasks"
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
