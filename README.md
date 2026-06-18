# Paracon OS

Multi-tenant, AI-integrated construction operating system for Paracon Group ("Build in Parallel").
Phase 1: hardened multi-tenancy/auth/RBAC, full Roles & Permissions and invite-by-email, a
Super Admin area (orgs, AI defaults, settings, audit, impersonation), Modules wiring, AI usage
viewer, org branding (R2 logo + accent guardrail), an audit log viewer, and the Config settings
registry.

## Stack

Next.js 14 (App Router) + TypeScript, Tailwind + shadcn/ui, Prisma + PostgreSQL (Neon), Auth.js
(credentials + custom RBAC), Vercel AI SDK, PWA, Vitest + Playwright.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env        # macOS / Linux / Git Bash
   ```

   ```powershell
   Copy-Item .env.example .env # Windows PowerShell
   ```

   ```cmd
   copy .env.example .env      # Windows Command Prompt
   ```

   Fill in:
   - `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — from your Neon project (pooled + direct connection strings).
   - `NEXTAUTH_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `OPENAI_API_KEY` — used to seed the GLOBAL AI setting so the "Test Connection" button works out of the box.
   - `RESEND_API_KEY` / `EMAIL_FROM` — optional; without a key, invite emails log their link to the
     console instead of sending, so the invite flow still works locally.
   - `APP_URL` — used to build accept-invite links (defaults to `http://localhost:3000`).
   - `R2_*` — optional; without them, org logo upload will fail (branding accent swatches still work).

3. **Push the schema and seed demo data**

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

   Seeds Paracon Group with four demo logins, plus a separate Platform org holding the Super Admin
   account — all password `Demo1234!`:

   | Email | Role |
   |---|---|
   | director@paracon.com.au | Director (full org admin) |
   | pm@paracon.com.au | Project Manager |
   | foreman@paracon.com.au | Site Foreman |
   | estimator@paracon.com.au | Estimator |
   | superadmin@paracon-os.com | Super Admin (platform-wide, separate org) |

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Testing

```bash
npm run test       # Vitest unit tests (tenant scoping)
npm run test:e2e   # Playwright e2e (requires a seeded DB + dev server running)
```

## PWA / offline check

The service worker only registers in production builds:

```bash
npm run build
npm run start
```

Then install the app from the browser's install prompt, or use Chrome DevTools → Application →
Service Workers to confirm `sw.js` is active.

## Demo via ngrok

```bash
npm run build && npm run start
ngrok http 3000
```

Share the HTTPS URL it gives you, along with the demo logins above. Set `NEXTAUTH_URL` to the
ngrok URL before starting the server if cookies misbehave across the tunnel.

## Known limitations

- Billing remains a stub — wired up in a later phase.
- Modules (Tender, Projects, Labour, Forecast, Allocation, Site Updates, Productivity) have no
  real pages yet — `lib/modules.ts`'s `requireModuleEnabled()` is the hook point Phase 2+ route
  groups call into; there's nothing to gate today.
- The in-memory rate limiter (`lib/rate-limit.ts`) is single-instance only — graduate to a shared
  store (Upstash/Redis) before multi-instance production.
