# ProofPay

**Milestone acceptance demo with human-controlled payment decisions.**

ProofPay is an early prototype for agreeing on observable acceptance criteria, reviewing submitted notes, and keeping a person in control of a payment decision.

> **Current status — local demo is available; Gemini Free-tier mode is configured locally and passed one fictional-data smoke test.** The local review remains a deterministic keyword-overlap demonstration, not AI or verification. The optional server-only `gemini-2.5-flash` integration returned a valid advisory response in one test against the operator-verified Free-tier project with no billing account linked. This is a smoke test only, not production validation, and Gemini is not enabled on any hosted deployment. The API key is stored locally in ignored server-only configuration. PayPal Sandbox credentials are stored only in ignored local `.env.local`, and OAuth token authentication has been verified. No Sandbox order has been created or authorized, captured, or voided; the transaction flow remains untested. PayPal Live is not supported.
>
> **AI/data notice:** The optional mode sends only acceptance criteria and evidence notes to Google's Gemini API. Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists Gemini 2.5 Flash input/output as free of charge on Free tier; its [terms](https://ai.google.dev/gemini-api/terms) indicate prompts and responses may be used to improve Google products for Free-tier use. Users must acknowledge this before each AI request and use fake/public demo data only—never personal information or confidential client work.

## Walkthrough

1. Set the milestone name, USD amount, and up to eight acceptance criteria.
2. Start the local simulation. It creates a demo authorization state only; it does not contact PayPal.
3. Enter evidence notes. Choose either the local keyword demo (which compares note/criterion words using a fixed rule) or, once properly configured, the optional Gemini advisory review. Neither route sends or opens the deliverable link. The Gemini route sends only criteria and evidence notes; it does not send the title, amount, or URL.
4. Gemini use requires an explicit acknowledgement of the third-party data notice. Gemini output is advisory, can be inaccurate, does not verify work, and never makes a payment decision. Inspect the actual deliverable yourself.
5. Choose **Capture payment** or **Void authorization** yourself. In simulation mode these buttons only record a local demo result; they do not move money.

The review output and flow state stay in the current browser tab; the server keeps no database record. The local review route remains available without AI configuration. Gemini failures are reported and never silently replaced with the keyword demo or described as AI results.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm ci
test -f .env.local || cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep any existing `.env.local`; the command above copies the blank example only if the file is missing. With the blank example, the app uses local payment simulation and makes no Gemini or PayPal request. With the current operator-only local configuration, Gemini requires the on-screen data acknowledgement, while no PayPal order or payment operation is run merely by starting the app.

## Optional Gemini API Free-tier demo

The integration is configured locally and has passed **one live smoke test** using a fictional public-demo criterion and note; the request returned a valid advisory response. The selected Google AI Studio project was confirmed as Gemini API Free tier with no billing account linked. This single test does not establish production readiness, and the feature has not been deployed. The server uses Google Gemini REST with the single fixed model `gemini-2.5-flash`; it adds no SDK dependency. The API key is stored only in ignored local `.env.local`, read by the server from `GEMINI_API_KEY`, and never sent to the browser or committed. The server also requires `GEMINI_PROJECT_ID` for operator provenance and `GEMINI_FREE_TIER_CONFIRMED=true` as an explicit guard. `/api/config` exposes only a readiness boolean, not the key or project ID.

Preserve the no-billing setup. The guard must remain `true` only while the configured key is for a Gemini API Free-tier project with **no billing/payment account attached**. If that eligibility is no longer confirmed, disable the feature; do not use a paid provider, another model, or a billing-enabled project as a workaround. Free-tier availability is subject to Google's quotas; exhausting quota can make requests fail. The one successful fictional-data test was the only live API request made during setup.

The UI displays a third-party warning and requires a checkbox acknowledgement before every AI send. The endpoint also enforces that acknowledgement, validates bounded criteria/notes, applies a timeout, and rejects malformed model output. It uses no tools, grounding, or URL browsing and does not log the key or expose raw upstream errors. Only criteria and evidence notes are included in the model request. Gemini results have no keyword-match percentage. A returned AI assessment is an advisory demo only, not verified evidence or a payment decision.

## PayPal Sandbox code path

The repository contains a Sandbox-only PayPal integration path, hard-wired to `https://api-m.sandbox.paypal.com`. The existing Sandbox app credentials are configured locally, and OAuth authentication has been verified, but no order has been created and no buyer approval, authorization, capture, or void has been tested. Do not claim that ProofPay has completed a Sandbox transaction. Do not use Live credentials or create another Sandbox account as part of this demo.

The prototype uses Orders v2 `AUTHORIZE` followed by Payments v2 capture or void, with separate buyer approval and an explicit client-side decision. Creating a Sandbox order, authorizing it, or capturing/voiding it is still a test transaction and requires the project owner's explicit approval of the exact test details first. Authorization is not escrow, a guarantee of payment, or a dispute-resolution service. Official references: [Orders v2](https://developer.paypal.com/api/orders/v2), [Create order](https://developer.paypal.com/api/orders/v2/orders-create), [Payments v2](https://developer.paypal.com/api/payments/v2), [Capture authorized payment](https://developer.paypal.com/docs/api/payments/v2/#authorizations_capture), [Void authorized payment](https://developer.paypal.com/docs/api/payments/v2/#authorizations_void).

## Deployment

A Render free-tier Blueprint is included in `render.yaml`, but no service has been deployed or configured. The current local demo does not require external credentials. Deploying a public service is a separate step and must remain on the free tier; keep the Gemini API key in server-only environment configuration.

## Safety and scope

- The deterministic local keyword matcher is a walkthrough aid only; it does not understand meaning, inspect deliverables, or verify evidence.
- The optional Gemini route is unconfigured/unverified by default. Use only after confirming the no-billing Free-tier prerequisite. Gemini's third-party processing notice must be acknowledged; prompts/responses may be used to improve Google products.
- Send fake/public demo information only. Do not enter personal or confidential client data.
- The deliverable URL is displayed in the browser but is neither sent to a review endpoint nor opened. Title and amount are not sent to Gemini.
- The checked-in PayPal integration targets Sandbox only; OAuth is verified, but a Sandbox order/transaction has not been tested. Do not use Live.
- The client explicitly chooses a demo capture or void action; the code does not automatically move money.
- Partial capture, seller payouts, dispute arbitration, webhooks, authentication, persistence, and production use are out of scope.

## Development checks

```bash
npm run test:ai # mock fetch only; no external AI request
npm run typecheck
npm run build
npm audit
```

## License

ProofPay is released under the [MIT License](LICENSE).
