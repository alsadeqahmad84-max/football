# Umniah Voice Invoice Desk

A browser-based prototype for managing VOIP customers and revenue invoices. It includes a revenue dashboard, customer directory, invoice drafting and issuing, payment status tracking, and automatic tax-inclusive PDF downloads when an invoice is issued. Issued PDFs can also be downloaded again from invoice details.

## Start the app

Requirements: Node.js and pnpm.

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Create an optimized production build with:

```powershell
pnpm build
```

Preview a production build locally with:

```powershell
pnpm preview
```

## Data and privacy

This prototype stores its workspace in this browser's local storage. The first run seeds sample customers and invoices; later visits load the saved workspace. Data is local to the browser profile and does not sync to a server or another device. Clearing browser storage removes that local workspace. Do not enter confidential customer information into a shared device.

## Prototype boundary

Invoices are entered manually. The prototype does not connect to a PBX/CDR platform, CRM, accounting system, or payment gateway. It does not provide sign-in, authorization, email delivery, backups, audit logs, or jurisdiction-specific tax and statutory invoice validation. Review legal, tax, finance, and security requirements before using generated PDFs as official invoices.

## Project skills

Project-specific agent skills are stored under `.agents/skills/`. The UI design system generated from the installed UI/UX Pro Max skill is documented in `design-system/umniah-voice-revenue/MASTER.md`.

- [CloakBrowser-RES-AI](https://github.com/ramishaheen/CloakBrowser-RES-AI.git) — external skill repository reference.

## Premier League Hub

Open `http://localhost:5173/football` while the Vite development server is running. The dashboard is a separate experience; the invoice desk remains at `/`. It includes 2026/27 fixtures, selected recent results, club search and filters, favorites, and illustrative match probabilities. Fixture and score examples are sourced and linked in the dashboard. Win probabilities use sample club ratings and a simple home-advantage calculation; they are not live model output or betting odds.

### Other league match centres

Clicking the LaLiga, Serie A, Bundesliga, or Ligue 1 logo switches the dashboard to that league’s fixtures, standings, scores, goal reports, and match lineups. These feeds use API-Football through a server-side Vite proxy. Add `API_FOOTBALL_KEY=your_key` to the ignored `.env.local` file and restart the dev server. The key stays on the server and is never sent to browser code. Without it, the selected league shows a setup message instead of fabricated match data. The provider’s free plan currently includes 100 requests per day; the proxy caches fixture, table, and match report responses to limit usage.
# Tavily web research

The Web research area searches public web sources through Tavily. The API key is read by the local Vite server from `.env.local` and is never included in browser code. Keep `.env.local` private and do not share it. Restart the development server after changing the key.

This Vite middleware supports local development and `vite preview`. A production deployment on a static host needs an equivalent server-side `/api/tavily/search` endpoint with the key configured as a server secret; do not put the key in frontend environment variables.

## Ask PL assistant

The football dashboard assistant handles dashboard navigation and questions about its loaded FPL data locally. Other questions are sent to NVIDIA NIM using `moonshotai/kimi-k3` and streamed back into the chat. The API key is read only by the local Vite server from the ignored `.env.local` file; add `NVIDIA_API_KEY=...` there and restart `pnpm dev`. Never put the key in React code or `VITE_*` environment variables.

The `/api/assistant/chat` middleware is included in local development and `vite preview`. A production deployment needs an equivalent server-side endpoint with `NVIDIA_API_KEY` configured as a server secret.

## AgentMail system reports

Set `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, and `AGENTMAIL_REPORT_TO` in ignored `.env.local`. Optionally set `AGENTMAIL_REPORT_TIME` (`HH:mm`, default `09:00`) and `AGENTMAIL_REPORT_TIMEZONE` (default `Asia/Amman`). Restart `pnpm dev` after configuration. The server sends one daily report at that local time while the Vite dev or preview server is running, and `POST /api/reports/test` sends a one-time test report. A production deployment needs an equivalent persistent scheduled server job; the Vite scheduler is only for local development and preview.

Reports summarize whether the app server and public FPL feed respond, whether Kimi is configured, and explain that activity history and cloud metrics are browser-local or simulated. They do not include private browser activity or invented infrastructure measurements.

