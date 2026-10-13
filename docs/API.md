# REST API Specification & Endpoint Map

## 1. API Architecture & Standards
The Blood Bank REST API is built in NestJS, accessible at the `/api` root prefix. 

### Core Protocol Standards
- **Transport**: JSON over HTTPS / HTTP.
- **Header Standards**: `Content-Type: application/json`, `Accept: application/json`.
- **Authentication**: Bearer session tokens in `Authorization: Bearer <token>` for all protected management endpoints.
- **Public Endpoints**: Completely unauthenticated; annotated with `@Public()`. Require no Authorization header.
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
    "statusCode": 401,
    "error": "Unauthorized",
    "message": "Authentication token is required.",
    "timestamp": "2026-10-07T12:00:00.000Z"
  }
  ```

---

## 2. Reconciled API Endpoint Inventory (57 Route Handlers across 12 Controllers)

All 57 handlers are governed by global `AdminAuthGuard` and `RolesGuard`. Endpoints without the `@Public()` annotation require a valid Bearer token (`HTTP 401 Unauthorized`). Protected routes strictly enforce fail-closed RBAC with explicit role lists (`SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN`), denying unannotated routes with `HTTP 403 Forbidden`.

### 2.1 System Foundation Endpoints (`AppController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `GET` | `/api/health` | `getHealth` | Public (`@Public`) | None | Service liveness and operational health status. |

---

### 2.2 Authentication & Staff Management (`AuthController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | `login` | Public (`@Public`) | None | Staff authentication; verifies credentials and returns HMAC Bearer token. |
| `GET` | `/api/auth/me` | `getMe` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Validates session token and returns active staff profile. |
| `GET` | `/api/auth/admins` | `findAllAdmins` | Authenticated | `SUPER_ADMIN` | Retrieves directory of all staff accounts with role and status. |
| `POST` | `/api/auth/create-admin` | `createAdmin` | Authenticated | `SUPER_ADMIN` | Provisions new `ADMIN` or `LAB_TECHNICIAN` staff accounts. |
| `PATCH` | `/api/auth/admins/:id/status` | `updateAdminStatus` | Authenticated | `SUPER_ADMIN` | Activates or deactivates staff accounts (prevents self-lockout). |

---

### 2.3 Donor Management (`DonorsController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/donors` | `create` | Public (`@Public`) | None | Public self-registration for voluntary blood donors. |
| `GET` | `/api/donors` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated search and filtering of registered donors. |
| `GET` | `/api/donors/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Single donor profile lookup with donation history. |
| `PATCH` | `/api/donors/:id/status` | `updateStatus` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Donor lifecycle status transitions (`ACTIVE`, `INACTIVE`). |

---

### 2.4 Donation Processing (`DonationsController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/donations` | `create` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Record physical blood donation intake with donor interval checks. |
| `GET` | `/api/donations` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query donations with donor filters and pagination. |
| `GET` | `/api/donations/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Retrieve individual donation record with populated donor. |
| `PATCH` | `/api/donations/:id/status` | `updateStatus` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Progress donation state (`RECORDED` &rarr; `PROCESSING` &rarr; `COMPLETED`, `CANCELLED`). |

---

### 2.5 Blood Units (`BloodUnitsController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/blood-units` | `create` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Convert completed donation into physical Blood Unit for laboratory testing. |
| `GET` | `/api/blood-units` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated search of physical blood units. |
| `GET` | `/api/blood-units/awaiting-testing` | `findAwaitingTesting` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Scoped blood units in `TESTING` status awaiting laboratory screening. |
| `GET` | `/api/blood-units/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN`* | Single blood unit lookup (*technicians restricted to units in `TESTING` status). |
| `GET` | `/api/blood-units/donation/:donationId` | `findByDonationId` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Retrieve blood unit associated with a specific donation ID. |

---

