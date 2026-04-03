# Finance Management System — Evaluation Submission

This project is a comprehensive backend solution for a **Finance Data Processing and Access Control System**, built for performance, security, and maintainability.

---

## 🏛️ Project Architecture

The system follows a clean **Modular Architecture**, separating concerns into isolated layers:

- **Config Layer**: Centralized database connection and environment management.
- **Middleware Layer**: Reusable logic for Authentication (JWT) and RBAC (Role-Based Access Control).
- **Module Layer**: Domain-specific features (Auth, Users, Records, Dashboard) containing their own routes and services.
- **Utils Layer**: System-wide error handling (AppError) and validation schemas (Zod).

---

## 🚀 Key Features Meta (Evaluative Check)

| Requirement | Implementation Detail | Status |
|---|---|---|
| **User & Role Management** | JWT-based auth with `viewer`, `analyst`, and `admin` roles. | ✅ |
| **Active/Inactive Status** | Admins can deactivate users; auth middleware blocks inactive logins. | ✅ |
| **Financial Records** | Full CRUD for transactions with data persistence. | ✅ |
| **Access Control** | Enforced at the route level via RBAC middleware guards. | ✅ |
| **Dashboard Summary** | Aggregated APIs for Category totals, Net balance, and Trends. | ✅ |
| **Validation** | Strict schema validation using **Zod** for all inputs. | ✅ |
| **Error Handling** | Global middleware providing consistent JSON error responses. | ✅ |
| **Data Persistence** | **SQLite** (better-sqlite3) with WAL mode for performance. | ✅ |
| **Frontend UI** | Premium Role-Select landing + Real-time Dashboard. | ✅ |

---

## 🔒 Access Control Matrix

| Action | Viewer | Analyst | Admin | Implementation |
|---|:---:|:---:|:---:|---|
| Dashboard Overview | ✅ | ✅ | ✅ | `authenticate` |
| View Financial Records | ✅ | ✅ | ✅ | `authenticate` |
| View Insights (Trends) | ❌ | ✅ | ✅ | `requireMinRole('analyst')` |
| Create/Edit Records | ❌ | ✅ | ✅ | `requireMinRole('analyst')` |
| Soft-Delete Records | ❌ | ❌ | ✅ | `requireRole('admin')` |
| User Management | ❌ | ❌ | ✅ | `requireRole('admin')` |

---

## 🧩 Technical Decisions & Tradeoffs

### 1. Hard vs. Soft Deletes
I implemented **Soft Deletes** for financial records. Financial data is sensitive; hard-deleting records is often unacceptable in business auditing. Setting a `deleted_at` timestamp preserves history while removing the record from active UI views.

### 2. Stateless Auth + Stateful Checks
The system uses **JWT** for stateless authentication. However, to ensure that role changes or account deactivations (status: inactive) take effect *immediately*, the `authenticate` middleware re-validates the user against the database record after the token is decoded. This provides the security of sessions with the scalability of JWT.

### 3. Aggregated Dashboard Service
Instead of making the frontend calculate totals, the `dashboard.service.js` performs heavy **SQL aggregation** (SUM, CASE, GROUP BY). This reduces payload size and ensures "Single Source of Truth" for financial calculations.

### 4. Zero-Filled Trend Data
The Monthly Trends API uses a helper to "fill in the gaps" for months with zero income/expense. This ensures frontend charts always receive 12 data points, preventing layout shifts or "broken" looking charts.

---

## 🛠️ Setup & Execution

### 1. Prerequisites
- Node.js v18+
- npm

### 2. Installation
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
```

### 3. Initialize & Seed
```bash
# This creates the SQLite DB and populates demo users/records
npm run seed
```

### 4. Run
```bash
# Development mode
npm run dev

# Open in browser:
# http://localhost:3000/index.html
```

---

## 📜 API Documentation

### Auth
- `POST /api/auth/register` - New account creation.
- `POST /api/auth/login` - Returns JWT.
- `GET /api/auth/me` - Profile info.

### Financial Records
- `GET /api/records` - List with `type`, `category`, `date`, and `search` filters. (Paginated)
- `POST /api/records` - (Analyst+) Create record.
- `PUT /api/records/:id` - (Analyst+) Update record.
- `DELETE /api/records/:id` - (Admin) Soft-delete.

### Dashboard (Insights)
- `GET /api/dashboard/summary` - High-level cards.
- `GET /api/dashboard/trends?year=2024` - Monthly line chart data.
- `GET /api/dashboard/by-category` - Doughnut chart data.
- `GET /api/dashboard/weekly-trends` - Last 12 weeks bar chart data.

---

## 🧪 Validation & Reliability
The system handles bad input gracefully using:
- **Status Codes**: 400 (Bad Input), 401 (Unauth), 403 (Forbidden), 404 (Not Found), 409 (Conflict).
- **Consistency**: All error responses follow the `{ status: "error", message: "...", details: [] }` pattern.
- **Security**: **Helmet.js** is configured to set secure HTTP headers (CSP, HSTS, etc.).
