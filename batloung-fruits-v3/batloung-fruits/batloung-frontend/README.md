# Batloung Fruits - Frontend (React)

React (Vite, Tailwind, React Router, Recharts) interface for the Batloung Fruits Distribution Management System (DIWA2110). It needs the backend API running.

## Run

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to http://localhost:5001
```

For a build served from another host, copy `.env.example` to `.env`, set `VITE_API_URL` to the API address (for example `https://api.example.com/api`), then run `npm run build`. The API must list this site in its `CLIENT_ORIGIN`.

## Layout

```
src/api         fetch wrapper (JWT, error details)
src/context     auth and toast providers
src/components  Layout (sidebar, mobile drawer) and shared UI
src/pages       Login, Dashboard, Catalog, Stock, Suppliers, Vendors, Orders, Reports, Architecture
src/utils       formatting and data-fetch hooks
```

Administrators see every page. Sales users see Dashboard, Fruits & Box Sizes, Vendors, Orders and Architecture. The backend enforces the same rules independently.

## Sign-in, policies and cookies

- `src/pages/Login.jsx`: the sign-in page. The Terms checkbox comes first; Google, GitHub, Apple, Facebook and email sign-in all stay blocked until it is ticked. The server enforces the same rule.
- `src/pages/Register.jsx`: Create an account. Choose Sales or Administrator (Administrator asks for the access code and is disabled when the server has none). `src/pages/Users.jsx`: administrators promote, demote or switch off accounts.
- `src/legal/company.js`: company name and contact details, the terms version and the "template wording" notice. **Edit this before real use.**
- `src/legal/documents.js`: the text of the Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, Cookie Policy and Acceptable Use Policy. They are public at `/legal/<terms|privacy|refunds|cookies|acceptable-use>`. This is template wording, so have a lawyer review it.
- `src/utils/consent.jsx` and `src/components/CookieConsent.jsx`: after signing in, people choose Accept all or Reject non-essential (equal weight, and the app works the same either way). Strictly necessary storage is always on. The one optional category is "Preferences", which remembers the email on the sign-in page. "Cookie settings" in the sidebar reopens the choice.
- To ask people to agree again after you change the policies, change `TERMS_VERSION` in `company.js`.
- Set `VITE_SHOW_DEMO=false` in production to hide the demo-account buttons.
