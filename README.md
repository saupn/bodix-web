# BodiX

Nền tảng fitness theo triết lý **Completion-first** — giúp người tập hoàn thành hành trình thay đổi cơ thể thông qua các chương trình có điểm đầu và điểm cuối rõ ràng.

Ba chương trình: **BodiX 21** (21 ngày) · **BodiX 6W** (6 tuần) · **BodiX 12W** (12 tuần)

---

## Architecture

```
Browser / Flutter App
        │
        ├── Next.js 16 (Vercel)
        │     ├── App Router (SSR / RSC)
        │     ├── API Routes (/api/**)
        │     └── Edge Middleware (auth guard, rate limit)
        │
        └── Supabase
              ├── PostgreSQL (27 tables, 4 materialized views)
              ├── Auth (email + phone OTP)
              ├── Realtime (daily_checkins subscribe)
              ├── Storage (progress-photos, backups)
              └── Edge Functions (8 Deno functions, cron-driven)
```

**Key design decisions:**
- Server Components by default; `"use client"` only when interactivity is required
- All DB writes go through API routes (business logic, validation, RLS enforcement)
- Flutter/mobile clients call Supabase directly for reads; Next.js API for writes
- Every table has RLS; admin access via `service_role` (bypasses RLS)
- Nudging system is fully server-driven (Edge Functions + cron), no client polling

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Supabase CLI | latest (`npm i -g supabase`) |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/bodix-web.git
cd bodix-web
npm install
```

### 2. Environment variables

```bash
cp .env.production.example .env.local
```

Fill in `.env.local` with your Supabase project values:

```env
# Minimum required for local dev:
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Get these from: **Supabase Dashboard → Project → Settings → API**

### 3. Database setup

Run all migrations against your Supabase project:

```bash
supabase db push
# or apply individually:
supabase migration up
```

Migrations are in `supabase/migrations/` and must be applied in order (001 → 020).

### 4. Supabase Auth configuration

In **Supabase Dashboard → Authentication → General**:
- JWT expiry: `3600` (1 hour)
- Refresh token expiry: `604800` (7 days)
- Enable "Detect and revoke compromised refresh tokens": ON

### 5. Storage buckets

Create two private buckets in **Supabase Dashboard → Storage**:

| Bucket | Access | Max size | MIME types |
|--------|--------|----------|------------|
| `progress-photos` | Private | 5 MB | image/jpeg, image/png, image/webp |
| `backups` | Private | — | application/json |

Storage policy for `progress-photos` (both upload and read):
```
bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text
```

### 6. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Development Workflow

### Scripts

```bash
npm run dev        # Development server with hot reload
npm run build      # Production build
npm run start      # Start production build locally
npm run lint       # ESLint
npm run analyze    # Bundle analyzer (ANALYZE=true next build)
```

### Project conventions

- **TypeScript strict mode** — no implicit `any`
- **Tailwind CSS only** — no CSS modules, no inline styles
- **Zod validation** on all API route inputs (`lib/validation/schemas.ts`)
- **Rate limiting** on auth and payment routes (`lib/middleware/rate-limit.ts`)
- **Sentry** for error tracking — use helpers in `lib/monitoring/index.ts`

### Adding a new API route

1. Create `app/api/[feature]/route.ts`
2. Import `createClient` from `lib/supabase/server.ts`
3. Validate input with Zod schema
4. Apply rate limiting if user-facing
5. Return typed `NextResponse.json()`

### Adding a new database table

1. Create `supabase/migrations/NNN_description.sql`
2. Define table, indexes, RLS policies
3. Add to `docs/data-models.md`
4. Run `supabase db push`

### Adding a new Edge Function

1. Create `supabase/functions/[name]/index.ts`
2. Add `[NAME]_SECRET` to `.env.production.example` and Supabase Edge Function Secrets
3. Protect with `x-function-secret` header check
4. Document in `docs/edge-functions.md`
5. Deploy: `supabase functions deploy [name]`

---

## Supabase Edge Functions

Eight cron-driven Deno functions handle all automated nudging and maintenance:

| Function | Schedule (ICT) | Purpose |
|----------|---------------|---------|
| `morning-reminder` | Daily 7:00 AM | Push/Zalo workout reminder |
| `evening-confirmation` | Daily 9:00 PM | Evening check-in nudge |
| `dropout-scanner` | Daily 6:00 AM | Risk scoring, rescue triggers, auto-pause |
| `trial-expiration` | Daily 8:00 AM & 4:00 PM | Trial expiry reminders (24h, 6h) |
| `weekly-review-reminder` | Saturday 7:00 AM | Weekly review prompt |
| `midprogram-trigger` | Daily 8:00 AM | Mid-program reflection trigger |
| `weekly-report` | Sunday 7:00 AM | Founder weekly summary |
| `weekly-backup` | Sunday 3:00 AM | Export DB → JSON → Storage (keep 4) |

Deploy all functions:
```bash
supabase functions deploy --no-verify-jwt
```

Set secrets for each function:
```bash
supabase secrets set MORNING_REMINDER_SECRET=<value>
# repeat for each function secret
```

---

## Deploy to Production

### Vercel (automatic)

- **Production**: push to `main` → Vercel deploys automatically
- **Preview**: push to any branch or open a PR → Vercel creates a preview URL

First-time setup — add all environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**. See `.env.production.example` for the full list.

### First deploy checklist

- [ ] All env vars added to Vercel
- [ ] Supabase migrations applied (`supabase db push`)
- [ ] Storage buckets created (`progress-photos`, `backups`)
- [ ] Supabase Auth settings configured (JWT expiry, refresh token)
- [ ] Edge Functions deployed + secrets set
- [ ] Supabase Auth redirect URL set to `https://bodix.vn/auth/callback`
- [ ] UptimeRobot monitors configured (see Monitoring section)
- [ ] Vercel Analytics enabled (Dashboard → Project → Settings → Analytics)

### Database migrations in production

```bash
supabase db push --db-url postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

---

## CI/CD

GitHub Actions runs automatically on:
- Push to `main` or `develop`
- Pull requests targeting `main`

Pipeline steps: **Type Check → Lint → Build**

Required GitHub Secrets (Settings → Secrets → Actions):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Monitoring

### UptimeRobot (free tier)

Add two monitors at [uptimerobot.com](https://uptimerobot.com):

| Monitor | Type | URL | Interval |
|---------|------|-----|----------|
| BodiX Homepage | HTTP(S) | `https://bodix.vn` | 5 min |
| BodiX Health Check | Keyword | `https://bodix.vn/api/health` | 5 min |

For the keyword monitor, set keyword to `"status":"ok"`.

### Sentry

Error tracking is pre-configured. Source maps are uploaded during CI build using `SENTRY_AUTH_TOKEN`.

Custom tracking helpers in `lib/monitoring/index.ts`:
- `trackCheckIn()` — check-in events
- `trackPayment()` — payment events
- `trackRescue()` — rescue interventions
- `trackDropout()` — dropout signals

### Vercel Analytics

Web Vitals (LCP, FID, CLS) are tracked automatically via `@vercel/speed-insights`. Enable in **Vercel Dashboard → Project → Settings → Analytics**.

---

## Key File Locations

| What | Where |
|------|-------|
| Supabase clients | `lib/supabase/client.ts` · `server.ts` · `service.ts` |
| Middleware (auth guard) | `middleware.ts` |
| Rate limiting | `lib/middleware/rate-limit.ts` |
| Zod schemas | `lib/validation/schemas.ts` |
| Milestone logic | `lib/completion/milestones.ts` |
| Nudge templates | `lib/nudging/templates.ts` |
| Admin auth check | `lib/admin/verify-admin.ts` |
| DB migrations | `supabase/migrations/` |
| Edge Functions | `supabase/functions/` |
| API docs | `docs/api-reference.md` |
| Data models + Dart classes | `docs/data-models.md` |
| Flutter setup guide | `docs/flutter-setup.md` |
| Edge Functions docs | `docs/edge-functions.md` |
| Postman collection | `docs/bodix-api.postman_collection.json` |
| Env variable template | `.env.production.example` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (email + phone OTP) |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Edge Functions | Deno (Supabase Edge Runtime) |
| Hosting | Vercel |
| Error tracking | Sentry (`@sentry/nextjs`) |
| Analytics | Vercel Analytics + Speed Insights |
| Email | Resend |
| SMS / ZNS | SpeedSMS · Zalo ZNS |
| Payment | VNPay · Stripe |
| Charts | Recharts |
| Animation | Framer Motion |
| Validation | Zod |
