# Security Architecture & Boundaries

## 1. Threat Model & Boundaries

The Blood Bank Management Platform operates within a healthcare context where data integrity, clinical safety, and privacy are paramount.

### Core Security Boundaries:
1. **Public vs. Administrative Surface**:
   - Public access is limited to voluntary donor registration, blood availability lookup, and urgent blood requests.
   - All management operations (`PATCH /api/donors/:id/status`, donation intake, blood unit processing, inventory management, testing, and blood issue) are internal administrative operations.
2. **External Messaging & Privacy Boundary (WhatsApp Direct Click-to-Chat)**:
   - Direct Click-to-Chat (`wa.me`) eliminates external API credentials from the server environment, preventing credential leakage risks.
   - External notification payloads pre-fill only safe, non-sensitive verification content (donor registered name and verification notice).
3. **Sensitive Healthcare & Personal Identifiable Information (PII)**:
   - Medical screening outcomes, infectious test results, complete residential addresses, internal database IDs, and clinical notes must never be included in external messages.
4. **Data Integrity & State Protection**:
   - State machine guards enforce valid transitions and prevent unauthorized status regression.
5. **Authorization Roadmap**:
   - Current MVP endpoints are internally guarded. The full JWT and Role-Based Access Control (RBAC) vertical slice is documented in the development plan.
