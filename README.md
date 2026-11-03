# ProofPay

**Milestone acceptance demo with human-controlled payment decisions.**

ProofPay is an early prototype for agreeing on observable acceptance criteria, reviewing submitted notes, and keeping a person in control of a payment decision.

> **Current status — local demo only:** No AI API is configured or called. The review is a deterministic keyword-overlap demonstration, not an AI assessment, quality review, or verification. PayPal credentials are not configured, so the verified walkthrough is a local simulation with no PayPal request and no money movement. The PayPal Sandbox code path exists in the repository but has not been connected or verified with Sandbox credentials. PayPal Live is not supported.
>
> **Hackathon eligibility:** In its current state, this project does **not** meet the requirement for meaningful AI integration. Do not describe the local keyword demo as AI.

## Walkthrough

1. Set the milestone name, USD amount, and up to eight acceptance criteria.
2. Start the local simulation. It creates a demo authorization state only; it does not contact PayPal.
3. Enter evidence notes. The local demo compares words in the notes with each criterion using a fixed rule. The optional link is not sent to the review endpoint and is not opened.
4. Inspect the demo output and choose **Capture payment** or **Void authorization**. In simulation mode these buttons only record a local demo result; they do not move money.

The review output and flow state stay in the current browser tab. The server keeps no database record. The local review route uses no model, API key, or external review service.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You do not need PayPal or AI credentials for the local walkthrough. No AI API call is made. With the empty example environment, the application stays in local simulation mode and does not contact PayPal.

## PayPal Sandbox code path

The repository contains a Sandbox-only PayPal integration path, hard-wired to `https://api-m.sandbox.paypal.com`. It has **not** been end-to-end tested because no PayPal Sandbox credentials were provided. Do not claim that ProofPay currently completes a real Sandbox transaction. Do not use Live credentials or create a PayPal account as part of this local demo.

If the owner later explicitly chooses to enable a Sandbox test, the environment variable names are shown in `.env.example`. The prototype uses Orders v2 `AUTHORIZE` followed by Payments v2 capture or void, with a separate human confirmation. Authorization is not escrow, a guarantee of payment, or a dispute-resolution service. Official references: [Orders v2](https://developer.paypal.com/api/orders/v2), [Create order](https://developer.paypal.com/api/orders/v2/orders-create), [Payments v2](https://developer.paypal.com/api/payments/v2), [Capture authorized payment](https://developer.paypal.com/api/payments/v2/authorizations-capture), [Void authorized payment](https://developer.paypal.com/api/payments/v2/authorizations-void).

## Deployment

A Render free-tier Blueprint is included in `render.yaml`, but no service has been deployed or configured. The current demo does not require external credentials. Deploying a public service is a separate step and must remain on the free tier.

## Safety and scope

- No AI API is called or configured in this version.
- The keyword matcher is a visual walkthrough aid only; it does not understand meaning, inspect deliverables, or verify evidence.
- The optional deliverable URL is displayed in the browser but is neither sent to the demo review route nor opened.
- The checked-in PayPal integration targets Sandbox only; current verified behavior is local simulation, not a real PayPal transaction.
- The client explicitly chooses a demo capture or void action; the code does not automatically move money.
- Partial capture, seller payouts, dispute arbitration, webhooks, authentication, persistence, and production use are out of scope.
- Do not enter confidential or personal client data in this prototype.

## Development checks

```bash
npm run typecheck
npm run build
npm audit
```

## License

ProofPay is released under the [MIT License](LICENSE).
