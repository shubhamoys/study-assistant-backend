# StudyLoop — Backend API

The backend for **StudyLoop**, a spaced-repetition flashcard platform. This is a [NestJS](https://nestjs.com/) + [GraphQL](https://graphql.org/) (code-first, Apollo Server) API backed by PostgreSQL, and it's the service both frontend apps in this project talk to:

- `study-assistant-frontend` — the main, consumer-facing app (browse/study decks, build custom decks, buy premium decks).
- `study-assistant-admin-frontend` — the admin panel (user/deck/category management, analytics, coupons).

It handles authentication, decks & flashcards, the FSRS spaced-repetition study engine, the deck marketplace (cart, checkout, Razorpay payments, coupons), reviews/ratings, and all admin operations.

This README covers the backend only. **You'll want all three projects running together** — see [Running the full project](#running-the-full-project-all-three-apps) at the bottom.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [NestJS 11](https://nestjs.com/) (Express under the hood) |
| API | GraphQL, code-first, via `@nestjs/graphql` + Apollo Server 5 |
| Database | PostgreSQL 16 (via Docker) |
| ORM | TypeORM |
| Auth | JWT (access token) + rotating opaque refresh tokens, Passport |
| Payments | [Razorpay](https://razorpay.com/) (test mode) |
| Email | Nodemailer via [Mailtrap](https://mailtrap.io/) (dev sandbox) — falls back to logging to the console if not configured |
| Scheduling algorithm | [ts-fsrs](https://www.npmjs.com/package/ts-fsrs) (Free Spaced Repetition Scheduler) |
| Email templates | [Handlebars](https://handlebarsjs.com/) |
| File uploads | Local disk (dev stand-in for an object store like Cloudflare R2) |
| Language | TypeScript |

## Prerequisites

Install these before you start:

- **[Node.js](https://nodejs.org/) 20 or later** and npm (npm ships with Node)
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (or Docker Engine + the Compose plugin on Linux) — used to run PostgreSQL, so you don't need Postgres installed natively
- A **[Razorpay](https://razorpay.com/)** account (free) with Test Mode API keys — only needed if you want to test the checkout/payment flow; the rest of the app works without it
- Optionally, a **[Mailtrap](https://mailtrap.io/)** account (free) if you want real verification/reset-password emails to land in an inbox — without it, the backend just logs the email content (including the link) to the console, so every auth flow is still fully testable

## Setup — from cloning to running

**1. Clone the repo and install dependencies**

```bash
git clone <this-repository-url>
cd study-assistant-backend
npm install
```

**2. Create your environment file**

```bash
cp .env.example .env
```

Then open `.env` and fill in the following (everything else already has a sensible local-dev default):

| Variable | What to put there |
|---|---|
| `JWT_SECRET` | Any long random string (e.g. `openssl rand -hex 32`, or just mash the keyboard) |
| `JWT_REFRESH_SECRET` | A **different** long random string from `JWT_SECRET` |
| `SEED_ADMIN_PASSWORD` | Any password you'll use to log into the seeded admin account |
| `SEED_REVIEWER_PASSWORD` | Any password — used by two seeded demo reviewer accounts |
| `RAZORPAY_API_KEY` / `RAZORPAY_SECRET_KEY` | Your Razorpay **Test Mode** key ID/secret (Dashboard → Settings → API Keys). Only needed to test checkout — everything else works without it. |
| `MAILTRAP_USER` / `MAILTRAP_PASS` | Optional — leave blank to have emails logged to the console instead |

**3. Start PostgreSQL**

```bash
docker compose up -d
```

This starts a Postgres 16 container, exposed on **host port 5433** (not 5432 — see the comment in `docker-compose.yml` if you're curious why, or if you need to change it — just make sure `DATABASE_URL` in `.env` still matches whatever port you pick).

**4. Run database migrations**

```bash
npm run migration:run
```

**5. Seed the database**

```bash
npm run db:seed
```

This creates:
- An admin account (`SEED_ADMIN_EMAIL` from your `.env`, default `admin@studyloop.dev`, password = whatever you set `SEED_ADMIN_PASSWORD` to) with the **Super Admin** role — this is the account you'll use to log into the admin app.
- Two demo reviewer accounts (`john.doe@studyloop.dev`, `marcus.demo@studyloop.dev`, password = `SEED_REVIEWER_PASSWORD`) with some existing reviews.
- 3 categories (Computer Science, Languages, Medicine) and 3 public decks with flashcards (JavaScript Fundamentals, Spanish Basics, Anatomy 101) to browse and study right away.

Re-running `npm run db:seed` later is always safe — it upserts rather than duplicating.

**6. Start the server**

```bash
npm run start:dev
```

The API is now running at **http://localhost:4000** — open **http://localhost:4000/graphql** in a browser to get Apollo Sandbox, where you can explore and run queries/mutations directly against a live schema.

## Important commands

| Command | What it does |
|---|---|
| `npm run start:dev` | Start the server in watch mode (auto-restarts on file changes) — what you want for local development |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run the compiled build (`node dist/main`) |
| `npm run lint` | ESLint, with auto-fix |
| `npm run test:e2e` | Run the full end-to-end test suite (169 tests) against your configured database — see the caution note below |
| `npm run migration:run` | Apply any pending database migrations |
| `npm run migration:generate -- src/database/migrations/SomeName` | Generate a new migration after changing an entity |
| `npm run migration:revert` | Undo the most recently applied migration |
| `npm run migration:show` | List applied/pending migrations |
| `npm run db:seed` | Re-run the seeder (safe to run repeatedly) |
| `npm run db:reset` | **Destructive** — drops every table, re-runs all migrations, then re-seeds. Use this to get back to a clean slate. |

> **Note on `npm run test:e2e`**: these tests run against whichever database `DATABASE_URL` in your `.env` points to, and they create/clean up their own test data as they go. They're safe to run against your local seeded dev database, but don't point `DATABASE_URL` at a database with data you actually care about.

## Environment variables reference

`.env.example` is the source of truth and is commented inline — copy it to `.env` and read through it once. Broadly, it covers: app/CORS config, the database connection string, JWT/auth secrets, rate limiting, seed-data credentials, local file storage, email (Mailtrap), and Razorpay payment keys. A block for Cloudflare R2 (object storage) is present but unused — the app currently stores all uploads (avatars, deck covers, flashcard images) on local disk regardless.

## Troubleshooting

- **"Port 5433 already in use" / Postgres won't start** — something else is already using that port. Either stop it, or change the host-side port in both `docker-compose.yml`'s `ports:` mapping and `DATABASE_URL` in `.env` (they need to match).
- **A frontend can't reach the API / CORS errors** — check `CORS_ORIGIN` in `.env` includes the origin the frontend is actually running on. By default this covers `http://localhost:3000` (main app) and `http://localhost:3001` (admin app).
- **Verification/reset-password emails never arrive** — if `MAILTRAP_USER`/`MAILTRAP_PASS` are blank, this is expected: check the backend's terminal output instead, the full email (including the clickable link) is logged there.
- **Checkout fails at the "Pay" step** — `RAZORPAY_API_KEY`/`RAZORPAY_SECRET_KEY` are missing or invalid. Get free Test Mode keys from your Razorpay dashboard.
- **`/graphql` shows a CSRF error in the browser instead of Apollo Sandbox** — this shouldn't happen (Apollo Sandbox is explicitly enabled), but if it does, make sure you're visiting it directly in a browser tab, not via a tool sending unusual headers.

## Project structure

```
src/
├── app-modules/        # One folder per feature (auth, users, store, library, study, cart, orders, admin, reviews, users, attachments...)
│   └── <feature>/
│       ├── *.module.ts / *.resolver.ts / *.service.ts
│       ├── dto/         # GraphQL input/output types
│       └── entities/    # TypeORM entities this module owns
├── config/              # Typed config loaders (registerAs) — never read process.env outside these
├── database/
│   ├── migrations/
│   └── seeds/seed.ts
├── shared/              # Cross-cutting: guards, decorators, mail service, filters
└── main.ts
```

## Running the full project (all three apps)

This backend is one of three sibling projects meant to run together:

```
some-folder/
├── study-assistant-backend/          (this repo — http://localhost:4000)
├── study-assistant-frontend/         (main app  — http://localhost:3000)
└── study-assistant-admin-frontend/   (admin app — http://localhost:3001)
```

They're three separate git repositories, not a monorepo — clone all three as siblings, exactly as above, since the frontends' default `.env` values assume the backend is at `localhost:4000`, and this backend's default `CORS_ORIGIN` assumes the frontends are at `localhost:3000`/`localhost:3001`.

**Start them in this order** (each needs its own terminal):
1. This backend (steps above) — `npm run start:dev`
2. `study-assistant-frontend` — see its own README
3. `study-assistant-admin-frontend` — see its own README

Once all three are running, log into the admin app (`http://localhost:3001`) with the seeded admin credentials, and either browse the main app (`http://localhost:3000`) using the seeded decks as-is, or register a brand new account there.
