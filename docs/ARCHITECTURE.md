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
