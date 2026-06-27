# Frontend Architecture

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.0 | Build tool & dev server |
| React Router | 6.20 | Client-side routing |
| Axios | 1.6 | HTTP client |
| date-fns | 2.30 | Date manipulation |
| react-icons | 5.5 | Icon library |

---

## Directory Structure

```
Frontend/src/
├── components/           # Reusable UI components
│   ├── admin/            # Admin panel components
│   │   ├── LdapImport        # LDAP user search & import
│   │   ├── RoleManagement     # Role CRUD
│   │   ├── SystemHealth       # Health monitoring dashboard
│   │   ├── SystemLogs         # System log viewer with filters
│   │   ├── TaskLogs           # Task audit log viewer
│   │   ├── TeamManagement     # Team CRUD
│   │   ├── TeamModal          # Team create/edit dialog
│   │   ├── SlaManagement      # SLA policy CRUD + compliance summary
│   │   ├── UserManagement     # User CRUD
│   │   └── UserModal          # User create/edit dialog
│   ├── calendar/         # Calendar & view components
│   │   ├── CalendarView       # Monthly calendar grid
│   │   ├── GanttChartView     # Timeline-based Gantt chart
│   │   ├── KanbanBoardView    # Status-based Kanban board
│   │   ├── MonthView          # 12-month overview grid
│   │   ├── TaskCard           # Task display card
│   │   ├── TeamPlannerView    # Team planning view
│   │   └── WeekView           # Weekly task view
│   ├── notifications/    # Bildirim bileşenleri
│   │   ├── NotificationBell   # Header'daki zil ikonu + okunmamış sayısı (30s polling)
│   │   └── NotificationPanel  # Bildirim listesi dropdown (okundu yap, sil, sayfalama, okunmuş=soluk/okunmamış=canlı)
│   ├── common/           # Shared components
│   │   ├── ConfirmDialog      # Reusable confirmation dialog
│   │   ├── LoadingSpinner     # Boyut/label destekli yüklenme göstergesi
│   │   └── Toast              # Global toast bildirim sistemi (success/error/warn/info)
│   ├── dashboard/        # Dashboard components
│   │   └── TeamDashboard      # Team stats, charts, leaderboard
│   ├── layout/           # App layout components
│   │   ├── Header             # Top bar (year selector, user, admin link)
│   │   └── Sidebar            # Left navigation (teams, views)
│   ├── profile/          # User profile components
│   │   └── UserProfile        # Profile view & edit
│   ├── project/          # Project components
│   │   └── ProjectModal       # Project create/edit dialog
│   └── task/             # Task components
│       ├── TaskModal          # Task create/edit dialog with subtasks + "Tamamlanınca açılacak işler" (zincir) + kaynak rozeti
│       └── TaskComments       # Yorum listesi + @mention destekli yorum formu
├── context/              # React Context providers
│   ├── AuthContext.tsx         # Authentication state management
│   └── ThemeContext.tsx        # Dark/Light theme toggle (Catppuccin Mocha/Latte, localStorage)
├── hooks/                # Custom React hooks
│   ├── useAuth.ts             # Auth context consumer hook
│   ├── useSidebar.ts          # Sidebar toggle state (localStorage)
│   ├── useTasks.ts            # Task fetching with loading/error
│   └── useNotifications.ts    # Bildirim listesi + polling (30s aralık)
├── pages/                # Page-level route components
│   ├── LoginPage              # Login form (LDAP/Standard tabs)
│   ├── CalendarPage           # Main view with view mode switcher
│   ├── DashboardPage          # Dashboard with team stats overview
│   ├── ProjectsPage           # Project list with filters
│   ├── ProjectDetailPage      # Single project with Gantt & tasks
│   ├── AdminPanelPage         # Admin panel with tabbed interface
│   ├── UserProfilePage        # User profile (Dashboard/Settings tabs, login history)
│   ├── ReportsPage            # Reports & analytics (performance, productivity, Excel export)
│   ├── ErrorPage              # 403 / 500 / network error pages
│   └── NotFoundPage           # 404 page
├── services/             # API service modules
│   ├── api.ts                 # Axios instance with interceptors
│   ├── authService.ts         # Login, logout, getCurrentUser
│   ├── taskService.ts         # Task CRUD, status updates
│   ├── projectService.ts      # Project CRUD
│   ├── teamService.ts         # Team operations
│   ├── userService.ts         # User profile operations
│   ├── adminService.ts        # Admin user/team/role operations
│   ├── dashboardService.ts    # Dashboard statistics
│   ├── calendarService.ts     # Calendar data
│   ├── notificationService.ts # Bildirim CRUD (liste, okundu, sil)
│   ├── searchService.ts       # Global search (/api/search)
│   ├── reportService.ts       # Reports & Excel export (/api/reports)
│   ├── slaService.ts          # SLA policy CRUD + compliance (/api/admin/sla-policies, /api/reports/sla)
│   ├── taskCommentService.ts  # Görev yorumları CRUD
│   ├── taskLabelService.ts    # Görev etiketleri arama (/api/task-labels)
│   ├── logService.ts          # System & task log operations
│   ├── ldapService.ts         # LDAP import operations
│   ├── ldapSettingsService.ts # LDAP settings management
│   └── systemHealthService.ts # System health checks
├── styles/               # Global styles
│   └── catppuccin-mocha.css   # Theme CSS custom properties
├── types/                # TypeScript type definitions
│   ├── Task.ts                # Task, Subtask, TaskStatus, etc.
│   ├── Notification.ts        # AppNotification, NotificationType
│   ├── Project.ts             # Project types
│   ├── Team.ts                # Team types
│   ├── User.ts                # User types
│   ├── Calendar.ts            # Calendar view types
│   ├── Dashboard.ts           # Dashboard stat types
│   ├── Admin.ts               # Admin panel types
│   ├── Log.ts                 # Log types
│   └── SystemHealth.ts        # Health check types
├── utils/                # Utility functions
│   ├── dateUtils.ts           # Date formatting helpers
│   ├── errorLogger.ts         # Frontend error logging to backend
│   ├── errorMessages.ts       # API hata mesajı çıkarma yardımcısı
│   ├── formValidation.ts      # Form alanı doğrulama kuralları
│   ├── jwtUtils.ts            # JWT token parsing & expiry check
│   └── statusColors.ts        # Task status → color mapping
├── App.tsx               # Root component with routing (React.lazy + Suspense)
├── App.css               # Global app styles
├── main.tsx              # Entry point
└── index.css             # Base CSS reset & global styles
```

