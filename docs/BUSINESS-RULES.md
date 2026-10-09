# Business Rules & Medical Safety Constraints

## 1. Foundational System Principles

1. **Public Zero-Barrier Access**: Public users do not require authentication or user accounts to view blood availability, browse campaigns, register as a prospective donor, or submit an urgent blood request.
2. **Mandatory Staff Authentication**: All access to administrative, laboratory, inventory, and dispensing workflows requires authenticated staff credentials with verified role-based access control.
3. **Single Physical Facility Model**: All operations govern exactly ONE physical blood bank centre. No inter-branch transfers, regional network synchronization, or multi-tenant database partitioning exist in the MVP.
4. **Decoupled Architecture**: Next.js client code must never connect directly to MongoDB. All data access must pass through validated NestJS REST APIs.

---

## 2. Core Operational & Inventory Rules

### 2.1 Donor & Donation Separation
- **Rule 2.1.1**: Donor registration and physical donation are separate concepts. Registering as a donor records individual identity and interest; it does not constitute a blood collection or guarantee clinical eligibility.
- **Rule 2.1.2**: A registered donor can have multiple historical donation events.
- **Rule 2.1.3**: Every donation event must link directly to an existing donor record.
- **Rule 2.1.4 (Donor Registration Lifecycle)**: Newly registered donors start strictly in status `PENDING_REVIEW` pending staff review. Staff review may administratively approve the registration (`PENDING_REVIEW` &rarr; `ACTIVE`) or mark it inactive (`PENDING_REVIEW` &rarr; `INACTIVE`). Active donors may be deactivated (`ACTIVE` &rarr; `INACTIVE`) and reactivated (`INACTIVE` &rarr; `ACTIVE`). Transitions back to `PENDING_REVIEW` are prohibited.
- **Rule 2.1.5 (Duplicate Registration Safeguard)**: Donor registration enforces a duplicate check on the contact phone number to prevent unintended redundant donor records. Duplicate attempts return a 409 Conflict prompting the user to contact the facility.
- **Rule 2.1.6 (Donation Recording Prerequisite)**: Physical blood donation recording is strictly restricted to donors in `ACTIVE` status. Attempting to record a donation for a donor in `PENDING_REVIEW` is rejected (donor requires staff review first); attempting to record for an `INACTIVE` donor is rejected. Administrative `ACTIVE` status is purely operational and does not replace in-person SOP clinical eligibility screening.
- **Rule 2.1.7 (Donor Age Eligibility — Whole Blood)**:
  - Minimum age: 18 completed years.
  - Maximum age: 65 completed years.
  - Exact completed age is computed from date of birth using precise month/day boundary comparison (`calculateCompletedAge`).
  - Age bracket 18–60: Standard eligible registration.
  - Age bracket 61–65: Permitted to register with advisory notice ("Additional screening required: Donor registration can be submitted, but final donation eligibility will be determined during blood-bank screening.").
  - Age < 18 or > 65: Hard-blocked on registration form and authoritatively rejected by backend API (`DONOR_AGE_NOT_ELIGIBLE`, HTTP 400). Zero database records or donor codes are created.
- **Rule 2.1.8 (Whole-Blood Donation Interval Guardrail)**:
  - Authoritative Indian criteria whole-blood intervals:
    - Male donors: 90 calendar days minimum.
    - Female donors: 120 calendar days minimum.
    - Other/unspecified: 120 calendar days minimum.
  - Evaluated against the donor's latest `COMPLETED` whole-blood donation (`status === COMPLETED` and `donationType === WHOLE_BLOOD`). Non-completed events (`RECORDED`, `PROCESSING`, `CANCELLED`) do NOT trigger interval blocking.
  - Calendar day calculation uses normalized UTC date difference (`Date.UTC(y, m, d)`), allowing day 90 / 120 donation collection regardless of exact phlebotomy timestamp.
  - Donations attempted before the required interval are rejected with HTTP 400 (`DONATION_INTERVAL_NOT_COMPLETED`) containing `lastDonationDate`, `nextEligibleDate`, and `remainingDays`.
  - Admin donor profile displays active interval status (`ELIGIBLE`, `WAITING PERIOD`, or `NO PREVIOUS DONATION`) and disables donation recording during the waiting period.
- **Rule 2.1.9 (Future Donation Date Guardrail)**:
  - Donation collection date cannot be in the future (allowing up to 120 seconds clock skew tolerance). Future donation timestamps return HTTP 400 Bad Request.
