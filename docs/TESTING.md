# Quality Assurance & Testing Strategy

## 1. Testing Philosophy & Multi-Tiered Strategy
Given that the Blood Bank Platform manages life-critical clinical and biological products, software defects could lead to inventory miscounts, expired or untested blood issuance, or delayed emergency fulfillment. 

A rigorous, defense-in-depth automated testing strategy is established across 10 defined testing levels.

---

## 2. Planned Testing Levels

### 1. Backend Unit Tests
- **Scope**: Isolated testing of pure domain functions, calculation utilities, and stateless service methods without touching the database or network.
- **Tools**: Jest / Vitest.
- **Target**: DTO transformation functions, shelf-life calculation logic, status mapping functions.

### 2. Backend Integration Tests
- **Scope**: Testing NestJS services interacting with in-memory or ephemeral MongoDB instances (`mongodb-memory-server`).
- **Target**: Verifying repository queries, complex transactions, and cascading status updates across Mongoose models.

### 3. REST API Contract Tests
- **Scope**: Supertest HTTP execution against NestJS controllers with active ValidationPipes.
- **Target**: Ensuring proper HTTP status codes (200, 201, 400, 401, 403, 404, 409), strict validation rejection of malformed JSON payloads, and standardized error envelopes.

### 4. Database-Related Tests & Schema Validation
- **Scope**: Index uniqueness checks, foreign-key reference integrity, and Mongoose schema pre/post hooks.
- **Target**: Verifying unique indexes on `donorCode`, `unitNumber`, and `trackingCode`.

### 5. Frontend Component Tests
- **Scope**: Testing React components in `apps/web` with React Testing Library.
- **Target**: Form validation behavior, accessible error banners, disabled states during submission, and responsive layout primitives.

### 6. Frontend Integration Tests
- **Scope**: Testing user flows within Next.js pages using MSW (Mock Service Worker) to intercept REST calls.
- **Target**: Public blood request submission feedback, donor registration multi-step wizard, admin table pagination and filtering.

### 7. End-to-End (E2E) System Tests
- **Scope**: Full browser automation testing spanning `apps/web` to `apps/api` and MongoDB.
- **Tools**: Playwright.
- **Target**: End-to-end critical paths: public submission of a blood request &rarr; admin approval &rarr; reservation &rarr; blood issuance.

### 8. Authentication & Authorization Security Tests
- **Scope**: Validating route protection, JWT expiry handling, and Role-Based Access Control (RBAC).
- **Target**: Ensuring public users cannot access `/api/inventory` or admin routes; ensuring Lab Technicians cannot bypass authorization to issue blood units without required permissions.

### 9. Business-Rule Verification Tests
- **Scope**: Validating that all constraints specified in `BUSINESS-RULES.md` are computationally enforced.
- **Target**: Testing invalid state transitions, rejection immutability, and zero-inventory allocation locks.

### 10. Inventory Transition & Cold-Chain Tests
- **Scope**: Time-based and transaction-based inventory state simulations.
- **Target**: Automated expiration exclusion, atomic stock decrements upon issuance, and race condition prevention during concurrent requests.

---

## 3. High-Priority Test Scenarios for Planned Slices

| Scenario ID | Test Scenario | Expected Outcome |
|---|---|---|
| `TC-REQ-01` | Public Blood Request with complete valid payload | HTTP 201 Created; returns tracking code; status is `PENDING_REVIEW`. |
| `TC-REQ-02` | Public Blood Request with missing blood group or negative unit quantity | HTTP 400 Bad Request; validation error array returned; database unchanged. |
| `TC-DNR-01` | Voluntary Donor self-registration | HTTP 201 Created; unique donorCode assigned; status is `ELIGIBLE`. |
| `TC-DNR-02` | Duplicate donor phone registration | Handled gracefully without creating redundant conflicting accounts. |
| `TC-TST-01` | Blood unit testing results: all negative markers | Unit status transitions from `QUARANTINE_TESTING` to `AVAILABLE`. Usable inventory count increments. |
| `TC-TST-02` | Blood unit testing results: positive infectious marker | Unit status transitions from `QUARANTINE_TESTING` to `REJECTED`. Unit permanently excluded from inventory. |
| `TC-INV-01` | Blood reservation on available unit | Unit status transitions to `RESERVED`. Unit cannot be reserved by any subsequent concurrent request. |
| `TC-INV-02` | Concurrent reservation attempt on already-reserved unit | HTTP 409 Conflict; operation aborted safely without data corruption. |
| `TC-ISS-01` | Blood Issue execution on reserved unit | Unit transitions to `ISSUED`. Stock deducted from active inventory. Issue voucher generated. |
| `TC-ISS-02` | Attempt to issue an unapproved or quarantined unit | HTTP 400 Bad Request; strict rejection; audit alert triggered. |
| `TC-EXP-01` | Unit reaching expiration date | Automatically excluded from public availability queries; blocked from reservation. |
| `TC-SEC-01` | Unauthenticated public access to public endpoints (`/api/availability`, `/api/blood-requests`) | HTTP 200 OK; access permitted without tokens. |
| `TC-SEC-02` | Unauthenticated access to admin endpoints (`/api/inventory`, `/api/donations`) | HTTP 401 Unauthorized; access blocked. |

---

## 4. Execution Guidelines During Slices
- In each vertical slice, automated tests for that feature's unit, API contract, and component behavior will be introduced before marking the slice complete.
- Continuous integration scripts (`npm run typecheck`, `npm run lint`, `npm run build`) must execute cleanly on every commit.
