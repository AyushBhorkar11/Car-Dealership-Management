## CDMS architecture
- Use nine normalized business tables plus a separate protected user_roles table; bookings and demand live in enquiries to preserve the simplified relational model.
- Public catalogue reads use a publishable-key server function and TanStack Query; private workspace reads use the authenticated browser client and database RLS to keep branch/customer scopes enforced.
- Keep monetary and inventory invariants in PostgreSQL constraints and triggers, with UI validation for immediate feedback; concurrent requests must not bypass business rules.
- Keep the interactive concept vehicle lazy-loaded behind ClientOnly; SSR must not import browser-only rendering code.
- Public sections use separate content routes; the home catalogue anchor is a preview within the home journey, not a replacement for the collection route.