---

## Routing

| Path | Page | Auth | Role | Description |
|------|------|------|------|-------------|
| `/login` | LoginPage | Public | — | Login (redirects to `/` if authenticated) |
| `/` | CalendarPage | Required | Any | Main calendar view (default) |
| `/dashboard` | DashboardPage | Required | Any | Team dashboard overview |
| `/projects` | ProjectsPage | Required | Any | Project list |
| `/projects/:id` | ProjectDetailPage | Required | Any | Project detail view |
| `/admin` | AdminPanelPage | Required | ADMIN | Admin panel |
| `/profile` | UserProfilePage | Required | Any | User profile (Dashboard / Settings tabs, login history, active sessions) |
| `/reports` | → `/dashboard` | Required | Any | Redirect (reports surfaced within the dashboard) |
| `/403`, `/500`, `/network-error` | ErrorPage | — | — | Dedicated error pages |
| `*` | NotFoundPage | — | — | 404 catch-all |

> An `ErrorBoundary` wraps the app and routes uncaught render errors to `ErrorPage`.

Route protection is implemented via wrapper components in `App.tsx` that check `AuthContext`.

All pages except `LoginPage` are loaded with `React.lazy()` + `<Suspense>` for route-level code splitting. Vite bundles them into separate chunks (`vendor-react`, `vendor-date`, `vendor-http`) via `manualChunks` in `vite.config.ts`.

---

## State Management

### Authentication (Context API)

`AuthContext.tsx` provides global auth state:

| Property / Method | Type | Description |
|-------------------|------|-------------|
| `user` | `User \| null` | Current authenticated user |
| `loading` | `boolean` | Auth loading state |
| `login(username, password)` | `async function` | Authenticate and store token |
| `logout()` | `function` | Clear token and redirect to login |
| `isAuthenticated` | `boolean` | Whether user is logged in |
| `hasRole(role)` | `function` | Check if user has a specific role |

