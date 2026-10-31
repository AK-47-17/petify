# Petify

Animated, responsive pet-care application inspired by the public service structure of thepetnest.com, with original branding, copy, layouts, illustrations and licensed stock photography.

## Deploy to Vercel with Supabase

Follow [VERCEL-SUPABASE-SETUP.md](VERCEL-SUPABASE-SETUP.md). Set the Vercel root directory to `pawhaven`; `vercel.json` selects `npm run build:vercel` and the Next.js `.next` output. Configure the Supabase database and email variables from `vercel.env.example`, and run the SQL migration in `supabase/migrations/` once in Supabase's SQL Editor. Do not use the SQLite files in `drizzle/` on Supabase.

Use `npm run dev:vercel`, `npm run build:vercel`, and `npm run start:vercel` for the Next.js version. Vercel uses Supabase PostgreSQL plus verified email login; it never trusts ChatGPT identity headers. The original Cloudflare/Vinext commands below still use the Sites/D1 runtime. These are separate deployments; existing records are not automatically migrated between them.

## Run locally

Requires Node 22.13+ and the installed dependencies. From this directory run `npm run dev`, then use the printed loopback URL. The starter supports Windows PowerShell. Sign in locally through `/signin-with-chatgpt?return_to=/account`; the development identity is a simulation, never included in production builds.

Run `npm test` for validation and security boundary tests, `npm run typecheck` for type checking, and `npm run build` to build. `npm run db:generate` generates migrations from `db/schema.ts`. Apply each new migration locally using the documented command in `README.md`; Sites applies production migrations during deployment. With the patched Vinext CLI, bind preview explicitly using `npm run dev -- --host 127.0.0.1` (the old `--hostname` flag is no longer accepted).

## Implemented

- Responsive home, seven care service categories, species and text filters, package details and three-step booking requests.
- Server-persisted bookings with preferred date/time, pet and contact details, server-calculated indicative prices, idempotency keys and cancellation of pending requests.
- Customer sign-in, private dashboard, pet and address records, order and enquiry tracking.
- Product catalog, browser-persisted cart, quantity controls and server-priced order requests. No payments are collected.
- Rehoming submission and administrator moderation; approved pet details appear in the public adoption feed. Adoption interest and specific-pet enquiries.
- Partner, membership, insurance, franchise, course, breeding, animal-welfare, referral and support enquiry workflows. These are requests, not completed subscriptions, insurance policies or professional onboarding.
- Separate business dashboard at `/admin`: totals, 14-day request chart, bookings, shop orders, all enquiry types, customer directory and activity, pet/address records, paginated search/status filters, per-page CSV exports, full request details, staff assignments, private notes, manual offline-payment records and an audit log.
- Separate email login and registration pages at `/login` and `/register`, with confirmation and password recovery. Enable delivery using `EMAIL-LOGIN-SETUP.md`; the existing ChatGPT sign-in remains available.
- Public browsing without login; only personal records and submissions require authentication.
- Journal articles, FAQ, preview policies, friendly error and 404 pages, mobile navigation and reduced-motion support.

## Backend and integration contract

The frontend calls same-origin JSON endpoints. Sites uses Cloudflare D1; Vercel uses Supabase PostgreSQL through the server-only `DATABASE_URL`. Both implement the same database interface, with parameterized queries and transactions. Supabase tables live in a private `petify` schema with RLS enabled and browser-role access revoked. Catalog prices are centralized in `lib/catalog.ts` and imported independently by the server. Replace the catalog with authoritative business data before public launch.

