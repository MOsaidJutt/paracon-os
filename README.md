# Paracon OS

Multi-tenant, AI-integrated construction operating system for Paracon Group ("Build in Parallel").
Phase 0: foundation, auth/RBAC, tenant scoping, app shell, and an AI Settings admin screen.

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

3. **Push the schema and seed demo data**

   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

   Seeds one organisation (Paracon Group) with four demo logins, all password `Demo1234!`:

   | Email | Role |
   |---|---|
   | director@paracon.com.au | Director (full org admin) |
   | pm@paracon.com.au | Project Manager |
   | foreman@paracon.com.au | Site Foreman |
   | estimator@paracon.com.au | Estimator |

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

## Known Phase 0 limitations

- Roles & Permissions, Modules, Branding and Billing admin screens are stubs — wired up in later phases.
- Org logo upload (Cloudflare R2) isn't built yet; the topbar falls back to the static Paracon wordmark.
- JWT sessions cache permissions at sign-in time — a role's permissions changing mid-session
  requires the user to sign out/in to pick up the change (acceptable for Phase 0; revisit in Phase 1).
