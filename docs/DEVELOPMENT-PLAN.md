# Development Plan: Incremental Vertical Slices Roadmap

## 1. Vertical Slice Methodology
The Blood Bank Platform will NOT be engineered by constructing the entire backend layer followed by the entire frontend layer. 

Instead, every feature will be developed in an isolated, production-grade **Vertical Slice** advancing through all application tiers:
```
Requirement Spec
      ↓
MongoDB Schema & Mongoose Model (in apps/api)
      ↓
DTOs & class-validator decorators
      ↓
NestJS Domain Service (business logic & rules)
      ↓
NestJS REST Controller & HTTP routing
      ↓
API Integration / Unit Tests
      ↓
Next.js React UI / Forms / Components (in apps/web)
      ↓
Frontend-to-Backend REST API Integration
      ↓
End-to-End Verification
      ↓
Documentation Update
      ↓
Next Vertical Slice
```

---

## 2. Phased Roadmap

### PHASE 0: Project Foundation & Architecture (CURRENT)
- **Goal**: Establish the monorepo workspace, TypeScript setups, base dependencies, environment configurations, and complete documentation foundation.
- **Backend**: NestJS application initialized with global validation pipes, CORS, ConfigModule, Mongoose connection, and health check endpoint `/api/health`.
- **Frontend**: Next.js App Router application initialized with base styling, clean layout, and Phase 0 status homepage.
- **Database**: Mongoose connection configured to local/remote MongoDB instance via environment variables.
- **API**: Working `/api/health` foundation verification endpoint.
- **Testing**: Typechecking, linting, and production builds passing without errors.
- **Documentation**: All 7 core docs completed.

---

### PHASE 1: Blood Request Vertical Slice [COMPLETED]
- **Goal**: Enable public patients/hospitals to submit urgent blood requests and enable staff to triage and transition request statuses.
- **Backend**: Implemented `BloodRequestModule` in NestJS with strict DTO validation (`CreateBloodRequestDto`, `UpdateBloodRequestStatusDto`), `blood_requests` Mongoose schema with embedded patient/contact subdocuments and compound indexes, service with high-entropy tracking code generation (`REQ-YYYYMMDD-XXXX`), and controller exposing `POST /api/blood-requests`, `GET /api/blood-requests`, `GET /api/blood-requests/:id`, and `PATCH /api/blood-requests/:id/status`.
- **Frontend**: Created Public Blood Request submission form on Next.js (`/blood-request`) with validation, required field indicators, loading state, error alert, and success receipt card displaying the unique tracking code. Created Admin Blood Request Management page (`/admin/blood-requests`) consuming the live API, with status filter, refresh, side-panel request viewer, and state machine transition executor.
- **Database**: `blood_requests` collection with timestamps, status, priority, and unique `requestCode`.
- **API**: Full REST API contract implemented under `/api/blood-requests`.
- **Testing**: Complete automated unit test suites for `BloodRequestService` (creation, unique code generation, valid/invalid state transitions, query filters) and `BloodRequestDto` (class-validator constraint tests).
- **Documentation**: Updated `DATABASE.md`, `API.md`, `BUSINESS-RULES.md`, and `DEVELOPMENT-PLAN.md`.

---

### PHASE 2: Donor Registration Vertical Slice [COMPLETED]
- **Goal**: Enable public voluntary donors to register with the blood bank and enable staff to view and manage registered donors.
- **Backend**: Implemented `DonorsModule` in NestJS with `CreateDonorDto` and `UpdateDonorStatusDto`, `donors` Mongoose schema with unique `donorCode` (`DON-YYYYMMDD-XXXX`), phone uniqueness validation, and controller exposing `POST /api/donors`, `GET /api/donors`, `GET /api/donors/:id`, and `PATCH /api/donors/:id/status`.
- **Frontend**: Public donor registration form (`/donate-blood`) with clean validation and confirmation card. Admin Donors Management portal (`/admin/donors`) with search, blood group/status filters, drawer details, and status toggle (`ACTIVE`/`INACTIVE`).
- **Database**: `donors` collection with compound and unique indexes (`donorCode`, `phone`, `bloodGroup`, `status`).
- **API**: Full REST API contract under `/api/donors`.
- **Testing**: Automated unit tests for `DonorsService` and `CreateDonorDto`/`UpdateDonorStatusDto`.
- **Documentation**: Updated `DATABASE.md`, `API.md`, `BUSINESS-RULES.md`, and `DEVELOPMENT-PLAN.md`.