- **Rule 2.1.10 (Donor Approval & WhatsApp Verification Notification — Phase 6E)**:
  - Transition from `PENDING_REVIEW` &rarr; `ACTIVE` represents the authoritative administrative `DONOR_APPROVED` event.
  - Database persistence is the sole source of truth; approval status changes commit cleanly in the database without secondary third-party API dependencies.
  - **Direct WhatsApp Click-to-Chat (`wa.me`)**: Administrative staff can click the WhatsApp icon or the *[Open in WhatsApp & Send Message]* action to immediately launch WhatsApp Web or mobile app with the verified message pre-filled. No third-party API credentials or `.env` secrets are required.
  - **Safe Messaging Constraint**: The notification must **never** state *"You can donate blood at any time."* Instead, it explicitly states: *"You may visit the blood bank for blood donation when you are eligible, subject to the required donation interval and final screening by our staff."*
  - Public messages must never expose sensitive medical details, internal database IDs, or test records.

### 2.2 Blood Unit Processing & Testing Gate [IMPLEMENTED - PHASE 4A & 4B]
- **Rule 2.2.1 (Blood Unit Creation Prerequisite)**: A physical Blood Unit can ONLY be created from a valid, existing `COMPLETED` donation. Attempting to create a blood unit from donations in status `RECORDED`, `PROCESSING`, or `CANCELLED` is strictly rejected (`DONATION_NOT_COMPLETED`, HTTP 400).
- **Rule 2.2.2 (1 Donation → 1 Blood Unit Mapping & Invariant)**: In the current V1 business model, exactly one blood unit maps to one completed donation. Duplicate creation attempts for the same donation are prevented at both service logic and database levels via a unique index on `donationId`, returning HTTP 409 (`BLOOD_UNIT_ALREADY_EXISTS`).
- **Rule 2.2.3 (Testing Gate Lifecycle & 1:1 Record Invariant - Phase 4B)**:
  - Every newly created Blood Unit initializes strictly with status `TESTING`.
  - Exactly one testing record (`blood_testing`) is associated per Blood Unit, enforced by a unique index on `bloodUnitId` (`TESTING_RECORD_ALREADY_EXISTS`, HTTP 409).
  - The testing record initializes with lifecycle status `IN_PROGRESS` and decision `PENDING`, populating the configured required screening tests (`HIV`, `HBV`, `HCV`, `SYPHILIS`, `MALARIA`) in `PENDING` state.
  - The screening test panel is centrally maintained as a configurable project baseline. Final mandatory screening test definitions are governed by the blood bank's approved Standard Operating Procedure (SOP) and applicable statutory requirements (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).
  - The software records authorized laboratory outcomes (`PASS`, `FAIL`, `PENDING`) only. It does NOT compute, invent, or infer medical thresholds, cutoffs, reference ranges, or clinical interpretation logic.
  - Lifecycle states for Phase 4B testing records are strictly `IN_PROGRESS` and `COMPLETED`. (No unverified or arbitrary cancellation workflow is exposed).
  - Completion requires all configured required tests to have conclusive results (`PASS` or `FAIL`); completing with any test in `PENDING` is rejected with HTTP 400 (`REQUIRED_TESTS_INCOMPLETE`).
- **Rule 2.2.4 (Testing Decision & Blood Unit Status Synchronization - Phase 4B)**:
  - If any required test has status `FAIL`: The testing decision becomes `REJECTED`, and the Blood Unit atomically transitions to status `REJECTED`.
  - If all required tests have status `PASS`: The testing decision becomes `APPROVED`, and the Blood Unit atomically transitions to status `APPROVED`.
  - Manual status tampering on Blood Units is disallowed; `TESTING` → `APPROVED` / `REJECTED` is governed strictly through the testing completion workflow.
  - `APPROVED` status signifies laboratory safety clearance only; it does NOT mean available in public stock, reserved, or issued.
  - Once finalized (`COMPLETED`), testing records and test results become immutable against arbitrary modification (`TESTING_ALREADY_COMPLETED`, HTTP 400).
- **Rule 2.2.5 (Full Traceability Chain)**: Complete traceability is preserved across the lifecycle: `Donor` → `Donation` → `Blood Unit` → `Testing Record` → `Individual Test Results` → `Final Decision`.
- **Rule 2.2.6 (Rejection Protocol)**: Any blood unit marked `REJECTED` during testing must **never** enter available inventory under any circumstances. It must transition immediately to biohazard disposal/quarantine and be permanently locked against reservation or dispensing.

### 2.3 Inventory Allocation & Reservation Integrity
- **Rule 2.3.1 (Anti-Double Allocation)**: A blood unit in status `RESERVED` belongs exclusively to its assigned approved request. It cannot be allocated, reserved, or issued to any other request simultaneously.
- **Rule 2.3.2 (Atomic Dispensing Transition)**: Executing a blood issue event must atomically update the unit status from `RESERVED` to `ISSUED` and immediately deduct it from available inventory.
- **Rule 2.3.3 (Traceability)**: Every state transition of a blood unit (`QUARANTINE_TESTING` &rarr; `AVAILABLE` &rarr; `RESERVED` &rarr; `ISSUED` / `DISCARDED` / `EXPIRED`) must be permanently recorded in an immutable audit trail with timestamp, user ID, and reason.

