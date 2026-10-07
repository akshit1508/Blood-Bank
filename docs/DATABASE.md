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

### 2.2 `donors`
- **Purpose**: Master registry of individuals who have volunteered or donated blood.
- **Relationships**: One-to-Many with `donations`.
- **Known Fields**:
  - `_id`: ObjectId
  - `donorCode`: string (unique, human-readable registration code)
  - `fullName`: string
  - `dateOfBirth`: Date
  - `gender`: string enum (`MALE`, `FEMALE`, `OTHER`)
  - `bloodGroup`: string enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, `UNKNOWN`)
  - `phone`: string (indexed)
  - `email`: string (optional)
  - `address`: { street, city, state, postalCode }
  - `status`: string enum (`ELIGIBLE`, `DEFERRED_TEMPORARY`, `DEFERRED_PERMANENT`)
  - `deferralUntil`: Date (optional)
  - `deferralReason`: string (optional)
  - `lastDonationDate`: Date (optional)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: National identification / passport number storage regulations (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

---

### 2.3 `donations`
- **Purpose**: Record of a single physical donation event.
- **Relationships**: Many-to-One with `donors`; One-to-One or One-to-Many with `blood_units`.
- **Known Fields**:
  - `_id`: ObjectId
  - `donationCode`: string (unique)
  - `donorId`: ObjectId (ref: `donors`, indexed)
  - `donationDate`: Date
  - `donationType`: string enum (`WHOLE_BLOOD`, `APHERESIS_PLATELETS`, `APHERESIS_PLASMA`)
  - `vitals`: { bloodPressure, hemoglobin, pulse, weight, temperature }
  - `collectedVolumeMl`: number
  - `campaignId`: ObjectId (ref: `campaigns`, optional)
  - `phlebotomistUserId`: ObjectId (ref: `users`, optional)
  - `adverseReactions`: string (optional)
  - `status`: string enum (`COMPLETED`, `INCOMPLETE`, `DISCARDED`)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Minimum hemoglobin thresholds and vital parameter acceptance boundaries (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

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

### 2.6 `blood_requests`
- **Purpose**: Record of requested blood by public patients or hospitals.
- **Relationships**: One-to-Many with `reservations` and `blood_issues`.
- **Known Fields**:
  - `_id`: ObjectId
  - `requestCode`: string (unique, public tracking reference)
  - `patientName`: string
  - `patientAge`: number
  - `patientGender`: string
  - `bloodGroup`: string enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`)
  - `componentType`: string enum (`WHOLE_BLOOD`, `PRBC`, `FFP`, `PLATELETS`)
  - `unitsRequested`: number
  - `hospitalName`: string
  - `doctorName`: string
  - `urgency`: string enum (`CRITICAL_EMERGENCY`, `URGENT`, `ROUTINE`)
  - `contactPerson`: { name, phone, relationship }
  - `hospitalCaseNumber`: string (optional)
  - `requiredDate`: Date
  - `medicalJustification`: string (optional)
  - `status`: string enum (`PENDING_REVIEW`, `APPROVED`, `PARTIALLY_RESERVED`, `FULLY_RESERVED`, `ISSUED`, `REJECTED`, `CANCELLED`)
  - `reviewRemarks`: string (optional)
  - `reviewedBy`: ObjectId (ref: `users`, optional)
  - `createdAt`, `updatedAt`: Date
- **Requires Confirmation**: Mandatory requirement of signed physical doctor requisition upload (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).

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