| Endpoint | Purpose |
| --- | --- |
| GET /api/session | Current signed-in identity and admin entitlement |
| GET /api/catalog | Services and products |
| GET /api/adoptions | Approved public pet listings, excluding owner/contact fields |
| GET /api/records | Current user's records only |
| POST /api/records | Create pet/address/booking/order/request with Idempotency-Key |
| PATCH /api/records/:id | Cancel own pending request |
| DELETE /api/records/:id | Delete own saved pet or address |
| GET /api/admin | Paginated administrator records; filter kind, status, owner, q, page |
| GET /api/admin/:id | Full request and private operations details |
| GET /api/admin/summary | Counts, daily requests and estimated/recorded financial totals |
| GET /api/admin/customers | Searchable customer directory and request totals |
| GET /api/admin/audit | Paginated administrator action history |
| PATCH /api/admin/:id/operations | Notes, assignee, manual payment record, optimistic version check |
| POST /api/auth/:action | Email register/login/verify/recover/resend/password/logout |
| PATCH /api/admin/:id | Validated status transition with expectedStatus |

All business writes require a signed-in user. Every write, including authentication, requires an exact same-origin Origin header, JSON content type, a body no larger than 16 KiB and strict schema validation. Identity comes from Sites' authenticated ingress or a provider-validated email session cookie. **Do not expose this Worker directly on another host that accepts caller-supplied identity headers.** To move to another platform, replace the identity adapter with server-verified sessions or signed JWTs and strip spoofable headers at its ingress.

### Administrator setup

The designated administrator email is `ayushsingh941526@gmail.com`, configured through the Sites runtime variable `ADMIN_EMAILS`. Sign in with that email through ChatGPT now, or through a verified Supabase email account once configured. `ADMIN_USER_IDS` also supports stable Site IDs or `email:<Supabase user UUID>`. These allowlists are server-controlled; customers cannot set their own roles. Never disable email confirmation in the authentication provider.

For local testing only, `.dev.vars` can contain `ADMIN_USER_IDS=qa_admin`. Never commit local environment files. The admin dashboard is `/admin`, and the customer dashboard is `/account`. Existing ChatGPT records keep their original owners; email and ChatGPT accounts are not automatically merged.

### Security controls

Ownership predicates on customer SQL queries, prepared statements, strict Zod schemas, atomic database rate limiting (20 writes/user/minute), idempotent creation, server price lookup, allowlisted admin identities, state transition checks, audit log, no-store API responses, safe React text rendering, request size limits, and production CSP with per-response script nonces. Assets and fonts are local. No passwords, card details or API credentials are stored in browser storage. City preference and cart product IDs/quantities are device-local.

Security depends on the trusted hosting authentication boundary, current dependencies, operational monitoring and future changes. Automated checks are not a penetration test or a guarantee that vulnerabilities cannot exist.

## Before operating as a public business

This is a working request-based application, not a verified replica of all authenticated or internal systems of the reference business. The storefront allows public browsing at the user?s request; personal data remains protected. The following require business decisions or external providers:

- Actual care-provider inventory, verification, slot scheduling, verified staff/provider accounts, cancellation/refund policy and final service prices/taxes.
- Real products, stock, shipping and fulfillment; current catalog is an illustrative opening collection.
- Configure Supabase and production SMTP to activate email authentication (see `EMAIL-LOGIN-SETUP.md`). Booking/order notifications via email, SMS or WhatsApp are separate integrations and are not sent by this version.
- Membership benefits, coupon rules, referral rewards, gift cards, insurance provider agreements and recurring subscriptions.
- Real-time veterinarian video/chat, partner schedules, payouts and identity-verification services.
- Pet photo upload/moderation and richer adoption screening; this version uses structured text listings without file uploads.
- Physical store locations, app-store listings and any production mobile app.
- Legal business name, support contacts, retention schedule and final policies. Current policies are explicitly marked preview.

The user selected **booking requests and payment after confirmation**, so no payment gateway or payment simulation is included. Administrators can record an offline payment or full refund after confirmation; these are bookkeeping entries and do not move money. Partial refunds and payment reconciliation require further accounting integration. Adding a gateway later requires server-side order creation and signed webhook verification; never trust a browser payment-success flag.

Assets: `public/images/CREDITS.md`; local fonts carry their SIL Open Font Licenses in `public/fonts`.
