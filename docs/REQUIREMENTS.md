# Requirements Specification: Blood Bank Management & Public Availability Platform

## 1. Project Purpose
The Blood Bank Management & Public Blood Availability Platform is a dedicated, production-ready digital system designed to streamline, track, and secure the end-to-end blood donation, testing, inventory management, and issuance workflows for **ONE physical blood bank centre**. 

The system bridges the public community (individuals in urgent need of blood, prospective voluntary donors, campaign participants) with internal blood bank medical, laboratory, and administrative personnel to eliminate manual tracking bottlenecks, prevent stock misallocation, enforce testing compliance, and provide transparent public availability data.

---

## 2. User Types & Actors

### A. Public User
- **Authentication**: None required. Operates completely anonymously or by providing necessary transaction-specific contact information in forms.
- **Access Level**: Read-only public dashboards, public information pages, and unauthenticated submission forms (Blood Requests, Donor Registration, Campaign Registration, Contact Inquiries).

### B. Admin / Staff User
- **Authentication**: Mandatory authentication (Email/Password or staff credentials with JWT session management).
- **Access Level**: Protected blood bank management portal (`apps/web` protected routes and authenticated `apps/api` endpoints).
- **Roles (Planned)**:
  - **Super Administrator**: System configuration, user/role management, audit review.
  - **Blood Bank Officer / Manager**: Request approval, blood reservation, inventory monitoring, reports.
  - **Lab Technician / Medical Officer**: Donor medical screening, donation logging, blood testing and validation (Approve/Reject).
  - **Dispensing / Issuing Staff**: Cross-matching verification, final issuance, release receipts.

---

## 3. Public Website Requirements

### 3.1 Home / Landing
- Real-time highlight of blood availability summary (aggregate by blood group, anonymized).
- Emergency contact numbers and blood bank location/hours.
- Clear action pathways: "Request Blood", "Become a Donor", "Find Availability", "Upcoming Donation Campaigns".

### 3.2 Blood Request Submission
- Public form allowing patients, hospital relatives, or attending doctors to submit emergency or scheduled blood requests.
- Collection of patient details, required blood group, component type, unit quantity, hospital name, urgency level, and contact person details.
- Submission tracking code generation for public status tracking without requiring a permanent user account.

### 3.3 Public Blood Availability
- Transparent, read-only display of current usable inventory grouped by blood group (A+, A-, B+, B-, AB+, AB-, O+, O-).
- Filterable by component type (Whole Blood, PRBC, Platelets, FFP) if enabled.
- Data derived strictly from tested, approved, unreserved, non-expired inventory units.

### 3.4 Donate Blood (Donor Registration)
- Public voluntary donor registration form capturing full name, date of birth, gender, blood group (if known), contact information, and address.
- Clear medical self-exclusion notice and preliminary donation eligibility guidelines.

### 3.5 Blood Donation Campaigns
- Public listing of upcoming and active mobile blood drives and community donation camps organized by the blood bank.
- Public registration form for citizens to pledge attendance at a campaign.

### 3.6 About
- Mission, physical facility overview, quality accreditation, and testing safety standards of the blood bank centre.

### 3.7 Contact
- Physical location map, address, hotline telephone numbers, emergency ambulance/lab dispatch contacts, and feedback inquiry form.

---

## 4. Admin / Management Portal Requirements

### 4.1 Dashboard
- Real-time operational overview: Available units by blood group, pending requests, pending lab tests, units nearing expiration, daily donations count.

### 4.2 Donors Management
- Comprehensive donor registry with complete donation histories, deferral records, and communication contacts.

### 4.3 Donations Management
- Logging physical donation events (date, time, donation type, donor link, preliminary screening vitals: blood pressure, hemoglobin, pulse, weight).

### 4.4 Testing & Laboratory Management
- Mandatory lab testing recording for every collected blood unit.
- Recording testing parameters (Infectious disease markers: HIV, Hepatitis B, Hepatitis C, Syphilis, Malaria, and ABO/Rh confirmation).
- Strict dual outcome: **Approved** (units advance to inventory) or **Rejected** (units marked for bio-hazard disposal, quarantined permanently).

### 4.5 Blood Units Management
- Unique barcode/unit identifier tracking for every single bag collected.
- Component separation tracking (Whole Blood, Packed Red Blood Cells, Fresh Frozen Plasma, Platelet Concentrates).
- Expiration date tracking and storage location (refrigerator/shelf ID).

### 4.6 Inventory Lifecycle Management
- Status tracking: `QUARANTINE_TESTING`, `AVAILABLE`, `RESERVED`, `ISSUED`, `EXPIRED`, `DISCARDED`.
- Automated stock decrementing upon issuance and auto-flagging of expired units.

### 4.7 Blood Requests Management
- Central triage queue for all incoming public and hospital blood requests.
- Medical review: Verify hospital documentation, prioritize urgency (`CRITICAL_EMERGENCY`, `URGENT`, `ROUTINE`).
- Approval, rejection, or fulfillment status progression.

### 4.8 Reservations Management
- Locking specific available blood units to an approved blood request to prevent double-allocation while cross-matching or patient transfer is underway.

### 4.9 Blood Issue / Dispensing
- Formal dispensing workflow with recipient verification, attending doctor authorization, and automated generation of issue voucher/gate pass.
- Irreversible transition of reserved blood units to `ISSUED`.

### 4.10 Campaigns Management
- Planning and scheduling on-site and mobile donation drives (venue, date, target units, staff assigned).
- Monitoring pledge registrations and actual donation yields per campaign.

### 4.11 Appointments
- Managing scheduled appointments for donors visiting the physical facility.

### 4.12 Reports & Analytics
- Generation of operational summaries: Monthly collection vs. issuance trends, discard/spoilage rate analysis, donor retention metrics.

### 4.13 Notifications
- Automated system alerts for low stock thresholds, units nearing expiration, critical emergency requests, and donor reminders.

### 4.14 Users & Roles
- Internal staff user account provisioning, role assignment, and access revocation.

### 4.15 Audit Logs
- Immutable, tamper-evident audit trail capturing every critical operational action: Unit status change, test approval/rejection, blood reservation, and issue release.

### 4.16 Settings
- Blood bank centre configuration: Physical address, operating hours, emergency contact numbers, threshold warning levels.

---

## 5. Scope & Boundary Clarifications

### 5.1 Confirmed Scope
- **Single Physical Centre**: Tailored strictly to one physical blood bank facility. Multi-branch networking, inter-hospital logistics transfers, or multi-tenant database partitioning are intentionally excluded from the MVP.
- **Public No-Login Model**: Public visitors can interact, check availability, register, and submit requests without creating persistent credentials.
- **Strict Role-Protected Admin Portal**: All operational changes to donor, unit, inventory, and dispensing records require authenticated, audited staff action.

### 5.2 Planned Future Requirements (Post-MVP)
- Integration with external hospital electronic medical record (EMR) systems via HL7/FHIR.
- SMS/WhatsApp gateway integration for automated donor recall and emergency shortage alerts.
- Barcode/QR code optical scanning hardware integrations.

### 5.3 Requirements Requiring Confirmation
- Specific infectious disease screening panel regulatory requirements (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).
- Exact shelf-life duration per component type (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).
- Donor deferral periods following illness, travel, or medication (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).
- Mandatory cross-matching verification documentation (**REQUIRES CLIENT/BLOOD BANK CONFIRMATION**).
