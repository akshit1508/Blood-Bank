# Business Rules & Medical Safety Constraints

## 1. Foundational System Principles

1. **Public Zero-Barrier Access**: Public users do not require authentication or user accounts to view blood availability, browse campaigns, register as a prospective donor, or submit an urgent blood request.
2. **Mandatory Staff Authentication**: All access to administrative, laboratory, inventory, and dispensing workflows requires authenticated staff credentials with verified role-based access control.
3. **Single Physical Facility Model**: All operations govern exactly ONE physical blood bank centre. No inter-branch transfers, regional network synchronization, or multi-tenant database partitioning exist in the MVP.
4. **Decoupled Architecture**: Next.js client code must never connect directly to MongoDB. All data access must pass through validated NestJS REST APIs.

---

## 2. Core Operational & Inventory Rules

### 2.1 Donor & Donation Separation
- **Rule 2.1.1**: Donor registration and physical donation are separate concepts. Registering as a donor records individual identity and eligibility; it does not constitute a blood collection.
- **Rule 2.1.2**: A registered donor can have multiple historical donation events.
- **Rule 2.1.3**: Every donation event must link directly to an existing donor record.

### 2.2 Blood Unit Processing & Testing Gate
- **Rule 2.2.1**: Every completed donation creates or directly associates with one or more physical blood unit records.
- **Rule 2.2.2 (The Testing Gate)**: Upon initial collection, all blood units are assigned status `QUARANTINE_TESTING`. A blood unit **must never** become available inventory until mandatory laboratory testing has been completed and marked `APPROVED`.
- **Rule 2.2.3 (Rejection Protocol)**: Any blood unit marked `REJECTED` during testing must **never** enter available inventory under any circumstances. It must transition immediately to biohazard disposal/quarantine and be permanently locked against reservation or dispensing.

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

### 2.5 Expiry & Cold Chain Rules
- **Rule 2.5.1**: Every blood unit must have a tracked expiration date calculated from collection date and component type.
- **Rule 2.5.2**: Expired units must be automatically excluded from public availability metrics and blocked from being reserved or issued for patient transfusion.

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