**Token management:**
- Access token + refresh token stored in `localStorage`
- Access token attached to every API request via Axios request interceptor
- A 60s interval in `AuthContext` proactively refreshes ~5 min before expiry (and once on expiry) via `POST /api/auth/refresh` (refresh token is rotated)
- Auto-logout when the refresh token is also expired/invalid

### Component-Level State

Individual components use `useState` for local state. No global state library (Redux, Zustand) is used — the app relies on prop drilling and context.

### Sidebar State

`useSidebar` hook manages sidebar collapse state persisted to `localStorage`.

---

## API Layer

### Axios Configuration (`services/api.ts`)

```
Base URL: /api (proxied by Vite dev server or Nginx)

Request Interceptor:
  → Reads JWT from localStorage
  → Adds "Authorization: Bearer <token>" header

Response Interceptor:
  → 401 on /auth/me → clear token + redirect to /login
  → 401 elsewhere → "session expired" toast
  → 403 → "yetkiniz yok" toast
  → 5xx / network error → error toast
  (X-Silent-Error: true header suppresses the toast, e.g. for polling)
```

> Token refresh is driven by `AuthContext`, not the interceptor: a 60-second interval proactively refreshes the access token ~5 min before expiry (and once more on expiry) via `authService.refreshAccessToken()` → `POST /api/auth/refresh`.

### Service Pattern

Each domain has a dedicated service file:

```typescript
// Example: taskService.ts
import api from './api';

export const getTasks = (params) => api.get('/tasks', { params });
export const getTaskById = (id) => api.get(`/tasks/${id}`);
export const createTask = (data) => api.post('/tasks', data);
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);
export const updateTaskStatus = (id, data) => api.put(`/tasks/${id}/status`, data);
```

---

## Theme & Styling

### Catppuccin Mocha

The application uses the [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) dark color palette, defined as CSS custom properties in `styles/catppuccin-mocha.css`.

**Key colors:**

| Variable | Hex | Usage |
|----------|-----|-------|
| `--ctp-base` | #1e1e2e | Main background |
| `--ctp-mantle` | #181825 | Sidebar / deeper background |
| `--ctp-crust` | #11111b | Darkest background |
| `--ctp-surface0` | #313244 | Card / elevated surfaces |
| `--ctp-surface1` | #45475a | Hover states |
| `--ctp-text` | #cdd6f4 | Primary text |
| `--ctp-subtext0` | #a6adc8 | Secondary text |
| `--ctp-blue` | #89b4fa | Primary accent, links |
| `--ctp-green` | #a6e3a1 | Success, completed |
| `--ctp-yellow` | #f9e2af | Warning, open tasks |
| `--ctp-red` | #f38ba8 | Error, urgent, overdue |
| `--ctp-peach` | #fab387 | Postponed items |
| `--ctp-mauve` | #cba6f7 | Feature type accent |

### Task Status Colors

Defined in `utils/statusColors.ts` (`getStatusColor` / `getStatusLabel`):

| Status | Hex | Visual | Label |
|--------|-----|--------|-------|
| OPEN | `#f5e0dc` | Rosewater | Açık |
| IN_PROGRESS | `#89dceb` | Sky | Yapılıyor |
| TESTING | `#cba6f7` | Mauve | Test Aşamasında |
| COMPLETED | `#94e2d5` | Teal | Tamamlandı |
| CANCELLED | `#7f849c` | Overlay1 | İptal Edildi |

> `POSTPONED` / `OVERDUE` were removed from the `TaskStatus` enum (backend V18); the frontend no longer renders them.

### Priority Icons
| Priority | Icon | Color |
|----------|------|-------|
| NORMAL | ⚪ | Gray |
| HIGH | 🟠 | Yellow |
| URGENT | 🔴 | Red |

### Typography
- **Primary Font**: Cascadia Mono (Nerd Font variants)
- Monospaced throughout for a clean, technical look

### Styling Approach
- **Component-scoped CSS**: Each component has its own `.css` file
- **CSS Custom Properties**: Theme values defined globally, consumed by components
- **No CSS-in-JS**: Pure CSS files, no styled-components or emotion
- **Responsive Design**: Media queries for desktop (4 cols), tablet (2-3 cols), mobile (1 col)

---

## View Modes

### Calendar View
- Monthly grid with day cells
- Tasks displayed as colored blocks within day cells
- Weekend days rendered with reduced opacity
- Click on a task to open the task modal