---

### PHASE 3: Blood Donation Management Vertical Slice [COMPLETED & REFINED]
- **Goal**: Enable blood bank clinical staff to record physical blood collection events from registered donors and track intake lifecycle (`RECORDED` &rarr; `PROCESSING` &rarr; `COMPLETED` / `CANCELLED`).
- **Refinement (Donor Approval &rarr; Record Donation Workflow)**:
  - Upgraded donor registration status lifecycle to `PENDING_REVIEW` &rarr; `ACTIVE` / `INACTIVE`.
  - Public registration defaults to `PENDING_REVIEW` with clear staff review submission notice.
  - Staff reviews donor in `/admin/donors`, executes administrative approval (`ACTIVE`).
  - Active donor profile features integrated `[+ Record Donation]` action with **donor preselected and locked**, eliminating redundant searches.
  - Donor profile displays live, non-duplicated `Donation History` for that donor.
  - Global `/admin/donations` remains available for global intake monitoring and transitions.
- **Backend**: Implemented `DonationsModule` in NestJS with `CreateDonationDto` and `UpdateDonationStatusDto`, `donations` Mongoose schema referencing `Donor`, server-generated tracking codes (`DONATION-YYYYMMDD-XXXX`), strict state machine enforcement (`ALLOWED_DONATION_STATUS_TRANSITIONS`), donor `ACTIVE` status validation on creation, and controller exposing `POST /api/donations`, `GET /api/donations` (paginated with `donorId`, search & filters), `GET /api/donations/:id`, and `PATCH /api/donations/:id/status`.
- **Frontend**: Refined `/admin/donors` with 5-section profile drawer (Personal, Contact, Registration Status, Administrative Review, Donation History) and preselected Record Donation modal. Maintained global `/admin/donations` view.
- **Database**: `donations` collection with indexes (`donationCode`, `donorId`, `status`, `donationDate`, `createdAt`).
- **API**: Full REST API contracts under `/api/donors` and `/api/donations`.
- **Testing**: Automated unit tests for `DonorsService` (including `PENDING_REVIEW` default and administrative transitions), `DonationsService` (including `PENDING_REVIEW`/`INACTIVE` donor rejection, `donorId` filtering), and DTO specs.
- **Documentation**: Updated `DATABASE.md`, `API.md`, `BUSINESS-RULES.md`, and `DEVELOPMENT-PLAN.md`.

---

### PHASE 4: Donations Workflow (Staff / Admin)
- **Goal**: Allow blood bank staff to log physical blood collection events.
- **Backend**: `DonationsModule` with `RecordDonationDto`, donor validation, vital signs recording, `POST /api/donations`.
- **Frontend**: Admin donation logging interface with donor search and vital sign capture form.
- **Database**: `donations` collection linking to donor; auto-creation of placeholder unit in quarantine.
- **API**: Authenticated staff donation entry endpoint.
- **Testing**: Vital sign range validation, donor link integrity tests.
- **Documentation**: Donation protocol guidelines.

---

