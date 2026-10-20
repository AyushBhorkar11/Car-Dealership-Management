# CDMS Secure Owner Setup & Administration

The Car Dealership Management System (CDMS) uses a local MySQL database with bcrypt password hashing and secure, signed HTTP-only cookies (`cdms_session`).

---

## 1. Creating the Owner Account via CLI

To create a new Dealership Owner account securely without exposing passwords or web endpoints, run this command in your project directory:

```bash
bun run create-owner
```

The script will prompt you for:
- Full Name (e.g., `Dealership Owner`)
- Email Address (e.g., `owner@dealership.com`)
- Secure Password

It will hash the password with bcrypt and insert the user into the `users` table with the role `OWNER`.

---

## 2. Default Seeded Accounts

When you run `bun run db:seed`, the database is populated with sample multi-branch data and pre-configured accounts:
- **Owner Account**: `owner@cdms.local` (Password: `Dealership@2026`)
- **Pune Branch Manager**: `manager.pune@cdms.local` (Password: `Dealership@2026`)
- **Mumbai Branch Manager**: `manager.mumbai@cdms.local` (Password: `Dealership@2026`)
- **Pune Sales Executive**: `rahul.pune@cdms.local` (Password: `Dealership@2026`)

---

## 3. Workflows and Access Control

- **Dealership Owner (`/owner`)**: Full company-wide authority across all branches. Approves capital expenditure purchase orders, approves inter-branch vehicle transfers, inspects live database tables via the **Database Explorer**, and reviews system audit logs and login security events.
- **Branch Manager (`/manager`)**: Scoped strictly to their showroom branch. Reviews employee quotations, approves sales discounts up to ₹50,000, evaluates customer demand, and requests stock transfers.
- **Sales Executive (`/employee`)**: Scoped to their branch and assigned customers. Creates customer leads, schedules test drives on the calendar, calculates on-road pricing with GST/RTO/insurance, records payments, and executes delivery checklists.
