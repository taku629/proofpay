# ProofPay

**A milestone-acceptance demo with human-controlled payment decisions.** ProofPay lets people define observable acceptance criteria, review evidence notes, and keep a person in control of the final decision.

## Demo status

Try the [hosted demo](https://proofpay-4o52.onrender.com). It runs on Render Free, so it may take a short while to wake after inactivity. The hosted version is **simulation-only**: it uses a deterministic keyword-overlap checker and has no PayPal or Gemini credentials; it contacts neither service. The local keyword check is not AI and does not verify evidence.

The code also includes an optional Gemini 2.5 Flash advisory-review path. It is configured only in the operator's local environment and passed one smoke test using fictional data on a no-billing Free-tier project. Gemini is not enabled on the hosted demo.

The PayPal integration is hard-wired to Sandbox. One fictional **$1 USD** Sandbox order was authorized and captured successfully; a void has not been tested. No further test transactions are authorized. Do not create or run another transaction as part of setup or routine testing. PayPal Live is unsupported.

## Walkthrough

1. Define a milestone amount and up to eight acceptance criteria.
2. Start the local simulation, or use the hosted simulation. Simulation actions record demo state only; they do not contact PayPal or move money.
3. Add evidence notes and run either the deterministic local keyword check or, where configured, the optional Gemini review. Neither review opens the deliverable URL. Only criteria and notes are sent to Gemini—not the title, amount, or URL.
4. Inspect the work yourself, then choose what to do. A review is not verification or a payment decision.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm ci
# Copy the blank template only if you don't already have a local config.
test -f .env.local || cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep any existing `.env.local`; never overwrite it or commit it. A blank template starts in local payment simulation and has no Gemini API configuration. PayPal Sandbox mode is enabled only when matching Sandbox client IDs and a Sandbox secret are configured. The operator's ignored local config already contains Sandbox and Gemini settings; do not initiate a Sandbox transaction.

## Optional Gemini review

The server-only Gemini integration requires `GEMINI_API_KEY`, `GEMINI_PROJECT_ID`, and `GEMINI_FREE_TIER_CONFIRMED=true` in a project independently confirmed eligible for the no-billing Free tier. Keep the key server-side; the configured model is `gemini-2.5-flash`. Free-tier availability and quotas can change.

**Runtime AI disclosure:** Before each Gemini request, the app requires an acknowledgement that only acceptance criteria and evidence notes will be sent to Google. Prompts and responses may be used to improve Google products. Use fictional or public demo data only—never personal or confidential information. Gemini output is advisory, may be wrong, does not inspect links or verify work, and never decides payment. The local keyword mode is deterministic, not AI. Gemini errors are not silently replaced by a local result.

## Scope and limitations

ProofPay is a prototype, not escrow, evidence verification, or production-ready payment infrastructure. It has no database or durable persistence, user authentication, webhooks, payouts, or dispute handling. A PayPal authorization is not a guarantee of payment. The client must make any payment decision; simulation choices never move money.

**Development disclosure:** Cue assisted with development, review, testing, and documentation. Any synthetic narration in a submission video will be labeled AI-generated and is not the owner's voice.

## Development checks

```bash
npm run test:ai  # Mock fetch only; no external AI request
npm run typecheck
npm run build
npm audit
```

## License

ProofPay is released under the [MIT License](LICENSE).