### PHASE 5: Testing & Laboratory Validation
- **Goal**: Enable laboratory staff to enter test results and enforce the Approve/Reject safety gate.
- **Backend**: `TestingModule` with `SubmitTestResultsDto`, `POST /api/testing/:unitId`. Validates disease markers (HIV, HepB, HepC, Syphilis, Malaria) and updates unit status.
- **Frontend**: Admin Laboratory Testing queue and result submission modal with safety confirmation prompts.
- **Database**: `blood_tests` collection with complete audit timestamps; unit status transitions to `AVAILABLE` or `REJECTED`.
- **API**: Lab testing queue query and testing outcome submission.
- **Testing**: Rejection gate verification (ensure rejected unit never transitions to available), marker completeness tests.
- **Documentation**: Laboratory screening workflow verification.

---

### PHASE 6: Inventory Lifecycle & Cold-Chain Management
- **Goal**: Full lifecycle tracking of blood units, storage locations, and automated expiration monitoring.
- **Backend**: `InventoryModule` with expiration query helpers, shelf location assignments, and inventory stock grid API.
- **Frontend**: Admin Inventory dashboard with status filters (`QUARANTINE`, `AVAILABLE`, `RESERVED`, `EXPIRED`), shelf locators, and expiration warning badges.
- **Database**: Expiration indexes on `blood_units`.
- **API**: `GET /api/inventory`, `GET /api/inventory/expiring`.
- **Testing**: Shelf-life calculation verification, expiration exclusion tests.
- **Documentation**: Cold-chain storage documentation.

---

### PHASE 7: Blood Request Allocation & Issuing
- **Goal**: Staff review of blood requests, reserving compatible units, and issuing blood products with vouchers.
- **Backend**: `ReservationsModule` and `BloodIssueModule` implementing atomic unit reservation, conflict prevention, and final issuance.
- **Frontend**: Admin Blood Requests management table, unit matching modal, reservation manager, and printable issue voucher.
- **Database**: `reservations` and `blood_issues` collections; atomic unit status transitions to `RESERVED` and `ISSUED`.
- **API**: `POST /api/reservations`, `DELETE /api/reservations/:id`, `POST /api/blood-issues`.
- **Testing**: Concurrency / double-allocation prevention tests; inventory deduction verification on issue.
- **Documentation**: Dispensing protocol documentation.

---

### PHASE 8: Campaigns & Mobile Drives
- **Goal**: Schedule donation drives and capture community registrations.
- **Backend**: `CampaignModule` with `POST /api/campaigns` (admin) and `POST /api/campaigns/:id/register` (public).
- **Frontend**: Public upcoming campaigns directory (`/campaigns`) and admin campaign organizer.
- **Database**: `campaigns` and `campaign_registrations` collections.
- **API**: Public campaign calendar and admin campaign management endpoints.
- **Testing**: Campaign date validation, registration tracking tests.
- **Documentation**: Community outreach documentation.

---

### PHASE 9: Admin Dashboard & Unified Metrics
- **Goal**: Central operational control center summarizing all blood bank activities.
- **Backend**: `DashboardModule` with aggregated operational stats: low stock alerts, pending tests, urgent requests, daily collections.
- **Frontend**: Admin Dashboard view with visual KPIs, urgent action queues, and quick navigation shortcuts.
- **Database**: Efficient aggregation pipelines across collections.
- **API**: `GET /api/dashboard/stats`.
- **Testing**: Performance benchmarks on aggregation queries.
- **Documentation**: Operational KPI glossary.

---

### PHASE 10: Reports, Notifications, Audit Logs & System Settings
- **Goal**: Production hardening with immutable compliance logging, automated notifications, and regulatory reporting.
- **Backend**: `AuditModule`, `NotificationsModule`, `ReportsModule` with CSV/PDF data exports and system event listeners.
- **Frontend**: Admin Audit Log viewer, Notification drawer, Reports generator, and Blood Bank Settings page.
- **Database**: Capped/indexed `audit_logs` collection and `notifications` collection.
- **API**: Audit query APIs, notification mark-as-read, report generators.
- **Testing**: Audit immutability tests, role-permission boundary tests.
- **Documentation**: Compliance manual and release readiness sign-off.
