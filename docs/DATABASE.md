# Database Model & Schema Specifications: MongoDB & Mongoose

## 1. Overview & Strategy
Persistence is handled by MongoDB via Mongoose object modeling inside `apps/api`. 

To maintain strict traceability, prevent data corruption, and avoid premature coupling:
- Schemas will be formally coded and integrated **module-by-module** during the execution of each feature's vertical slice.
- No dummy or partial schemas are generated in advance in code during Phase 0.
- All documents utilize UTC ISO timestamps (`createdAt`, `updatedAt`) and explicit state enumeration.

---

## 2. Planned Collections & Domain Models

### 2.1 `users`
- **Purpose**: System credentials, authorization roles, and audit identity for blood bank staff.
- **Relationships**: Referenced in `audit_logs`, `blood_tests.testedBy`, `blood_issues.issuedBy`.
- **Known Fields**:
  - `_id`: ObjectId
  - `name`: string
  - `email`: string (unique, indexed)
  - `passwordHash`: string
  - `role`: string enum (`SUPER_ADMIN`, `BLOOD_BANK_OFFICER`, `LAB_TECHNICIAN`, `DISPENSING_STAFF`)
  - `isActive`: boolean
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Exact MFA requirements, staff employee ID formatting (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.2 `donors` [IMPLEMENTED - PHASE 2]
- **Purpose**: Master registry of individuals who have volunteered and registered with the blood bank as potential blood donors. (Note: A Donor record represents personal identity/interest; it does NOT constitute a blood donation event).
- **Relationships**: One-to-Many with `donations` (future Phase 4).
- **Implemented Fields (Mongoose Schema: `apps/api/src/modules/donors/schemas/donor.schema.ts`)**:
  - `_id`: ObjectId
  - `donorCode`: string (unique, indexed, uppercase e.g. `DON-20261007-XXXX`)
  - `fullName`: string (required, trimmed)
  - `dateOfBirth`: Date (optional)
  - `gender`: string enum (`MALE`, `FEMALE`, `OTHER`)
  - `bloodGroup`: string enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, indexed)
  - `phone`: string (required, trimmed, indexed, uniqueness-checked on registration)
  - `email`: string (optional, lowercase, trimmed)
  - `address`: string (optional)
  - `city`: string (optional)
  - `emergencyContact`: Subdocument `{ name?: string, phone?: string }`
  - `status`: string enum (`PENDING_REVIEW`, `ACTIVE`, `INACTIVE`, default: `PENDING_REVIEW`, indexed)
  - `createdAt`, `updatedAt`: Date (timestamps: true)
- **Indexes**: `{ createdAt: -1 }`, `{ donorCode: 1 }` (unique), `{ phone: 1 }`, `{ bloodGroup: 1 }`, `{ status: 1 }`
- **Duplicate Handling Policy**: Phone number is checked during registration to prevent accidental duplicate registrations for the same contact number.
- **Eligibility Validation Policy (Phase 3.5)**: `dateOfBirth` is validated to enforce whole-blood donor age between 18 and 65 years. Completed age is computed dynamically using exact day/month comparison (`calculateCompletedAge`) and is intentionally NOT stored as a stale persistent field.
- **Allowed Administrative Status Transitions**:
  - `PENDING_REVIEW` &rarr; `ACTIVE`, `INACTIVE`
  - `ACTIVE` &rarr; `INACTIVE`
  - `INACTIVE` &rarr; `ACTIVE`
  - *(Regression from ACTIVE/INACTIVE back to PENDING_REVIEW is disallowed).*
