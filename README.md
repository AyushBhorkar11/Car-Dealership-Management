# Car Dealership Management System (CDMS)

A modern, high-performance web platform and management system designed for multi-branch new-car dealerships in India. Built with a **demand-driven procurement model**, customer demand and confirmed bookings trigger vehicle orders from manufacturers rather than maintaining blind, speculative inventory.

---

## Key Features by Login Role

### 1. Sales Executive / Employee (`/employee`)
- **Customer CRM**: Register and manage customer profiles, contact info, city, address, and Indian ID proof references (Aadhaar, PAN, Driving Licence, Voter ID, Passport).
- **Lead Pipeline**: Six-stage enquiry lifecycle (`NEW` → `CONTACTED` → `TEST_DRIVE` → `QUOTED` → `BOOKED` → `CLOSED_WON` / `CLOSED_LOST`) with follow-up date tracking and activity notes.
- **Test Drive Calendar**: Book customer test drives with automated vehicle slot collision avoidance and capture structured post-drive feedback.
- **On-Road Quotation Builder**: Accurate Indian pricing computation:
  $$\text{On-Road Price} = \text{Ex-Showroom} + \text{GST (28\%)} + \text{RTO/Road Tax (10\%)} + \text{Insurance (3.5\%)} + \text{Accessories} - \text{Discount}$$
  - Enforces discount policy limits: discounts exceeding ₹25,000 automatically escalate to the Branch Manager for approval.
  - Printable quotation summary dialog.
- **Demand-Driven Booking**: Seamlessly convert approved quotations into confirmed bookings:
  - If a matching car is in branch stock, it is immediately reserved (`RESERVED`).
  - If unavailable, the system automatically raises a procurement purchase request to the manufacturer linked to the customer's enquiry.
- **Payment Collection**: Record payments across stages (Booking Amount, Down Payment, Balance Installment) supporting Cash, UPI, Cheque, Bank Transfer, and Loan financing, generating receipt IDs.
- **Delivery Checklist**: Manage pre-delivery verification (Form 20/21, insurance certificate, RTO registration number, fastag, accessories fitment, customer handover date).
- **Personal Dashboard**: Real-time sales metrics, follow-ups due today, monthly target progress, and quick actions.

### 2. Branch Manager (`/manager`)
- **Branch Scope Isolation**: Strictly scoped to the manager's assigned branch.
- **Staff Operations**: Monitor branch sales executives, set individual monthly sales targets, and toggle account activation status.
- **Lead Operations**: View all branch leads, reassign enquiries among team members, and monitor overdue follow-ups.
- **Approvals Queue**: Review pending discount requests exceeding sales executive thresholds and branch procurement requests with approval/rejection comments.
- **Inventory & Ageing**: Track branch stock with VINs, colours, statuses, and ageing buckets (<30 days, 30–60 days, 60–90 days, 90+ days). Request inter-branch vehicle transfers.
- **Sales & Collections**: Monitor all branch orders, total revenue, collected payments, and pending balances.
- **Branch Performance Analytics**: Conversion rates, model-wise sales distribution, and employee performance leaderboard.

### 3. Dealership Owner / Executive (`/owner`)
- **Company-Wide Visibility**: Full access across all dealership branches without restriction.
- **Branch Network Management**: Create and configure branches, assign branch managers, and inspect branch-level capacity.
- **Central RBAC & Staff Management**: View all staff across branches, assign roles (`OWNER`, `BRANCH_MANAGER`, `EMPLOYEE`), and manage active statuses.
- **Catalogue & Pricing Administration**: Configure vehicle models, variants, fuel types, transmission options, ex-showroom base prices, GST rates, and maximum role discount limits.
- **Procurement & Stock Allocation Stepper**: Oversee manufacturer purchase orders through the full lifecycle:
  $$\text{REQUESTED} \longrightarrow \text{MANAGER\_APPROVED} \longrightarrow \text{OWNER\_APPROVED} \longrightarrow \text{ORDERED} \longrightarrow \text{IN\_TRANSIT} \longrightarrow \text{RECEIVED} \longrightarrow \text{ALLOCATED}$$
  Directly allocate newly received cars to the waiting customer bookings that triggered procurement.
- **Inter-Branch Stock Transfers**: Approve and supervise vehicle movement between branches.
- **Financial Analytics**: High-level KPI summary cards (revenue, units sold, active leads, pending procurement, average ticket size, receivables), revenue trend analysis, branch comparison charts, and fuel segment distribution.
- **Governance & Audit Trail**: Searchable audit log viewer tracking price adjustments, approvals, stock status transitions, and staff updates, alongside daily login activity and security logs.
- **Data Export**: One-click CSV export for bookings, inventory, and staff rosters.

