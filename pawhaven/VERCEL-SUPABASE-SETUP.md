# Petify on Vercel with Supabase

The previous Vercel failure (`NEXT_NO_ROUTES_MANIFEST`) happened because `npm run build` produced a Vinext/Cloudflare Worker, not a Next.js deployment. `vercel.json` now selects the real Next.js build. Do not point Vercel at `dist/client`: that would omit the backend.

## 1. Create the Supabase project and tables

1. Create a Supabase project you own and save the database password privately.
2. Open **SQL Editor** and run the complete contents of [`supabase/migrations/202610310001_petify.sql`](supabase/migrations/202610310001_petify.sql).
3. The migration creates a separate `petify` schema with records, customer profiles, rate limits, administrator notes/payment records, and the audit log. It enables row-level security and revokes browser-role access. Do **not** expose this schema through the Data API or grant `anon` / `authenticated` access. Petify's server enforces customer ownership and admin permissions.
4. Open the project's **Connect** dialog. Copy the **Transaction pooler** PostgreSQL URI (port 6543) for Vercel. Replace the password placeholder locally; percent-encode special password characters. A Session pooler URI also works. Keep this URI secret.

## 2. Configure email authentication

- In **Authentication → Providers → Email**, enable email sign-in and **Confirm email**. Set the minimum password length to 12 characters. Email confirmation must remain enabled because administrator access depends on verified email ownership.
- Set the Auth Site URL to `https://YOUR-VERCEL-DOMAIN/login`. Add that exact URL to the redirect allowlist; add `http://localhost:3000/login` only if you need local email-flow testing.
- Configure a production SMTP sender in Supabase Auth so real customers can receive confirmation and recovery emails.
- In both **Confirm signup** and **Reset password** email templates, include `{{ .Token }}`. Example: `Your Petify verification code is {{ .Token }}. Enter this code on the Petify page where you requested it.` The application accepts codes entered on Petify. A signup confirmation link may remain, followed by normal password login. Default password-reset links that carry tokens in a URL fragment are not used by this implementation.
- Get the **project URL** and **publishable key** from the project API settings. A legacy `anon` key is also supported. Do not use a service-role key as the publishable key.

## 3. Vercel settings

Push the updated source and lockfile to your GitHub repository. For the repository structure shown in your build log, use:

| Setting | Value |
| --- | --- |
| Root Directory | `pawhaven` |
| Framework Preset | Next.js |
| Build Command | `npm run build:vercel` |
| Install Command | `npm ci` |
| Output Directory | `.next` (or leave the Next.js default) |
| Node.js | 22.x |

`pawhaven/vercel.json` declares the framework/build/output settings. Remove stale dashboard overrides pointing at Vinext, Vite or `dist`. If you run the ordinary `npm run build` on Vercel, the build wrapper also detects `VERCEL=1` and selects Next.js.

Add these variables under **Vercel → Project Settings → Environment Variables**. Keep them server-only, with no `NEXT_PUBLIC_` prefix:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase pooler PostgreSQL URI, including the database password. Mark sensitive. |
| `SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable public key or legacy anon key |
| `ADMIN_EMAILS` | `ayushsingh941526@gmail.com` |
| `SUPABASE_DB_CA_CERT` | Optional PEM CA certificate if your database connection requires a custom CA. TLS certificate verification is never disabled. |

Configure production values for Production. Use a separate Supabase test project for Preview deployments so preview changes do not use production customer data. Redeploy after setting or changing variables. Do not paste database passwords or connection strings into chat, source code, GitHub, or browser storage.

## 4. Create your administrator login

1. Open `/register` on the Vercel site.
2. Register **ayushsingh941526@gmail.com** with a password you choose.
3. Confirm the email using the code sent to that mailbox.
4. Sign in at `/login`, then open `/admin`.

There is no hardcoded/default administrator password. Other verified emails receive customer access only. User-provided profile roles cannot grant admin privileges. ChatGPT sign-in and Sites identity headers are deliberately disabled on Vercel.

## Local verification

Use an ignored `.env.local` file for local environment values, then run:

```powershell
npm ci
npm run build:vercel
npm run start:vercel
```

For development use `npm run dev:vercel`. `npm test` checks validation/authentication; `node scripts/test-postgres.mjs` runs the API and migration against a local PostgreSQL engine without cloud credentials. The cloud provider's actual email delivery, database permissions, and connection require an additional check after configuration.

The build and public storefront work without credentials. Until the database and authentication variables are configured and the SQL migration is applied, account creation and saved business records are not operational. No mock database is substituted in production.

The existing Sites deployment uses its original Cloudflare/D1 adapter through Vite. Its data and ChatGPT accounts are **not automatically transferred** into a new Supabase project. The included SQL creates empty tables; it does not export or import existing customer records.

References: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