- **Requires Confirmation**: Formal medical deferral categorization (`DEFERRED_TEMPORARY`, `DEFERRED_PERMANENT`) and national identity document storage policies (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.3 `donations` [IMPLEMENTED - PHASE 3 / 3.5]
- **Purpose**: Record of a single physical donation event performed by an existing registered donor. (Note: A Donation is an intake collection event; it is NOT the donor entity, and blood units are generated downstream in Phase 4).
- **Relationships**: Many-to-One with `donors`; One-to-Many with `blood_units` (future Phase 4).
- **Implemented Fields (Mongoose Schema: `apps/api/src/modules/donations/schemas/donation.schema.ts`)**:
  - `_id`: ObjectId
  - `donationCode`: string (unique, uppercase e.g. `DONATION-20261007-XXXX`)
  - `donorId`: ObjectId (ref: `Donor`, required, indexed)
  - `donationDate`: Date (required)
  - `donationType`: string enum (`WHOLE_BLOOD`, default: `WHOLE_BLOOD`)
  - `quantity`: number (required, minimum: 1, units)
  - `status`: string enum (`RECORDED`, `PROCESSING`, `COMPLETED`, `CANCELLED`, default: `RECORDED`, indexed)
  - `notes`: string (optional, trimmed)
  - `createdAt`, `updatedAt`: Date (timestamps: true)
- **Indexes**: `{ createdAt: -1 }`, `{ donationCode: 1 }` (unique), `{ donorId: 1 }`, `{ status: 1 }`, `{ donationDate: 1 }`
- **Interval Validation Policy (Phase 3.5)**: On recording a whole-blood donation, the system queries the latest `COMPLETED` whole-blood donation for `donorId` and verifies the required interval (90 calendar days for Male, 120 calendar days for Female/Other) using normalized UTC calendar dates. Interval status, remaining days, and next eligible date are derived dynamically and never stored as stale precomputed fields.
- **Allowed Status Transitions**:
  - `RECORDED` &rarr; `PROCESSING`, `CANCELLED`
  - `PROCESSING` &rarr; `COMPLETED`, `CANCELLED`
  - `COMPLETED` &rarr; terminal
  - `CANCELLED` &rarr; terminal
- **Requires Confirmation**: Clinical vitals tracking (hemoglobin, blood pressure, temperature, pulse), phlebotomist staff assignment, and multi-component apheresis support (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.4 `blood_units`
- **Purpose**: Represents an individual physical blood bag stored in cold-chain storage.
- **Relationships**: Many-to-One with `donations`; One-to-One with `blood_tests`; One-to-One with `reservations` and `blood_issues`.
- **Known Fields**:
  - `_id`: ObjectId
  - `unitNumber`: string (unique, barcoded/scannable identifier)
  - `donationId`: ObjectId (ref: `donations`, indexed)
  - `bloodGroup`: string enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`)
  - `componentType`: string enum (`WHOLE_BLOOD`, `PRBC`, `FFP`, `PLATELETS`, `CRYOPRECIPITATE`)
  - `volumeMl`: number
  - `collectionDate`: Date
  - `expiryDate`: Date (indexed)
  - `storageLocation`: { refrigeratorId, shelfId, rackId }
  - `status`: string enum (`QUARANTINE_TESTING`, `AVAILABLE`, `RESERVED`, `ISSUED`, `EXPIRED`, `DISCARDED`)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Component separation method and shelf-life determination formula per component (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.5 `blood_tests`
- **Purpose**: Laboratory screening records validating blood safety prior to inventory availability.
- **Relationships**: One-to-One with `blood_units`.
- **Known Fields**:
  - `_id`: ObjectId
  - `unitId`: ObjectId (ref: `blood_units`, unique index)
  - `testedBy`: ObjectId (ref: `users`)
  - `testedAt`: Date
  - `aboConfirmed`: string
  - `rhConfirmed`: string
  - `screeningResults`: {
      hiv: string enum (`NEGATIVE`, `POSITIVE`, `INDETERMINATE`),
      hepB: string enum (`NEGATIVE`, `POSITIVE`, `INDETERMINATE`),
      hepC: string enum (`NEGATIVE`, `POSITIVE`, `INDETERMINATE`),
      syphilis: string enum (`NEGATIVE`, `POSITIVE`, `INDETERMINATE`),
      malaria: string enum (`NEGATIVE`, `POSITIVE`, `INDETERMINATE`)
    }
  - `overallOutcome`: string enum (`APPROVED`, `REJECTED`)
  - `remarks`: string (optional)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Additional mandatory regional screening markers (e.g., HTLV, Chagas, NAT testing) (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.6 `blood_requests` [IMPLEMENTED - PHASE 1]
- **Purpose**: Master record of requested blood by public patients or hospitals.
- **Relationships**: One-to-Many with `reservations` and `blood_issues` (future phases).
- **Implemented Fields (Mongoose Schema: `apps/api/src/blood-requests/schemas/blood-request.schema.ts`)**:
  - `_id`: ObjectId
  - `requestCode`: string (unique, indexed, uppercase e.g. `REQ-20261007-XXXX`)
  - `patient`: Subdocument `{ name: string, age: number, gender: string }`
  - `bloodGroup`: string enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`)
  - `componentType`: string enum (`WHOLE_BLOOD`, `PRBC`, `FFP`, `PLATELETS`)
  - `unitsRequested`: number (min: 1)
  - `hospitalName`: string
  - `doctorName`: string
  - `doctorContact`: string (optional)
  - `hospitalCaseNumber`: string (optional)
  - `priority`: string enum (`CRITICAL_EMERGENCY`, `URGENT`, `ROUTINE`)
  - `contactPerson`: Subdocument `{ name: string, phone: string, relationship: string }`
  - `requiredDate`: Date
  - `medicalJustification`: string (optional)
  - `additionalNotes`: string (optional)
  - `status`: string enum (`REQUESTED`, `VERIFIED`, `APPROVED`, `RESERVED`, `ISSUED`, `COMPLETED`, `REJECTED`, `CANCELLED`)
  - `statusReason`: string (optional, audit explanation for status changes)
  - `statusUpdatedAt`: Date
  - `createdAt`, `updatedAt`: Date (timestamps: true)
- **Compound Indexes**: `{ status: 1, priority: 1 }`, `{ createdAt: -1 }`, `{ requestCode: 1 }`
- **Requires Confirmation**: Mandatory requirement of signed physical doctor requisition upload or file attachment (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.7 `reservations`
- **Purpose**: Locks a specific approved blood unit to a specific approved request to prevent race conditions.
- **Relationships**: Many-to-One with `blood_requests`; One-to-One with `blood_units`.
- **Known Fields**:
  - `_id`: ObjectId
  - `requestId`: ObjectId (ref: `blood_requests`, indexed)
  - `unitId`: ObjectId (ref: `blood_units`, unique index)
  - `reservedBy`: ObjectId (ref: `users`)
  - `reservedAt`: Date
  - `expiresAt`: Date (time window before automated un-reservation)
  - `status`: string enum (`ACTIVE`, `FULFILLED_ISSUED`, `RELEASED_CANCELLED`, `EXPIRED`)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Exact reservation hold duration window before automatic release (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.8 `blood_issues`
- **Purpose**: Formal record of blood dispensing from physical inventory.
- **Relationships**: Many-to-One with `blood_requests`; One-to-One with `blood_units`.
- **Known Fields**:
  - `_id`: ObjectId
  - `issueVoucherCode`: string (unique)
  - `requestId`: ObjectId (ref: `blood_requests`, indexed)
  - `unitId`: ObjectId (ref: `blood_units`, indexed)
  - `issuedToName`: string (transporter / attendant / nurse receiving bag)
  - `issuedToIdNumber`: string (national ID or staff badge)
  - `crossMatchResult`: string enum (`COMPATIBLE`, `EMERGENCY_UNMATCHED`)
  - `issuedBy`: ObjectId (ref: `users`)
  - `issuedAt`: Date
  - `remarks`: string (optional)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Legal documentation and signature requirements for emergency unmatched release (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.9 `campaigns` & `campaign_registrations`
- **Purpose**: Scheduling donation drives and collecting public pledge attendances.
- **Known Fields (`campaigns`)**: `_id`, `title`, `description`, `locationAddress`, `startDate`, `endDate`, `targetUnits`, `status` (`PLANNED`, `ACTIVE`, `COMPLETED`, `CANCELLED`).
- **Known Fields (`campaign_registrations`)**: `_id`, `campaignId`, `fullName`, `phone`, `email`, `bloodGroup`, `pledgedDate`, `hasAttended`.

---

### 2.10 `notifications` & `audit_logs`
- **`notifications`**: System alerts (`type`: `LOW_INVENTORY_WARNING`, `EXPIRATION_ALERT`, `EMERGENCY_REQUEST`; `isRead`: boolean).
- **`audit_logs`**: Immutable security ledger (`userId`, `action`: e.g. `TEST_APPROVAL`, `entityType`: `blood_units`, `entityId`, `previousState`, `newState`, `ipAddress`, `timestamp`).

---

## 3. High-Level Entity Relationships

```
[ Donors ] (1) ─────────── (N) [ Donations ] (1) ─────────── (1..N) [ Blood Units ]
                                                                           │
                                                                           ├─ (1:1) [ Blood Tests ]
                                                                           │
                                                                           ├─ (1:1) [ Reservations ] ── (N:1) ── [ Blood Requests ]
                                                                           │                                           ▲
                                                                           └─ (1:1) [ Blood Issues ] ──────────────────┘
```

> **Schema Implementation Standard**: Each schema will be introduced alongside its validation DTO and NestJS module in strict vertical slices as outlined in `DEVELOPMENT-PLAN.md`.
