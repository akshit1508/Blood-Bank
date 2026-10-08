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

### 2.7 Blood Units (`/api/blood-units`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/blood-units` | Staff / Lab | **[ACTIVE - PHASE 4A]** | Creates an individual physical Blood Unit from a valid `COMPLETED` donation. Enforces 1 donation → 1 unit uniqueness (`BLOOD_UNIT_ALREADY_EXISTS`), sets status to `TESTING`, authoritatively derives `donorId`, `bloodGroup`, and `collectionDate`. |
| `GET` | `/api/blood-units` | Staff / Lab | **[ACTIVE - PHASE 4A]** | Internal query of blood units with pagination and filters (`?status=`, `?bloodGroup=`, `?componentType=`, `?donorId=`, `?donationId=`, `?page=`, `?limit=`). Returns populated donor and donation metadata. |
| `GET` | `/api/blood-units/:id` | Staff / Lab | **[ACTIVE - PHASE 4A]** | Retrieve single blood unit by MongoDB `_id` or `unitCode` with populated donor and donation details. |

> [!WARNING] **Security Boundary & Auth Blocker**
> The endpoints `/api/blood-units` are designated strictly for internal blood bank staff and laboratory technicians. Anonymous public access is blocked. Role-based Guard enforcement (JWT + RBAC) will be applied in the upcoming Auth vertical slice.

---

### 2.7.1 Inventory Lifecycle (`/api/inventory`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `GET` | `/api/inventory` | Staff | `[PLANNED]` | Full inventory grid across all states (Available, Reserved). |
| `GET` | `/api/inventory/expiring` | Staff | `[PLANNED]` | Units nearing expiry within configurable warning days. |

---

### 2.8 Testing & Laboratory Screening (`/api/testing`)
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/testing` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Initiate a laboratory Testing Record for a Blood Unit in `TESTING` status. Initializes configured screening test panel (`HIV`, `HBV`, `HCV`, `SYPHILIS`, `MALARIA`, as configured in centralized project SOP baseline) to `PENDING`. Enforces 1:1 mapping with `bloodUnitId`. |
| `GET` | `/api/testing` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Query testing records with pagination and filters (`?status=` (`IN_PROGRESS` \| `COMPLETED`), `?decision=` (`PENDING` \| `APPROVED` \| `REJECTED`), `?bloodUnitId=`, `?donationId=`, `?donorId=`, `?page=`, `?limit=`). |
| `GET` | `/api/testing/blood-unit/:bloodUnitId` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Retrieve testing record and outcomes for a specific physical Blood Unit. |
| `GET` | `/api/testing/:id` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Retrieve single testing record by MongoDB `_id` or `testingCode` with populated unit, donation, and donor summary. |
| `PATCH` | `/api/testing/:id/tests/:testCode` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Update individual screening test outcome (`status`: `PASS` \| `FAIL` \| `PENDING`, `result`, `remarks`, `testedAt`). Locked against editing once record is `COMPLETED`. |
| `PATCH` | `/api/testing/:id/complete` | Staff (Lab) | **[ACTIVE - PHASE 4B]** | Finalize testing workflow. Verifies all required tests are conclusive. If all PASS &rarr; decision is `APPROVED` and Blood Unit status becomes `APPROVED`. If any FAIL &rarr; decision is `REJECTED` and Blood Unit status becomes `REJECTED`. Finalized record becomes immutable. |

> [!NOTE] **Screening Test Panel Configuration**
> The required screening test panel is maintained in a centralized configuration. Final required tests are governed by the blood bank's approved Standard Operating Procedure (SOP) and applicable statutory requirements (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**). The API records authorized laboratory outcomes only and does not compute medical thresholds or clinical interpretations.

> [!WARNING] **Security Boundary & Auth Blocker**
> The endpoints under `/api/testing` are strictly clinical laboratory operations. Anonymous public access is blocked. Role-based Guard enforcement (JWT + RBAC) will be applied in the Auth vertical slice.

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

---

### 2.13 External Blood Acquisition / Bulk Blood Receipts (`/api/blood-acquisitions`) — Phase 6D
| Method | Endpoint | Access | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/blood-acquisitions` | Staff / Admin | `[IMPLEMENTED]` | Register external bulk blood receipt, generate individual Blood Units, and route pre-cleared units directly to Inventory. |
| `GET` | `/api/blood-acquisitions` | Staff / Admin | `[IMPLEMENTED]` | Paginated list of external receipts with live unit breakdown counts. |
| `GET` | `/api/blood-acquisitions/:id` | Staff / Admin | `[IMPLEMENTED]` | Retrieve receipt detail with unit status statistics. |
| `GET` | `/api/blood-acquisitions/:id/units` | Staff / Admin | `[IMPLEMENTED]` | Retrieve all individual Blood Units generated from the receipt with testing/inventory status. |
| `GET` | `/api/blood-acquisitions/summary` | Staff / Admin | `[IMPLEMENTED]` | High-level KPI summary stats (total receipts, total units, direct to inventory, pending testing). |

