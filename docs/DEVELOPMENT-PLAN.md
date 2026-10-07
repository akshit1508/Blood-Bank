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

### PHASE 1: Blood Request Vertical Slice
- **Goal**: Enable public patients/hospitals to submit urgent blood requests and track their status.
- **Backend**: `BloodRequestModule` in NestJS with DTO validation (`CreateBloodRequestDto`), `blood_requests` Mongoose schema, controller with `POST /api/blood-requests` and `GET /api/blood-requests/track/:code`.
- **Frontend**: Public Blood Request submission form on Next.js (`/blood-request`), immediate confirmation dialog with tracking code, and tracking status page (`/track-request`).
- **Database**: `blood_requests` collection with auto-generated tracking codes and indexes.
- **API**: Public request intake and status retrieval.
- **Testing**: DTO validation failure tests, successful request creation test, tracking code lookup test.
- **Documentation**: Update `API.md` and `BUSINESS-RULES.md` with finalized field definitions.

---

### PHASE 2: Donor Registration Vertical Slice
- **Goal**: Allow public voluntary donors to register in the blood bank database.
- **Backend**: `DonorModule` with `CreateDonorDto`, phone normalization, `donors` schema, duplicate phone detection, `POST /api/donors/register`.
- **Frontend**: Public donor registration form (`/donate`) with eligibility checklist and confirmation receipt.
- **Database**: `donors` collection with unique donor codes and status `ELIGIBLE`.
- **API**: Public registration endpoint with input sanitization.
- **Testing**: Duplicate donor handling test, validation rules test.
- **Documentation**: Donor lifecycle rules updated.

---

### PHASE 3: Public Blood Availability
- **Goal**: Provide transparent, real-time public insight into current blood inventory.
- **Backend**: `AvailabilityModule` aggregating approved, unreserved, non-expired blood units grouped by blood group (`GET /api/availability`).
- **Frontend**: Public Blood Availability dashboard page (`/availability`) with visual cards per blood group (A+, B+, etc.) and status indicators.
- **Database**: Optimized aggregation queries over `blood_units`.
- **API**: Cache-friendly public availability summary endpoint.
- **Testing**: Aggregation accuracy test; verify zero inclusion of quarantine or expired units.
- **Documentation**: Update public availability data policy.

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
