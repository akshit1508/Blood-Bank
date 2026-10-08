# REST API Specification & Endpoint Map

## 1. API Architecture & Standards
The Blood Bank REST API is built in NestJS, accessible at the `/api` root prefix. 

### Core Protocol Standards
- **Transport**: JSON over HTTPS / HTTP.
- **Header Standards**: `Content-Type: application/json`, `Accept: application/json`.
- **Authentication**: Bearer JWT tokens in `Authorization: Bearer <token>` for all protected management endpoints.
- **Public Endpoints**: Completely unauthenticated; require no Authorization header.
- **DTO Validation**: Every incoming mutation (`POST`, `PUT`, `PATCH`) is strictly validated against TypeScript Data Transfer Objects using `class-validator` and `class-transformer`. Unrecognized fields are stripped (`whitelist: true`) or rejected (`forbidNonWhitelisted: true`).
- **Response Format**: Predictable standard responses:
  ```json
  {
    "statusCode": 200,
    "data": { ... },
    "message": "Optional human-readable notification",
    "timestamp": "2026-10-07T12:00:00.000Z"
  }
  ```
- **Error Format**: NestJS standard exception envelope:
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": ["bloodGroup must be a valid enum value"],
    "timestamp": "2026-10-07T12:00:00.000Z"
  }
  ```

---

## 2. Planned API Endpoint Map

> **Status Indicator**:
> - `[ACTIVE - PHASE 0]`: Live baseline endpoint implemented in the foundation.
> - `[PLANNED]`: Architectural blueprint to be implemented in its designated vertical slice. Do not call before corresponding phase completion.

### 2.1 System Foundation Endpoints
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/health` | Public | **[ACTIVE - PHASE 0]** | Service health status, phase indicator, and uptime. |

---

### 2.2 Authentication & User Management (`/api/auth`, `/api/users`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Public | `[PLANNED]` | Staff login with email and password; returns JWT. |
| `GET` | `/api/auth/me` | Staff | `[PLANNED]` | Returns authenticated staff profile and permissions. |
| `POST` | `/api/auth/refresh` | Staff | `[PLANNED]` | Refresh active JWT token. |
| `GET` | `/api/users` | Admin | `[PLANNED]` | List all blood bank staff accounts. |
| `POST` | `/api/users` | Admin | `[PLANNED]` | Create new staff account with role. |

---

### 2.3 Blood Requests (`/api/blood-requests`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/blood-requests` | Public | **[ACTIVE - PHASE 1]** | Submit public blood request form; returns unique tracking code & initial `REQUESTED` status. |
| `GET` | `/api/blood-requests` | Staff / Admin | **[ACTIVE - PHASE 1]** | Query blood requests with optional `?status=` and `?bloodGroup=` filters. *(Security Note: Accessible to management queue. Role-based Guard enforcement pending Auth vertical slice).* |
| `GET` | `/api/blood-requests/:id` | Staff / Admin | **[ACTIVE - PHASE 1]** | Retrieve single blood request by MongoDB `_id` or tracking code. *(Security Note: Contains clinical/patient data; strictly designated for management triage).* |
| `PATCH` | `/api/blood-requests/:id/status` | Staff / Admin | **[ACTIVE - PHASE 1]** | Advance or terminate request lifecycle with audit reason, strictly validating state transitions. |

> [!WARNING] **Security Boundary & Auth Blocker**
> The read/mutation endpoints `GET /api/blood-requests`, `GET /api/blood-requests/:id`, and `PATCH /api/blood-requests/:id/status` are designated strictly for internal staff/admin operation because they contain sensitive patient and medical data. Currently, the admin UI consumes them directly while full authentication guards (JWT + RBAC) await implementation in the upcoming Auth slice. Do not expose request listings to anonymous public visitors.

---

### 2.4 Donors (`/api/donors`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/donors` | Public | **[ACTIVE - PHASE 3.5]** | Voluntary donor self-registration. Validates payload, checks duplicate phone, enforces age eligibility (18–65 years; rejects < 18 or > 65 with HTTP 400 `DONOR_AGE_NOT_ELIGIBLE`), generates `donorCode`, initializes status to `PENDING_REVIEW`. Returns receipt with review confirmation message. |
| `GET` | `/api/donors` | Staff / Admin | **[ACTIVE - PHASE 2/3 REFINED]** | Search and filter registered donors (`?search=`, `?bloodGroup=`, `?status=PENDING_REVIEW|ACTIVE|INACTIVE`). *(Security Note: Internal management only; Auth guards pending).* |
| `GET` | `/api/donors/:id` | Staff / Admin | **[ACTIVE - PHASE 2/3 REFINED]** | Retrieve single donor profile by MongoDB `_id` or `donorCode`. *(Security Note: Contains personal contact data; Internal management only).* |
| `PATCH` | `/api/donors/:id/status` | Staff / Admin | **[ACTIVE - PHASE 2/3 REFINED]** | Update donor status enforcing valid administrative transitions (`PENDING_REVIEW` &rarr; `ACTIVE`/`INACTIVE`, `ACTIVE` &rarr; `INACTIVE`, `INACTIVE` &rarr; `ACTIVE`). |

