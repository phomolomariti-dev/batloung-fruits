# Batloung Fruits - Backend (Node.js + Express + MySQL)

REST API and database for the Batloung Fruits Distribution Management System (DIWA2110).

## Run

Requirements: Node 18+, MySQL 8 (or MariaDB 10.5+).

```bash
cp .env.example .env     # set DB_PASSWORD and a long random JWT_SECRET
npm install
npm run db:setup         # creates DB_NAME, loads sample data and the two demo users
npm start                # http://localhost:5001/api
```

### Connect with MySQL Workbench

The API connects to a MySQL server; MySQL Workbench is a client for that same server, not a separate database service. In Workbench, create or open a connection using the same host, port, and user configured in `batloung-backend/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`). The application uses the `DB_NAME` schema (default `batloung_fruits`).

For a local Workbench connection, the defaults are host `localhost`, port `3306`, and schema `batloung_fruits`. Set the actual MySQL password in `.env`, then run `npm run db:setup` to create and seed the schema named by `DB_NAME`. **Setup resets tables inside that schema**, so if `batloung_fruits` already contains unrelated data, set `DB_NAME=batloung_fruits_app` first to keep the existing schema untouched. The API and Workbench should use the same schema. The app's sidebar reports whether the API can currently reach MySQL; `GET /api/health/database` checks the live connection.

Existing databases can add precise vendor map coordinates without resetting data by running `npm run db:migrate-vendor-coordinates`. New vendor registrations and edits require selecting a point on the map; historical vendors keep blank coordinates until edited.

Demo logins: `admin@batloung.co.ls / Admin@123` (Administrator), `sales@batloung.co.ls / Sales@123` (Sales).

If those say "Incorrect email or password", the users are missing from your database. Run `npm run db:demo-users` (keeps your data) or `npm run db:setup` (resets everything). Importing `database/schema.sql` then `database/seed.sql` by hand also creates them.

### Account creation settings (`.env`)

| Variable | Meaning |
|---|---|
| `ALLOW_SIGNUP` | `true` (default) lets people create accounts; `false` turns self-service sign-up off, including social sign-up |
| `ADMIN_SIGNUP_CODE` | Code needed to create an **Administrator** account. Empty = Administrator sign-up off. Change the example value; it is ignored when `NODE_ENV=production` |

Endpoints: `GET /api/auth/signup-options`, `POST /api/auth/register` (full_name, email, password, role `sales|administrator`, `admin_code`, `accept_terms`), and for administrators `GET /api/users` and `PUT /api/users/:id` (`role`, `is_active`). The role is read from the database on every request, so promotions, demotions and deactivations take effect immediately.

## Tests

Run `npm run db:setup` first, and restart the API between runs of the smoke test (it clears the login rate limit).

| Command | What it checks |
|---|---|
| `npm test` (API running) | 63 checks: stock and order rules, roles, validation, vendor coordinates, status codes, the Terms requirement at sign-in |
| `npm run test:signup` (API not needed) | 46 checks of account creation: Sales and Administrator sign-up, the access code, validation, mass-assignment, ALLOW_SIGNUP, and the Users endpoints (promote, demote, deactivate take effect at once) |
| `npm run test:oauth` (API not needed) | 39 checks of social sign-in for Google, GitHub, Apple and Facebook against a fake provider: terms gate, state/CSRF protection, unverified emails, account linking, creating Sales accounts (when sign-up is on), disabled accounts |

## Layout

```
src/config        database pool and transaction helper
src/middleware    JWT auth, role checks, error handler
src/routes        route table with the role required per endpoint
src/controllers   fruits, products, suppliers, stock, vendors, orders, reports, auth
src/utils         validation and error helpers
database/         schema.sql, seed.sql
docs/             API.md, ERD.md, erd.svg
scripts/          setup-db.js, smoke-test.js
```

Set `CLIENT_ORIGIN` in `.env` to the frontend's URL (comma-separated for several) so CORS allows it.
See `docs/API.md` for the endpoints and `docs/ERD.md` for the database model.

## Social sign-in (Google, GitHub, Apple, Facebook)

Every provider is optional. A provider's button works only when its keys are in `.env`; with none set, email and password still work.

- Terms: the API refuses to start a social sign-in unless the Terms were accepted, and records the version and time on the user.
- Accounts: a social sign-in is matched to an existing user by **verified** email. A new person gets a **Sales** account on first sign-in unless `ALLOW_SIGNUP=false` (then an administrator must add them first). Social sign-in never creates an administrator.
- Register this callback URL with each provider: `{API_PUBLIC_URL}/api/auth/oauth/<google|github|facebook|apple>/callback`.

| Provider | Where to get keys | Env vars |
|---|---|---|
| Google | Google Cloud Console, APIs & Services, Credentials, OAuth client ID (Web application) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | GitHub Settings, Developer settings, OAuth Apps | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Facebook | Meta for Developers, create an app, add Facebook Login | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| Apple | Apple Developer, a Services ID plus a Sign in with Apple key. **Apple only accepts https callback URLs**, so local testing needs a tunnel or a deployed API | `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |

### Try the buttons without real keys

```bash
npm run oauth:mock        # terminal 1: a fake provider on :5056 (testing only)
```
Then start the API in terminal 2 with the variables that command prints, and click any social button. The fake provider shows a page where you pick who is signing in. Never use it in production.