---

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack React with SSR, file-based routing, and type-safe server functions)
- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack React with SSR, file-based routing, and type-safe server functions)
- **Database**: [MySQL 8.0](https://www.mysql.com/) (Local database `cdms`, fully independent of third-party hosted services)
- **Authentication**: Custom local authentication (bcrypt password hashing, HMAC-signed HTTP-only session cookies, brute-force protection)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) with MySQL dialect & versioned migrations
- **Runtime & Package Manager**: [Bun](https://bun.sh)
- **UI & Styling**: [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Lucide React](https://lucide.dev)
- **Visualizations**: [Recharts](https://recharts.org)
- **3D Graphics**: Three.js & React Three Fiber (interactive showroom concept vehicle explorer)
- **Testing**: [Vitest](https://vitest.dev) & Testing Library

---

## Project Structure

```
├── drizzle/                     # Drizzle ORM MySQL schema & SQL migrations
│   ├── migrations-mysql/        # Versioned MySQL migrations (0000, 0001)
│   └── schema.ts                # Relational MySQL schema definitions
├── scripts/
│   ├── seed.ts                  # Idempotent Indian dealership seed script
│   ├── create-owner.ts          # CLI owner account generator
│   └── dump-db.ts               # Schema & data export to database.sql
├── src/
│   ├── components/
│   │   ├── cdms/                # Role dashboards (employee, manager, owner)
│   │   └── ui/                  # Reusable shadcn/ui components
│   ├── lib/
│   │   ├── cdms.functions.ts    # Secure TanStack Start server functions (RBAC & ACID)
│   │   ├── auth.functions.ts    # Authentication server functions
│   │   └── utils.ts             # Currency (INR) and date formatters
│   ├── routes/                  # TanStack Router file-based routes
│   │   ├── _authenticated/      # Authenticated layout guard
│   │   ├── employee.tsx         # /employee route with RBAC guard
│   │   ├── manager.tsx          # /manager route with RBAC guard
│   │   ├── owner.tsx            # /owner executive portal with Database Explorer
│   │   ├── auth.tsx             # Role-based login and customer registration
│   │   └── index.tsx            # Public showroom showcase
│   ├── server/
│   │   ├── auth.ts              # Bcrypt hashing, session cookies, rate-limiting
│   │   ├── db.ts                # MySQL connection pool and Drizzle client
│   │   ├── permissions.ts       # Role-to-permission matrix & status workflows
│   │   └── analytics.ts         # MySQL SQL aggregation functions
│   └── test/                    # Unit and integration test suites
├── bunfig.toml                  # Bun configuration
├── database.sql                 # Complete MySQL schema & seed export
├── drizzle.config.ts            # Drizzle Kit configuration (MySQL dialect)
├── package.json                 # Project dependencies and npm scripts
└── vite.config.ts               # TanStack Start + Vite build config
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.2+ recommended)
- Local MySQL Server 8.0 running on `localhost:3306`

### Installation & Database Setup

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and verify your local MySQL credentials:
   ```ini
   DATABASE_URL="mysql://root:PASSWORD@localhost:3306/cdms"
   SESSION_SECRET="your-secure-session-secret"
   ```

3. **Apply Database Migrations**:
   ```bash
   bun run db:migrate
   ```

4. **Seed Sample Dealership Data**:
   ```bash
   bun run db:seed
   ```

5. **Create an Owner Account (Optional)**:
   ```bash
   bun run create-owner
   ```

6. **Start the Development Server**:
   ```bash
   bun run dev
   ```
   Open `http://localhost:8080` in your browser.

### Development Server

Start the local development server:

```bash
bun run dev
```

Visit `http://localhost:3000` to view the showroom.

### Running Tests

Execute the automated test suite with Vitest:

```bash
bun run test
```

### Production Build

Create an optimized production bundle:

```bash
bun run build
```

---

## Roles & Access Control

| Role | Route | Scope | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **OWNER** | `/owner` | Company-wide (All branches) | Branch network, staff RBAC, catalogue & pricing, PO approvals, stock transfers, company financials, audit logs. |
| **BRANCH_MANAGER** | `/manager` | Assigned Branch | Employee targets & roster, lead reassignments, approvals queue (>₹25k discounts & procurement), stock ageing, branch sales. |
| **EMPLOYEE** | `/employee` | Assigned Branch (Self records) | Customer CRM, leads, test drives, quotations with on-road pricing, booking creation, demand-driven procurement triggers, payments. |
| **CUSTOMER** | `/workspace` | Customer Profile | Browse catalogue, submit enquiry/test-drive requests, track confirmed bookings. |

---

## Security & Architecture Principles

1. **Server-Side Validation**: All server operations in `src/lib/cdms.functions.ts` resolve the authenticated user session on the server. Branch IDs and user roles passed by the client are never trusted.
2. **Central Permissions Matrix**: Defined in `src/server/permissions.ts`. Every action asserts role permissions and branch boundaries before executing database queries.
3. **Database-Level Invariants**: MySQL constraints, foreign keys, unique indexes, and ACID database transactions (`db.transaction`) prevent invalid state transitions or concurrent overselling.
4. **Audit Logging**: Sensitive mutations (price overrides, discount approvals, status updates, staff assignments) write audit records to the `audit_logs` table.
