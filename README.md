# ProofPay

**AI-assisted milestone acceptance with human-controlled PayPal Sandbox payments.**

ProofPay helps a client and freelancer agree on observable acceptance criteria, review submitted evidence one criterion at a time, and make a clear payment decision. AI can recommend; only the client can choose the final action.

> **Sandbox prototype:** This is a hackathon demo, not escrow and not a production payment service. PayPal Live is not supported. Without credentials, the app runs an explicitly labelled local simulation that does not call PayPal or move money. The offline review preview is not AI; configure an AI provider to run a real model review.

## Walkthrough

1. Set the milestone name, USD amount, and up to eight acceptance criteria.
2. Approve a PayPal **Sandbox** order with `AUTHORIZE` intent, or use the clearly labelled local simulation.
3. Enter a deliverable link and evidence notes. ProofPay does not open the link.
4. Ask the configured AI model to map the submitted notes to each criterion, with evidence, rationale, and confidence. If no model is configured, the app labels its keyword-based local preview as **not AI**.
5. Inspect the work and choose **Capture payment** or **Void authorization**. The AI cannot call either action by itself.

The milestone and review state stays in the current browser tab. The server keeps no database record; it issues a signed, 24-hour flow token that binds the order, amount, and later authorization ID to ProofPay's own payment actions.

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no credentials, you can complete the local simulation from start to finish. It does not contact PayPal or an AI model.

## Connect PayPal Sandbox

Create a **Sandbox app** in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox). Put its Sandbox client ID in both `PAYPAL_CLIENT_ID` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, and its Sandbox secret in `PAYPAL_CLIENT_SECRET`. The server is hard-wired to `https://api-m.sandbox.paypal.com`; there is no Live API endpoint in this prototype.

```dotenv
PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your-sandbox-client-id
# Optional: use a long, random server-side signing key instead of the Sandbox secret.
PROOFPAY_SIGNING_SECRET=
```

The buyer approves with PayPal's JavaScript SDK. The server then calls Orders v2 to authorize, and Payments v2 to capture or void the authorization after a separate human action. Authorize, capture, and void requests use stable idempotency keys to make safe retries possible. Use test accounts and test funds only. PayPal authorizations are not escrow; PayPal says they are best captured within three days, with a maximum authorization period of 29 days in the documented Orders flow.

Official references: [Orders v2](https://developer.paypal.com/api/orders/v2), [Create order](https://developer.paypal.com/api/orders/v2/orders-create), [Payments v2](https://developer.paypal.com/api/payments/v2), [Capture authorized payment](https://developer.paypal.com/api/payments/v2/authorizations-capture), [Void authorized payment](https://developer.paypal.com/api/payments/v2/authorizations-void).

## Connect an AI provider

Set server-only credentials for an already-owned, eligible free-tier OpenAI-compatible provider. For example, an AMD or Nebius key can be used if it exposes the OpenAI Chat Completions API. Provider base URL and model names vary, so use the exact values from the provider dashboard.

```dotenv
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=your-free-tier-key
AI_MODEL=your-provider-model
```

Never expose `AI_API_KEY` in a `NEXT_PUBLIC_` variable or commit credentials. The reviewer receives only the criterion text, deliverable URL, and evidence notes. It does not fetch the URL; the prompt directs the model to treat user-provided text as untrusted evidence, not instructions, and to mark missing evidence as unclear. AI can still be wrong, so a person must inspect the work. Do not send sensitive client material to an external model without permission.

If no complete AI configuration is present, the app uses a transparent local keyword-match preview. That preview is only for exercising the UI and must not be represented as AI evaluation.

## Deploy on Render's free tier

This repo includes a Render Blueprint at `render.yaml`. Create a free web service from the public GitHub repository, add the Sandbox and AI values as environment variables, and deploy. `NEXT_PUBLIC_PAYPAL_CLIENT_ID` must be present at build time and must match the server-side Sandbox client ID. Keep every PayPal credential Sandbox-only. The free instance may sleep while idle; a cold start can delay the demo.

## Safety boundaries and current scope

- The PayPal API base is Sandbox-only. Do not substitute Live credentials.
- Only orders created by ProofPay can be authorized; a signed short-lived token binds later Capture/Void calls to that specific Sandbox flow.
- An authorization is **not escrow**, a guarantee of payment, or a dispute-resolution process.
- The AI review is advisory. The client explicitly confirms any capture or void.
- Partial capture, seller payouts, dispute arbitration, webhooks, authentication, persistence, and production use are out of scope for this first demo.
- Evidence is currently submitted as text and an optional link; ProofPay does not download or verify files behind the link.
- Do not use confidential or personal client data in this prototype.

## Development checks

```bash
npm run typecheck
npm run build
npm audit
```

## License

ProofPay is released under the [MIT License](LICENSE).