### Gantt Chart View
- Horizontal timeline with week selection
- Tasks shown as bars spanning start → end date
- Hierarchical subtask support
- Responsive scaling based on viewport

### Kanban Board View
- Columns per task status (OPEN, IN_PROGRESS, TESTING, COMPLETED, etc.)
- Task cards in each column
- Per-team filtering
- Responsive column layout

### Month Overview
- 12-month grid with seasonal colors
- Quick stats per month (task counts by status)
- Click a month to navigate to detailed view

### SLA Badge
Task cards show a colored SLA chip when the task has an SLA: `SLA: zamanında` (ON_TRACK, green), `SLA: riskli` (AT_RISK, peach), `SLA: aşıldı` (BREACHED, red), `SLA ✓` (MET, teal). Admin panel → **SLA** tab manages policies and shows the compliance summary. The Reports task-list table (Excel export and PDF/print) includes a colored **SLA** column (Zamanında/Riskli/Aşıldı/Karşılandı).

### Task List View (`TaskListView`)
- Table-based list with columns: title, project, assignee, label, priority, status, dates
- Client-side pagination: 20 rows/page, page controls + "X–Y / total" counter
- Page resets automatically on month/week/task filter change
- Subtask expand/collapse support
- **Bulk operations**: row checkboxes + select-all; a bulk bar applies status change / assign (add) / delete to the selected tasks via `POST /api/tasks/bulk` (delete shown only to ADMIN/BIRIM_AMIRI), then refreshes the list

### Notification System
- `NotificationBell` in header: okunmamış sayısı badge, 30s polling
- `NotificationPanel` dropdown: tüm bildirimler, okunmuş=soluk/okunmamış=canlı renk
- Timestamp UTC düzeltmesi: backend `LocalDateTime` (timezone'suz) `Z` eklenerek UTC olarak yorumlanır
- Bildirim tipleri: `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `TASK_DUE_SOON`, `COMMENT_MENTION`, `COMMENT_ON_TASK`

### Bağlı Commit / MR Paneli (TaskModal)
Görev modalı, görevin `gitLinks` alanı doluysa **"Bağlı commit / MR"** salt-okur paneli gösterir (boşsa render edilmez). Her satır: `platform/externalId` (MR için `!42`, commit için kısa SHA), MR durum rozeti (`OPENED`/`MERGED`/`CLOSED`), tıklanır URL (yeni sekme) ve yazar. Veri backend `TaskDTO.gitLinks` üzerinden gelir (webhook ile `task_git_links`'e yazılır).

### Admin → Git Entegrasyonu (`components/admin/GitSettings.tsx`)
Yönetim Paneli'nde **"Git Entegrasyonu"** sekmesi: aç/kapa toggle, webhook secret input (boş = değiştirme; `secretConfigured` rozetli), 3 durum-senkron dropdown (MR açıldı / MR merge / push → ilk seçenek "Değiştirme"), ve platform başına webhook URL gösterimi (`/api/webhooks/git/{github|gitlab|gitea}`). `GET/PUT /api/admin/git/settings` (`api` instance). Status seçenekleri `TaskStatus` enum'uyla eşleşir (`OPEN`, `IN_PROGRESS`, `TESTING`, `COMPLETED`, `CANCELLED`).

---

## Error Handling

### Frontend Error Logger (`utils/errorLogger.ts`)
- Captures unhandled errors and sends them to `POST /api/admin/logs/system/frontend`
- Includes: error message, stack trace, current route, user info
- Stored in the `system_logs` table with source `FRONTEND`

### API Error Handling
- Axios response interceptor catches 401/403 errors globally
- Individual components handle other errors with local state
- Error messages displayed in UI with appropriate styling

---

## Build & Deploy

### Development
```bash
npm run dev          # Start Vite dev server (port 5173)
```

### Production Build
```bash
npm run build        # Output to dist/
npm run preview      # Preview production build locally
```

### Docker Build
The `Frontend/Dockerfile` performs a multi-stage build:
1. **Build stage**: `node:20-alpine` — installs deps, runs `npm run build`
2. **Serve stage**: `nginx:alpine` — serves the `dist/` directory

Nginx is configured to route all paths to `index.html` (SPA fallback) and proxy `/api` requests to the backend service.
