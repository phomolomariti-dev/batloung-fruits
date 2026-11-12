# Batloung Fruits Distribution Management System (DIWA2110)

Two projects that work together:

- `batloung-backend/`: Node.js, Express and MySQL REST API, with social sign-in. See its README.
- `batloung-frontend/`: React app. See its README.

## Quick start

```bash
# terminal 1: backend
cd batloung-backend
cp .env.example .env        # set DB_PASSWORD and a long random JWT_SECRET
npm install
npm run db:setup
npm start                   # http://localhost:5001

# terminal 2: frontend
cd batloung-frontend
npm install
npm run dev                 # http://localhost:5173
```

Demo logins (also on the sign-in page): `admin@batloung.co.ls / Admin@123` and `sales@batloung.co.ls / Sales@123`. Tick the Terms box on the sign-in page before signing in.

**"Incorrect email or password" for the demo logins?** The demo users live in the database, so the database has to be set up first. Run `npm run db:setup` in `batloung-backend` (or, to keep your data, `npm run db:demo-users`), and make sure `DB_*` in `.env` point at the database you set up. You can also just click **Create an account** on the sign-in page.

## Creating accounts (Administrator or Sales)

Anyone can open **Create an account** from the sign-in page and choose **Sales** or **Administrator**.

- **Sales** accounts can be created freely.
- **Administrator** accounts need the access code from `ADMIN_SIGNUP_CODE` in the backend `.env`. Without it, anyone could make themselves an administrator. The example code `batloung-admin-2026` **must be changed**; it is refused when `NODE_ENV=production`. Leave the code empty to switch Administrator sign-up off.
- `ALLOW_SIGNUP=false` switches self-service sign-up off completely (including social sign-up).
- Signing up with Google, GitHub, Apple or Facebook creates a **Sales** account only.
- Administrators manage everyone on the **Users & Access** page: promote, demote, or switch an account off. Changes apply on the person's very next click.

## What changed in this version

- Create an account as Administrator or Sales, plus a Users & Access page.

- New sign-in page with Continue with Google, GitHub, Apple and Facebook (each works once its keys are set; email sign-in always works).
- The Terms & Conditions, Privacy and Refund policies must be agreed to before any sign-in, on the page and on the server.
- Public pages for the Terms, Privacy, Refund & Cancellation, Cookie and Acceptable Use policies.
- After signing in, people accept or reject non-essential cookies, and can change their mind from the menu.
- Tests in the backend: `npm test`, `npm run test:oauth`, `npm run test:signup`.

The policy text is template wording: replace the contact details in `batloung-frontend/src/legal/company.js` and have it reviewed before real use.
