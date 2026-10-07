# Blood Bank Management & Public Blood Availability Platform

Production-ready Blood Bank Management and Public Blood Availability Platform for **ONE physical blood bank centre**.

---

## Current Project Status
```
CURRENT STATUS:
Phase 0 — Foundation / Documentation
No business modules have been implemented yet.
```
In Phase 0, the monorepo architecture, application foundations, TypeScript build pipelines, and all foundational architecture and business specifications have been established.

---

## System Overview & Architecture
The system consists of two primary operational domains:
1. **Public Website**: Open access without login for citizens to check blood availability in real-time, register as voluntary donors, submit emergency blood requests, and browse community donation campaigns.
2. **Admin / Management Portal**: Secure, authenticated operational dashboard for blood bank medical, laboratory, inventory, and dispensing personnel.

### Technology Stack
- **Frontend**: Next.js 14+ (React 18, TypeScript)
- **Backend**: NestJS 10+ (TypeScript)
- **Database**: MongoDB with Mongoose ODM
- **Architecture**: Monorepo with strict decoupled separation:
  ```
  Next.js (Web Frontend)
        ↓
  REST API (HTTP/JSON)
        ↓
  NestJS (Domain Services & DTO Validation)
        ↓
  Mongoose Models
        ↓
  MongoDB Database
  ```

> **Strict Rule**: The Next.js frontend communicates exclusively through the NestJS REST API and NEVER connects directly to MongoDB.

---

## Monorepo Structure
```
blood-bank/
│
├── apps/
│   ├── web/                    # Next.js frontend application (Public + Admin portal)
│   └── api/                    # NestJS backend application (REST API service)
│
├── packages/                   # Shared types, interfaces, and utilities
│
├── docs/                       # Comprehensive specifications and engineering guides
│   ├── REQUIREMENTS.md         # Detailed functional & scope requirements
│   ├── ARCHITECTURE.md         # System topology & layer responsibilities
│   ├── DATABASE.md             # Data model, Mongoose schemas & relationships
│   ├── API.md                  # REST API contract & planned endpoint map
│   ├── BUSINESS-RULES.md       # Clinical boundaries & business invariants
│   ├── DEVELOPMENT-PLAN.md     # 11-phase incremental vertical slice roadmap
│   └── TESTING.md              # 10-level testing & QA strategy
│
├── .gitignore                  # Monorepo-wide git exclusion rules
├── .env.example                # Canonical environment variable blueprint
├── package.json                # Root package with npm workspaces
└── README.md                   # Project overview & operational instructions
```

---

## Development Methodology: Vertical Slices
This project is engineered using **Vertical Slices**. Development does NOT proceed by building the entire backend first followed by the frontend. 

For each individual feature:
```
Requirement → MongoDB Schema → NestJS Module → DTO Validation → Service Logic → REST Controller → API Verification → Next.js UI → Full Integration → Documentation Update → Next Slice
```

### Roadmap Phases:
- **Phase 0**: Project Foundation & Documentation *(CURRENT)*
- **Phase 1**: Blood Request Vertical Slice
- **Phase 2**: Donor Registration Vertical Slice
- **Phase 3**: Public Blood Availability
- **Phase 4**: Donations Workflow
- **Phase 5**: Testing & Laboratory Screening
- **Phase 6**: Inventory Lifecycle & Cold Chain
- **Phase 7**: Blood Request Allocation & Issuing
- **Phase 8**: Campaigns & Community Drives
- **Phase 9**: Admin Dashboard & Unified Metrics
- **Phase 10**: Reports, Notifications, Audit Logs & System Settings

---

## Quick Start & Verification

### Prerequisites
- Node.js >= 18 (Tested on v24.21.0)
- npm >= 9 (Tested on 11.19.0)
- MongoDB instance (Local or Atlas)

### Setup & Installation
```bash
# Clone and install dependencies
npm install

# Copy environment variables
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### Running Applications Independently
```bash
# Start backend API (runs on http://localhost:4000/api)
npm run dev:api

# Start frontend Web App (runs on http://localhost:3000)
npm run dev:web
```

### Verification Commands
```bash
# Run TypeScript typechecks across the monorepo
npm run typecheck

# Run linters across workspaces
npm run lint

# Build all applications for production
npm run build
```

---

## Medical Safety & Clinical Boundaries
This software operates in life-critical clinical environments. The system **never independently invents or hardcodes**:
- Medical testing requirements
- Donor screening/deferral criteria
- Blood component shelf lives
- Transfusion compatibility rules
- Disposal/biohazard compliance protocols

Any clinical rules marked with **REQUIRES CLIENT/BLOOD BANK CONFIRMATION** in `docs/BUSINESS-RULES.md` are kept configurable and require explicit confirmation from the blood bank medical director prior to hardcoding.
