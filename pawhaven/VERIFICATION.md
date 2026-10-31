# Verification — 31 October 2026

## Vercel and Supabase update

- Native Next.js production build passed and generated `.next/routes-manifest.json`, resolving the artifact missing from the reported Vercel build. Vercel now uses `npm run build:vercel`; the original Sites build remains available.
- TypeScript checks and all 15 existing validation/authentication tests passed.
- Six PostgreSQL integration tests passed using PGlite: migration reruns, schema/RLS restrictions, parameter handling, transaction rollback, ownership isolation, pricing/idempotency, administrator operations and version conflicts, private-field exclusion, customer aggregates, audit entries, rate limits, and CSRF. Auth provider responses are mocked in these tests.
- Vercel production browser checks passed on desktop and 390px mobile: public browsing, separate account/admin gates, email-only login/registration, anonymous booking prompt, nonce CSP, and rejection of forged platform identity headers. No browser console/page errors or horizontal overflow were observed on the tested pages.
- Original Cloudflare production build, 25-assertion API suite, and administrator integration suite passed after the database/runtime changes.
- Production dependency audit reported **0 known vulnerabilities**. This is a point-in-time dependency check, not proof that the application has no vulnerabilities.
- No hosted Supabase connection, actual signup/recovery email delivery, or Vercel deployment was performed. Those require the user's project configuration. Follow `VERCEL-SUPABASE-SETUP.md`; the included migration creates fresh tables and does not transfer existing Sites records.

To reproduce the PostgreSQL checks, run `npm run test:postgres`. To reproduce the Vercel browser checks, build with `npm run build:vercel`, start `npm run start:vercel` on port 3000 without Supabase variables, and run `node tests/vercel-browser.mjs` with the browser dependency described below. These browser checks intentionally verify the unconfigured public storefront and authentication boundary.

## Administrator and email-account update

- Final production build and TypeScript checks passed.
- Fifteen automated security/validation tests passed: nine booking/order/CSV tests and six authentication tests. The authentication tests mock Supabase responses; real signup email delivery is not yet configured or verified.
- Existing 25-assertion production API suite passed, including ownership isolation, pricing, idempotency, origin checks, moderation, administrator authorization and CSP.
- New administrator integration suite passed: protected summary/customer/audit endpoints, owner/contact association, search and filtering, offline payment recording, version conflicts, private-note exclusion from customer responses, audit entries, fractional pagination normalization, deletion of pets with private admin notes, authentication CSRF, and anonymous public pages.
- Chrome tests passed for desktop and 390px mobile admin navigation, request details, saving internal notes, customer activity, separate anonymous admin gate, login/registration pages, and public storefront. No page errors were recorded. Existing production booking submission also passed with zero console errors.
- Desktop/mobile dashboard and login screenshots were inspected. Mobile tables scroll horizontally inside their container instead of compressing customer details or overflowing the page.
- Production dependency audit: **0 known vulnerabilities**. No dependencies were added for this update.
- Administrator email is configured as `ayushsingh941526@gmail.com`. Email/password activation still requires the Supabase project and SMTP setup described in `EMAIL-LOGIN-SETUP.md`; ChatGPT authentication remains available.

## Original storefront verification — 30 October 2026

- Production build completed on Windows with Vinext 1.4.0, React 19.3.1 and Vite 8.3.5.
- TypeScript checks passed.
- Eight validation tests passed (`npm test`).
- Nine page routes checked, including the not-found behavior.
- Chromium browser flows passed: mobile navigation, cat-service filtering, sign-in, booking, cancellation, saved pet creation, cart and order submission.
- Desktop and 390px mobile screenshots inspected. Decorative mobile overflow and text encoding defects were corrected.
- Production API checks passed: authentication, separate-user isolation, server-calculated pricing, request idempotency, origin validation, administrator authorization, stale state rejection, adoption publishing/archiving, private-field exclusion, rate limits and nonce-based CSP.
- Production browser booking completed under CSP with zero browser console errors in that flow.
- Final `npm audit` reports **0 known vulnerabilities**, including development dependencies. This is a point-in-time dependency result, not a guarantee about all possible vulnerabilities.
- All test records and administrator identities belong to the local database and local test configuration. They are not included in the deployment artifact.

## Reproduce browser checks

Install `playwright-core` in the ignored `outputs/qa` directory (`npm install --prefix outputs/qa --no-save --package-lock=false playwright-core`). The scripts use the existing Windows Chrome installation; adjust its executable path on another machine.

For `node tests/browser.mjs`, start the loopback development preview and apply the database migration first. Tests create local sample records.

For `node tests/api.integration.mjs`, `node tests/admin.integration.mjs`, `node tests/admin-browser.mjs` and `node tests/production-browser.mjs`, build, apply both database migrations locally, and start the local production Worker with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8787 --inspector-port 0 --var ADMIN_USER_IDS:qa_admin`. Run API suites sequentially; the administrator rate limit is shared across test scripts. These tests emulate trusted platform identities through headers only on the local Worker. Production must remain behind Sites' authenticated ingress, which validates and injects those identities. Never expose a direct Worker route that trusts arbitrary user-supplied identity headers.

The framework build emits upstream source-map and future-config warnings, but exits successfully. No independent penetration test, real provider fulfillment, notification delivery, insurance purchase, or live payment transaction was performed. See README-PETIFY.md for the implementation boundaries and remaining business setup.
