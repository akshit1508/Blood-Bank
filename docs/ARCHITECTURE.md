# System Architecture: Blood Bank Management Platform

## 1. Architectural Philosophy & Overview
The Blood Bank Management Platform is architected as a clean, decoupled TypeScript monorepo with high cohesion and low coupling. Safety, traceability, and strict layer boundaries are paramount, given the life-critical context of blood product handling.

The system is strictly divided into an independent client layer (`apps/web`), an independent REST API domain service layer (`apps/api`), shared structures (`packages`), and centralized documentation (`docs`).

---

## 2. Layer Separation & Topology

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│               Next.js 14+ (React 18 + TypeScript)           │
│  - Public Portal (Unauthenticated Web Pages & Forms)        │
│  - Admin Portal (Authenticated Management UI & Dashboards)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTPS / JSON REST API Calls
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                      │
│                  NestJS 10+ (TypeScript)                    │
│  - Global Validation Pipes (DTOs & class-validator)         │
│  - Guards (JWT Authentication & Role-Based Authorization)   │
│  - REST Controllers (HTTP routing, status codes, DTO mapping│
│  - Domain Services (Business logic, transactions, state)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Mongoose Schema & Query Engine
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Persistence Layer                      │
│                      MongoDB Database                       │
│  - Strongly typed Mongoose Models & Schemas                 │
│  - Atomic updates & document relationships                  │
│  - Audit logs and state transition history                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Boundaries & Strict Rules
1. **Next.js (`apps/web`)**:
   - Sole responsibility: Presentation, client-side routing, user interaction, form input capture, error presentation, and dashboard rendering.
   - **CRITICAL RULE**: Next.js must NEVER connect directly to MongoDB. All data retrieval and mutations must pass through the NestJS REST API.
2. **REST API (`apps/api`) Controllers**:
   - Expose versioned or prefixed `/api/*` endpoints.
   - Responsible strictly for HTTP protocol concerns: extracting payloads/params, delegating to services, and returning structured HTTP responses.
3. **Domain Services (`apps/api` Services)**:
   - Encapsulate 100% of the domain business logic, validation workflows, state machine transitions, and inventory updates.
   - No business logic should reside in React components or bare controllers.
4. **Data Access (Mongoose Models)**:
   - Define MongoDB collection schemas, indexes, timestamps, and data types.
   - Interacted with exclusively through NestJS services via `@nestjs/mongoose`.

---

## 3. Monorepo Structure

```
blood-bank/
│
├── apps/
│   ├── web/                    # Next.js frontend application (Public + Admin portal)
│   │   ├── src/
│   │   │   ├── app/            # App router pages, layouts, route handlers
│   │   │   ├── components/     # Reusable UI elements (cards, forms, tables)
│   │   │   └── lib/            # API client utilities, helper functions
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                    # NestJS backend application (REST API)
│       ├── src/
│       │   ├── main.ts         # Application entry point, global pipes & cors
│       │   ├── app.module.ts   # Root module (Config, Mongoose, Feature modules)
│       │   ├── app.controller.ts
│       │   └── app.service.ts
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── nest-cli.json
│       └── package.json
│
├── packages/                   # Shared types, interfaces, and utilities
│   └── README.md
│
├── docs/                       # Comprehensive architectural & business specifications
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── BUSINESS-RULES.md
│   ├── DEVELOPMENT-PLAN.md
│   └── TESTING.md
│
├── .gitignore
├── .env.example
├── package.json                # Root package with npm workspaces
└── README.md
```

---

## 4. End-to-End Business Flow & Lifecycle Pipeline

The operational lifecycle of the blood bank centre follows a rigorous sequential chain of custody:

```
[ DONOR ]
    │ (Registers online or onsite; medical screening)
    ▼
[ DONATION ]
    │ (Blood collection logged with volume, bag type, timestamp)
    ▼
[ BLOOD UNIT ]
    │ (Unique unit identifier assigned; placed in QUARANTINE_TESTING)
    ▼
[ TESTING ]
    │ (Infectious disease markers & ABO/Rh laboratory testing)
    ├──► [ REJECTED ] ──► Biohazard Disposal & Permanent Quarantine
    │
    └──► [ APPROVED ]
            ▼
      [ INVENTORY ]
            │ (Usable stock; public availability counter increments)
            ▼
      [ BLOOD REQUEST ]
            │ (Submitted by public/hospital; verified by blood bank officer)
            ▼
      [ RESERVATION ]
            │ (Specific compatible blood unit locked to request; cannot be double-allocated)
            ▼
      [ BLOOD ISSUE ]
            │ (Final cross-match check, recipient verification & gate pass issuance)
            ▼
      [ ISSUED ] (Unit marked ISSUED; removed from usable inventory permanently)
```

> **Implementation Note**: This end-to-end workflow represents the complete operational pipeline of the blood bank. In accordance with vertical slice architecture, it will be constructed iteratively phase-by-phase with complete integration tests at every transition boundary.

---

## 5. Donor Notification & WhatsApp Architecture (Phase 6E)

```
┌─────────────────┐       ┌─────────────────┐       ┌───────────────────┐
│ Admin Dashboard │ ───►  │ Next.js Client  │ ───►  │ NestJS Controller │
│   (Approve UI)  │       │  (donor-api.ts) │       │ (donors.controller)│
└────────┬────────┘       └─────────────────┘       └─────────┬─────────┘
         │                                                    │
         │ Direct Click-to-Chat (wa.me)                       │ Status Update
         ▼                                                    ▼
┌──────────────────┐                                ┌───────────────────┐
│  WhatsApp Web /  │                                │   DonorsService   │
│   Mobile App     │                                │  (status: ACTIVE) │
└────────┬─────────┘                                └───────────────────┘
         │
         ▼
┌──────────────────┐
│   Donor Phone    │
│  (Verification)  │
└──────────────────┘
```

### Architectural Principles:
1. **Direct Click-to-Chat Pattern (`wa.me`)**:
   - Verification notifications use the direct WhatsApp Click-to-Chat standard (`https://wa.me/{phone}?text={encodedMessage}`).
   - Requires zero third-party API credentials, tokens, or phone number IDs in `.env`.
   - Admin staff can review and approve a donor (`PENDING_REVIEW` &rarr; `ACTIVE`) and instantly launch WhatsApp Web or mobile app with a pre-filled, canonical verification message.
2. **Decoupled Persistence**:
   - The database status change `PENDING_REVIEW` &rarr; `ACTIVE` is the primary authoritative source of truth.
   - WhatsApp message dispatch occurs directly via client redirection to WhatsApp with pre-filled content, completely eliminating external API timeout hazards or server-side failure coupling.
3. **Canonical Safe Content**:
   - Standardized safe verification message informing the donor of their approved status without exposing sensitive medical or internal system data.


