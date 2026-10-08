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

### PHASE 3.5: Blood Donor Eligibility & Donation Interval Validation [COMPLETED]
- **Goal**: Implement authoritative Indian blood donation eligibility criteria on both frontend and backend.
- **Rules Enforced**:
  - Whole-blood age boundaries: 18–65 years (18–60 eligible, 61–65 advisory note, <18 or >65 hard rejected with HTTP 400 `DONOR_AGE_NOT_ELIGIBLE`).
  - Whole-blood donation intervals: 90 calendar days for male, 120 calendar days for female/other based on latest `COMPLETED` whole-blood donation (`DONATION_INTERVAL_NOT_COMPLETED` with structured `lastDonationDate`, `nextEligibleDate`, and `remainingDays`).
  - Future donation collection date rejection.
- **Backend**: Pure functions in `eligibility.constants.ts`, enforcement in `donors.service.ts` and `donations.service.ts`.
- **Frontend**: Real-time age feedback in `/donate-blood` registration form, interval status card in `/admin/donors` drawer, and waiting period button disabling.
- **Testing**: 70/70 unit tests passing covering age and interval edge cases.

---

### PHASE 4A: Blood Unit Backend Foundation [COMPLETED]
- **Goal**: Establish the backend domain and Mongoose foundation for tracking individual physical blood units produced from completed donations.
- **Domain Invariants**:
  - A Blood Unit can be created ONLY from a valid `COMPLETED` donation.
  - V1 Model: Exactly 1 donation maps to 1 blood unit, enforced by database unique index on `donationId` (`BLOOD_UNIT_ALREADY_EXISTS`, HTTP 409).
  - Newly created Blood Unit initializes strictly with status `TESTING`.
  - Authoritatively derives `donorId`, `bloodGroup`, and `collectionDate` from the donation and donor records.
  - Rejects donations in status `RECORDED`, `PROCESSING`, or `CANCELLED`.
  - Generates unique server-side `unitCode` (`UNIT-YYYYMMDD-XXXX`).
  - No unsupported medical shelf-life assumptions are hardcoded.
- **Backend Module**: `BloodUnitsModule` in `apps/api/src/modules/blood-units/`:
  - `BloodUnit` Mongoose schema with indexes on `unitCode`, `donationId`, `donorId`, `bloodGroup`, `componentType`, `status`, and `collectionDate`.
  - `BloodUnitsService` implementing `create`, `findAll` (paginated with filters), and `findOne` (by ObjectId or unitCode).
  - `BloodUnitsController` exposing `POST /api/blood-units`, `GET /api/blood-units`, and `GET /api/blood-units/:id`.
  - `CreateBloodUnitDto` and `QueryBloodUnitsDto` with validation rules.
- **Testing**: 96/96 automated unit tests passing across all test suites, including comprehensive tests in `blood-units.service.spec.ts` and `blood-unit.dto.spec.ts`.
- **Documentation**: Updated `DATABASE.md`, `API.md`, `BUSINESS-RULES.md`, and `DEVELOPMENT-PLAN.md`.

---

### PHASE 4B: Blood Testing Management Backend [COMPLETED]
- **Goal**: Implement laboratory screening record tracking for blood units, individual test result updates, and enforce atomic Approve/Reject testing completion.
- **Domain Invariants**:
  - Exactly 1 testing record (`blood_testing`) per Blood Unit (`bloodUnitId` unique index).
  - Initiation restricted to units in status `TESTING` (`BLOOD_UNIT_NOT_IN_TESTING`, HTTP 400).
  - Initializes configured required screening tests (`HIV`, `HBV`, `HCV`, `SYPHILIS`, `MALARIA`, as configurable SOP baseline; final panel governed by blood bank SOP) in `PENDING` status.
  - Finalization requires all configured tests to have conclusive non-pending results (`REQUIRED_TESTS_INCOMPLETE`, HTTP 400).
  - If any required test has status `FAIL`: Decision = `REJECTED`, Blood Unit status atomically updates to `REJECTED`.
  - If all required tests have status `PASS`: Decision = `APPROVED`, Blood Unit status atomically updates to `APPROVED`.
  - Finalized records become immutable against casual tampering (`TESTING_ALREADY_COMPLETED`, HTTP 400).
  - Software records authorized laboratory outcomes only without computing medical thresholds or clinical interpretation logic.
  - Full traceability: `Donor` → `Donation` → `Blood Unit` → `Testing Record` → `Test Results` → `Decision`.
- **Backend Module**: `TestingModule` in `apps/api/src/modules/testing/`:
  - `BloodTesting` Mongoose schema with embedded `IndividualTestResult` subdocuments.
  - `TestingService` implementing `create`, `updateTestResult`, `completeTesting`, `findAll`, `findOne`, and `findByBloodUnitId`.
  - `TestingController` exposing `POST /api/testing`, `GET /api/testing`, `GET /api/testing/:id`, `GET /api/testing/blood-unit/:bloodUnitId`, `PATCH /api/testing/:id/tests/:testCode`, and `PATCH /api/testing/:id/complete`.
  - DTOs: `CreateTestingDto`, `UpdateTestResultDto`, `CompleteTestingDto`, `QueryTestingDto`.
- **Testing**: 126/126 automated unit tests passing across all 10 test suites, including comprehensive tests in `testing.service.spec.ts` and `testing.dto.spec.ts`.
- **Documentation**: Updated `DATABASE.md`, `API.md`, `BUSINESS-RULES.md`, and `DEVELOPMENT-PLAN.md`.

---

### PHASE 4C: Testing Admin Frontend [COMPLETED]
- **Goal**: Implement professional laboratory staff interface for blood screening test queue, individual outcome entry, safety gate completion, and blood unit clearance visualization.
- **Frontend Route**: `/admin/testing` in `apps/web/src/app/admin/testing/page.tsx`.
- **API Client**: `apps/web/src/lib/testing-api.ts` connecting to real Phase 4B endpoints:
  - `GET /api/testing` (queue with status/decision filters and pagination)
  - `GET /api/testing/:id` (record detail)
  - `GET /api/testing/blood-unit/:bloodUnitId` (unit testing lookup)
  - `POST /api/testing` (initiate testing on candidate blood unit)
  - `PATCH /api/testing/:id/tests/:testCode` (save individual test outcome)
  - `PATCH /api/testing/:id/complete` (finalize overall testing decision)
  - `GET /api/blood-units?status=TESTING` (fetch units awaiting testing)
- **Key Features & UX Invariants**:
  - Live Testing Queue showing Testing Code, Blood Unit, Blood Group, Donor, Status, Decision, and timestamps.
  - Interactive Traceability Drawer linking `Blood Unit` → `Donation` → `Donor` → `Lab Results`.
  - Dynamic test results rendering (supports any SOP-configured test set returned by backend).
  - Validation: Prevents future `testedAt` dates, blocks completion when any test is `PENDING`.
  - Safety Confirmation: Explains Approve/Reject synchronization before finalizing.
  - Immutability: Once `COMPLETED`, record enters read-only locked mode with outcome badges.
  - Cross-Admin Navigation: Seamless navigation between Blood Requests, Donors, Donations, and Testing.
- **Verification**: `npm run lint` (0 errors), `npm run typecheck` (passed), `npm run build` (14/14 static pages generated successfully), all 126 backend tests passing.

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