> [!WARNING] **Security Boundary & Auth Blocker**
> The endpoints `GET /api/donors`, `GET /api/donors/:id`, and `PATCH /api/donors/:id/status` return personal contact and identification details of registered donors. They are strictly designated for internal staff use and must not be exposed to anonymous public users. Full JWT role guards are pending the dedicated Auth vertical slice.

---

### 2.5 Blood Availability & Public Metrics (`/api/availability`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/availability` | Public | `[PLANNED]` | Aggregated usable counts by blood group & component. |
| `GET` | `/api/availability/summary` | Public | `[PLANNED]` | High-level stock status (Adequate, Low, Critical) for public home page. |

---

### 2.6 Donations (`/api/donations`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/donations` | Staff / Admin | **[ACTIVE - PHASE 3.5]** | Record physical donation event. Validates that referenced donor exists AND has `status: ACTIVE`. Validates collection date is not in future. For whole-blood donations, validates required interval from last completed donation (90 days for Male, 120 days for Female/Other); rejects with HTTP 400 `DONATION_INTERVAL_NOT_COMPLETED` containing `lastDonationDate`, `nextEligibleDate`, and `remainingDays`. Generates `donationCode`, initializes status to `RECORDED`. |
| `GET` | `/api/donations` | Staff / Admin | **[ACTIVE - PHASE 3 REFINED]** | Query paginated donations with filters (`?donorId=`, `?search=`, `?status=`, `?bloodGroup=`, `?donationType=`, `?page=`, `?limit=`). Used for both global management and donor profile donation history. |
| `GET` | `/api/donations/:id` | Staff / Admin | **[ACTIVE - PHASE 3]** | Retrieve single donation record by MongoDB `_id` or `donationCode` with populated donor details. |
| `PATCH` | `/api/donations/:id/status` | Staff / Admin | **[ACTIVE - PHASE 3]** | Transition donation status enforcing strict state machine (`RECORDED` &rarr; `PROCESSING` &rarr; `COMPLETED`, or `CANCELLED`). |

> [!WARNING] **Security Boundary & Auth Blocker**
> The entire `/api/donations` route is strictly an internal clinical/management operation. There is no anonymous public access. Donation collection events and donor links must not be exposed publicly. Full JWT + RBAC guard enforcement is planned for the upcoming Auth vertical slice.

---

### 2.7 Blood Units & Inventory Lifecycle (`/api/blood-units`, `/api/inventory`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/blood-units` | Staff | `[PLANNED]` | Register barcode and component attributes for collected unit. |
| `GET` | `/api/blood-units/:unitNumber` | Staff | `[PLANNED]` | Lookup unit details by barcode. |
| `GET` | `/api/inventory` | Staff | `[PLANNED]` | Full inventory grid across all states (Quarantine, Available, Reserved). |
| `GET` | `/api/inventory/expiring` | Staff | `[PLANNED]` | Units nearing expiry within configurable warning days. |

---

### 2.8 Testing & Laboratory Screening (`/api/testing`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/testing/pending` | Staff (Lab) | `[PLANNED]` | Queue of blood units awaiting laboratory testing. |
| `POST` | `/api/testing/:unitId` | Staff (Lab) | `[PLANNED]` | Submit serology/virology markers; executes Approve/Reject transition. |
| `GET` | `/api/testing/:unitId` | Staff (Lab) | `[PLANNED]` | Detailed lab test report for a unit. |

---

### 2.9 Reservations & Allocations (`/api/reservations`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/reservations` | Staff | `[PLANNED]` | Reserve specific approved unit for an approved request. |
| `DELETE` | `/api/reservations/:id` | Staff | `[PLANNED]` | Release reservation back to available inventory. |
| `GET` | `/api/reservations/active` | Staff | `[PLANNED]` | List all current unit reservations and expiration windows. |

---

### 2.10 Blood Issue & Dispensing (`/api/blood-issues`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/blood-issues` | Staff | `[PLANNED]` | Dispense reserved unit; updates inventory to `ISSUED` and prints receipt. |
| `GET` | `/api/blood-issues/:voucherCode`| Staff | `[PLANNED]` | Lookup issue certificate and recipient audit verification. |

---

### 2.11 Campaigns & Community Drives (`/api/campaigns`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/campaigns/upcoming` | Public | `[PLANNED]` | Public schedule of mobile camps and donation drives. |
| `POST` | `/api/campaigns/:id/register` | Public | `[PLANNED]` | Register citizen attendance pledge for a campaign. |
| `POST` | `/api/campaigns` | Staff | `[PLANNED]` | Create new donation campaign drive. |
| `GET` | `/api/campaigns/:id/metrics` | Staff | `[PLANNED]` | Campaign statistics (registrations vs. units collected). |

---

### 2.12 Dashboard, Audit & Reports (`/api/dashboard`, `/api/audit-logs`, `/api/reports`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/dashboard/stats` | Staff | `[PLANNED]` | Aggregated operational KPI metrics for admin overview. |
| `GET` | `/api/audit-logs` | Admin | `[PLANNED]` | Immutable audit log trail with actor and entity filters. |
| `GET` | `/api/reports/monthly` | Staff | `[PLANNED]` | Monthly collection, discard, and issuance statistics. |