### 2.6 Laboratory Testing (`TestingController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/testing` | `create` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Initiate screening panel record for blood unit in `TESTING`. |
| `GET` | `/api/testing` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Query laboratory testing records (sanitized for technicians). |
| `GET` | `/api/testing/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Retrieve laboratory testing record by ID or code (sanitized for technicians). |
| `GET` | `/api/testing/blood-unit/:bloodUnitId` | `findByBloodUnitId` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Retrieve testing outcomes for physical blood unit. |
| `PATCH` | `/api/testing/:id/tests/:testCode` | `updateTestOutcome` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Update specific infectious disease test result (`PASS` / `FAIL`). |
| `PATCH` | `/api/testing/:id/complete` | `completeTesting` | Authenticated | `SUPER_ADMIN`, `ADMIN`, `LAB_TECHNICIAN` | Finalize screening record; transitions blood unit to `APPROVED` or `REJECTED`. |

---

### 2.7 Inventory Management & Discards (`InventoryController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `GET` | `/api/inventory` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated internal inventory grid across all states. |
| `GET` | `/api/inventory/summary` | `getSummary` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Real-time aggregate count summary of inventory stock. |
| `GET` | `/api/inventory/expiring` | `findExpiring` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query units nearing expiration within threshold days. |
| `GET` | `/api/inventory/expired` | `findExpired` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query units that have exceeded expiration date. |
| `GET` | `/api/inventory/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Single inventory item details. |
| `PATCH` | `/api/inventory/:id/quarantine` | `quarantine` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Move unit to quarantined status. |
| `PATCH` | `/api/inventory/:id/release-quarantine` | `releaseQuarantine` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Return unit from quarantine to available stock. |
| `PATCH` | `/api/inventory/:id/discard` | `discard` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Discard expired or compromised inventory item. |
| `POST` | `/api/inventory/:id/discard` | `discardPost` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Discard alias handler (POST). |

---

### 2.8 Public Blood Stock Availability (`PublicBloodAvailabilityController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `GET` | `/api/public/blood-availability` | `getPublicAvailability` | Public (`@Public`) | None | Sanitized blood availability counts by blood group and component. |

---

### 2.9 External Blood Acquisition (`BloodAcquisitionsController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/blood-acquisitions` | `create` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Ingest external batch receipt and generate blood units. |
| `GET` | `/api/blood-acquisitions` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated list of external blood acquisitions. |
| `GET` | `/api/blood-acquisitions/summary` | `getSummary` | Authenticated | `SUPER_ADMIN`, `ADMIN` | High-level KPI summary of blood acquisitions. |
| `GET` | `/api/blood-acquisitions/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Receipt details and unit breakdown. |
| `GET` | `/api/blood-acquisitions/:id/units` | `findUnits` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Blood units generated from receipt. |

---

### 2.10 Patient Blood Requests (`BloodRequestController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/blood-requests` | `create` | Public (`@Public`) | None | Public patient submission of urgent blood request form. |
| `GET` | `/api/blood-requests` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Staff triage queue for reviewing patient blood requests. |
| `GET` | `/api/blood-requests/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Detailed clinical blood request view. |
| `PATCH` | `/api/blood-requests/:id/status` | `updateStatus` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Lifecycle transition (`PENDING` &rarr; `APPROVED` &rarr; `FULFILLED` / `REJECTED`). |

---

### 2.11 Reservations & Unit Allocation (`ReservationsController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/reservations` | `createReservation` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Reserve approved blood unit for an approved patient request. |
| `GET` | `/api/reservations` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated list of unit reservations. |
| `GET` | `/api/reservations/active` | `getActiveReservations` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query active reservations within valid hold window. |
| `GET` | `/api/reservations/expired` | `getExpiredReservations` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query reservations that have lapsed. |
| `GET` | `/api/reservations/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Retrieve reservation details. |
| `PATCH` | `/api/reservations/:id/cancel` | `cancelReservation` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Cancel reservation and release unit back to available inventory. |

---

### 2.12 Blood Issuance & Dispensing (`BloodIssuesController`)
| Method | Route | Handler | Access | Permitted Roles | Description |
|---|---|---|---|---|---|
| `POST` | `/api/blood-issues` | `createBloodIssue` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Dispense reserved blood unit to recipient; creates issue certificate. |
| `GET` | `/api/blood-issues` | `findAll` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Paginated list of issued blood units. |
| `GET` | `/api/blood-issues/stats` | `getStats` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Summary statistics of issued blood units. |
| `GET` | `/api/blood-issues/blood-request/:bloodRequestId` | `findByBloodRequestId` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Query issue records for a specific patient request. |
| `GET` | `/api/blood-issues/code/:issueCode` | `findByCode` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Verification lookup of issue certificate by issue code. |
| `GET` | `/api/blood-issues/:id` | `findOne` | Authenticated | `SUPER_ADMIN`, `ADMIN` | Retrieve issue record by ID. |