### 2.4 State Machine & Valid Transitions
- **Rule 2.4.1 (Illegal State Transitions)**: The system must enforce strict state transitions and reject invalid transitions with an HTTP 400/409 error:
  - An `ISSUED` unit cannot be reverted to `AVAILABLE`.
  - A `REJECTED` unit cannot be transitioned to `AVAILABLE` or `RESERVED`.
  - An `EXPIRED` unit cannot be transitioned to `RESERVED` or `ISSUED`.
- **Rule 2.4.2 (Blood Request Lifecycle)**: Blood requests start strictly in `REQUESTED` status and progress through defined transitions:
  - `REQUESTED` &rarr; `VERIFIED` | `REJECTED` | `CANCELLED`
  - `VERIFIED` &rarr; `APPROVED` | `REJECTED` | `CANCELLED`
  - `APPROVED` &rarr; `RESERVED` | `CANCELLED`
  - `RESERVED` &rarr; `ISSUED` | `CANCELLED`
  - `ISSUED` &rarr; `COMPLETED`
  - Terminal States: `COMPLETED`, `REJECTED`, `CANCELLED` (no subsequent transitions permitted). Direct jumping from `REQUESTED` directly to `ISSUED` or `APPROVED` without verification is rejected with an HTTP 400 Bad Request.
- **Rule 2.4.3 (Donation Lifecycle)**: Donations are recorded events by registered donors and start strictly in status `RECORDED`:
  - `RECORDED` &rarr; `PROCESSING` | `CANCELLED`
  - `PROCESSING` &rarr; `COMPLETED` | `CANCELLED`
  - Terminal States: `COMPLETED`, `CANCELLED` (no subsequent transitions permitted). Illegal jumps (e.g., `COMPLETED` &rarr; `RECORDED`, `CANCELLED` &rarr; `COMPLETED`) are rejected with an HTTP 400 Bad Request.
  - Boundary: Transitioning to `COMPLETED` signifies that the physical phlebotomy collection has ended successfully. Creation of traceable blood units and laboratory quarantine occurs in subsequent Phase 4.

### 2.5 Expiry & Cold Chain Rules
- **Rule 2.5.1**: Every blood unit must have a tracked expiration date calculated from collection date and component type.
- **Rule 2.5.2**: Expired units must be automatically excluded from public availability metrics and blocked from being reserved or issued for patient transfusion.

### 2.6 External Blood Acquisition Rules (Phase 6D)
- **Rule 2.6.1 (No Fake Donors/Donations)**: External blood received from another hospital, blood bank, or health agency MUST NOT generate fake Donor or Donation records.
- **Rule 2.6.2 (Unit Individuality)**: Bulk receipts (e.g. 20 units of A+ PRBC) MUST generate 20 individually traceable physical `BloodUnit` documents with unique `unitCode` identifiers (`UNIT-YYYYMMDD-XXXX`).
- **Rule 2.6.3 (Dual Workflow Routing)**:
  - If `testingRequired = false`, the source is treated as authorized/pre-cleared; units are created in `APPROVED` status and immediately enter Inventory as `AVAILABLE`. No redundant testing records are generated.
  - If `testingRequired = true`, units are created in `TESTING` status and enter the standard laboratory screening panel gate. They cannot enter Inventory until testing is `COMPLETED` and `APPROVED`.
- **Rule 2.6.4 (Full Traceability)**: Every external blood unit stores `sourceType: EXTERNAL_RECEIPT` and references `externalReceiptId`. Once available in Inventory, external units participate seamlessly in request matching, reservation, and blood issue without distinction.

---

## 3. Medical Safety & Clinical Boundaries

Software engineering teams must NOT invent, guess, or hardcode medical rules. Clinical and regulatory decisions must be confirmed by certified blood bank authorities.

| Subject Area | System Policy / Boundary | Confirmation Status |
|---|---|---|
| **Donor Eligibility** | Minimum age, weight cutoff, blood pressure tolerance, hemoglobin minimums, and medical deferral periods are NOT hardcoded with arbitrary numbers. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Component Shelf Life** | Shelf life durations (e.g. Whole Blood, PRBC, Platelets, FFP) must be configured according to the blood bank's anticoagulant preservatives and laboratory protocols. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Screening Panel Markers** | Mandatory virology/serology tests (e.g., HIV-1/2, HBsAg, HCV, VDRL/Syphilis, MP/Malaria, NAT testing) must reflect national and blood bank accreditation guidelines. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Storage Temperature Ranges** | Temperature thresholds for storage refrigerators, agitating platelet incubators, and sub-zero plasma freezers. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Transfusion Compatibility** | ABO/Rh isoantibody cross-matching and emergency uncrossmatched blood release protocols. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Requisition Documentation** | Mandatory clinical requisition uploads or attending physician physical signatures required before dispensing. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
| **Discard & Disposal Protocols** | Biological waste disposal sign-off, autoclave/incineration logging, and regulatory biohazard reporting. | **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** |
