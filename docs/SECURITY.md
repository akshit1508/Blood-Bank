# Security Architecture & Boundaries

## 1. Threat Model & Boundaries

The Blood Bank Management Platform operates within a healthcare context where data integrity, clinical safety, patient privacy, and regulatory compliance are paramount.

### Core Security Boundaries:
1. **Public vs. Administrative Surface**:
   - Public access is strictly restricted to:
     - Voluntary donor registration (`POST /api/donors`)
     - Patient blood requests (`POST /api/blood-requests`)
     - Public blood stock availability metrics (`GET /api/public/blood-availability`)
     - Service health checks (`GET /api/health`)
     - Administrative session login (`POST /api/auth/login`)
   - All other clinical, laboratory, inventory, acquisition, donation, reservation, and issuance operations require verified administrative Bearer session tokens.
2. **External Messaging & Privacy Boundary (WhatsApp Direct Click-to-Chat)**:
   - Direct Click-to-Chat (`wa.me`) eliminates external API credentials from the server environment, preventing credential leakage risks.
   - External notification payloads pre-fill only safe, non-sensitive verification content (donor registered name and verification notice).
3. **Sensitive Healthcare & Personal Identifiable Information (PII)**:
   - Medical screening outcomes, infectious test results, complete residential addresses, internal database IDs, and clinical notes must never be included in external messages or exposed on unauthenticated endpoints.
4. **Data Integrity & State Protection**:
   - State machine guards enforce valid transitions and prevent unauthorized status regression across donations, blood units, laboratory tests, blood requests, reservations, and issuance.

---

## 2. Authentication & Authorization Foundation (Phase 1 & Phase 2)

### Global Guard Architecture
Authentication and Role-Based Access Control (RBAC) are enforced globally in the NestJS backend via `APP_GUARD` bindings in `AppModule`:
1. **`AdminAuthGuard` (Precedence 1)**:
   - Inspects `@Public()` decorator metadata on route handlers and controller classes.
   - If `@Public()`, bypasses authentication immediately.
   - For all other routes, extracts `Authorization: Bearer <token>` header.
   - Validates HMAC-SHA256 signature, expiry timestamp (`exp`), and active database status (`isActive: true`) in MongoDB.
   - Injects the authenticated staff record into `request.admin` and `request.user`.
   - Fails closed with `401 Unauthorized` if token is missing, invalid, expired, or the staff account has been deactivated.
2. **`RolesGuard` (Precedence 2 — Fail-Closed RBAC)**:
   - Bypasses check if endpoint is marked `@Public()`.
   - Extracts mandated roles via `@Roles(...)` metadata.
   - **Fail-Closed Security Policy**: If a protected endpoint has no declared role metadata (or empty roles), `RolesGuard` strictly denies access with `403 Forbidden` (`Access denied: Protected endpoint has no declared role metadata (fail-closed security policy).`).
   - Verifies whether the authenticated user's role (`SUPER_ADMIN`, `ADMIN`, or `LAB_TECHNICIAN`) matches the allowed roles.
   - Returns `403 Forbidden` if the user's role is not authorized.

### Role Architecture & Portal Separation
1. **`SUPER_ADMIN`**:
   - Executive oversight, system governance, and privileged staff account management.
   - Can view staff accounts (`GET /api/auth/admins`), provision new staff (`POST /api/auth/create-admin`), and toggle staff active/inactive status (`PATCH /api/auth/admins/:id/status`).
   - Self-deactivation and deactivating the last active `SUPER_ADMIN` are strictly prevented.
   - Escalation prevention: cannot grant the `SUPER_ADMIN` role via administrative endpoints.
2. **`ADMIN`**:
   - Operational blood bank management: donors, donations, acquisitions, blood units, inventory, blood requests, reservations, and issuance.
   - Cannot view or manage staff accounts.
3. **`LAB_TECHNICIAN`**:
   - Restricted workstation for diagnostic blood testing and 5-panel TTI screening (`GET /api/testing/*`, `POST /api/testing`, `PATCH /api/testing/:id/tests/:testCode`, `PATCH /api/testing/:id/complete`, and `GET /api/blood-units/awaiting-testing`).
   - Denied access to general donor registry, donations, inventory, blood requests, reservations, issues, acquisitions, and staff administration (`403 Forbidden`).
   - **Data Minimization**: Backend queries strip donor phone numbers and full names, as well as donation notes, from testing responses provided to Lab Technicians.
   - Blood unit lookups are restricted to units in `TESTING` status; completed/stored units cannot be queried by technicians (`403 Forbidden`).

### Role-Based Access Control (RBAC) Matrix
| Resource / Capability | Public | LAB_TECHNICIAN | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Health Check (`GET /api/health`) | Allowed | Allowed | Allowed | Allowed |
| Login (`POST /api/auth/login`) | Allowed | Allowed | Allowed | Allowed |
| Public Blood Availability (`GET /api/public/blood-availability`) | Allowed | Allowed | Allowed | Allowed |
| Self-Register Donor (`POST /api/donors`) | Allowed | Allowed | Allowed | Allowed |
| Submit Blood Request (`POST /api/blood-requests`) | Allowed | Allowed | Allowed | Allowed |
| Session Profile (`GET /api/auth/me`) | Denied (401) | Allowed | Allowed | Allowed |
| Laboratory Testing Operations (`/api/testing/*`) | Denied (401) | Allowed | Allowed | Allowed |
| Units Awaiting Testing (`GET /api/blood-units/awaiting-testing`) | Denied (401) | Allowed | Allowed | Allowed |
| Clinical Operations (Donors, Donations, Inventory, Requests, Issues) | Denied (401) | Denied (403) | Allowed | Allowed |
| Staff Account Directory (`GET /api/auth/admins`) | Denied (401) | Denied (403) | Denied (403) | Allowed |
| Provision Staff Accounts (`POST /api/auth/create-admin`) | Denied (401) | Denied (403) | Denied (403) | Allowed |
| Toggle Staff Status (`PATCH /api/auth/admins/:id/status`) | Denied (401) | Denied (403) | Denied (403) | Allowed |
| Protected route lacking `@Roles()` | Denied (401) | Denied (403) | Denied (403) | Denied (403) |
