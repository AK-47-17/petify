# Enable email accounts for Petify

The email login, registration, confirmation-code, password recovery and logout screens are implemented. Production email authentication remains disabled until a Supabase project is connected. ChatGPT sign-in remains available, including for the administrator.

1. Create a Supabase project that you own. In **Authentication → Providers**, enable Email and **Confirm email**. Keep email confirmation enabled: administrator access relies on verified email ownership. Set the minimum password length to 12; enable leaked-password protection if available on your plan.
2. Set the Auth Site URL to `https://petify-care-ayush.zanygrass66.chatgpt.site/login`. Add that exact URL to the redirect allowlist. Never add broad wildcard production redirects.
3. Configure a production SMTP provider in Supabase Auth. Supabase's default mail service is intended for limited testing; real customers require a configured sender. Follow the provider's domain verification instructions.
4. Under **Authentication → Email Templates**, include the code variable `{{ .Token }}` in both **Confirm signup** and **Reset password** templates. For example: `Your Petify verification code is {{ .Token }}. Enter it on the Petify screen where you requested this email.` The reset flow uses a code entered directly on Petify; the default token-fragment reset link is not used. Do not change the token variable itself. A signup confirmation link may also be retained; after confirming, the customer can sign in using their password.
5. Configure these **Sites runtime environment variables** (not source code or browser bundles):
   - `SUPABASE_URL`: `https://YOUR_PROJECT_REF.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY`: the project's publishable public key (or legacy anon key). **Never use a service-role or secret key.**
   - `ADMIN_EMAILS`: `ayushsingh941526@gmail.com` (already configured for this deployment). Comma-separated verified emails are supported. `ADMIN_USER_IDS` can also allow specific stable IDs.
6. Redeploy the saved Site version to apply environment changes. Register an account, verify the email code, sign in, request a password reset, and verify delivery using a real mailbox. Confirm that a different customer's account receives HTTP 403 from `/api/admin/summary`.

Passwords are sent over HTTPS to Supabase Auth through Petify's server. They are never stored in Petify's D1 database or logged. The provider access token is placed in a Secure, HttpOnly, SameSite cookie; it is never returned to client JavaScript or put into localStorage. Sessions expire within one hour and require sign-in again; there is deliberately no persistent refresh token. All API authorization validates the current token through Supabase Auth. Identity IDs are provider-scoped (`email:<uuid>`) so records cannot collide with existing ChatGPT accounts. Accounts using different providers are not automatically merged, even when their email matches.

Public browsing does not require either sign-in method. Customers sign in only to create/manage their own requests. There is no public administrator-registration option, and user-provided profile metadata cannot assign administrator privileges.

Official references: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [production SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
