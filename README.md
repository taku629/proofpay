# ProofPay

**AI-assisted milestone acceptance with PayPal Sandbox payments.**

ProofPay explores a fairer way to handle freelance milestone work: agree on acceptance criteria before work begins, review submitted evidence against those criteria, and make a transparent, human-approved payment decision.

> **Prototype status:** This repository currently contains the project brief and MIT license. The application, AI evaluation, and PayPal Sandbox integration are planned—not implemented yet.

## The problem

Freelancers and clients can disagree about whether a deliverable meets the agreed scope. Clients worry about paying for incomplete work; freelancers worry about delivering work and not getting paid. A vague “looks good” is not enough to make that decision fair.

## Proposed flow

1. The client creates a milestone with a price and explicit, testable acceptance criteria.
2. The client approves a PayPal Sandbox order with an authorization intent before work begins.
3. The freelancer submits a deliverable link or file, with notes about the evidence for each criterion.
4. An AI reviewer assesses each criterion and returns a recommendation with evidence, uncertainty, and a concise rationale.
5. The client reviews the recommendation and chooses whether to capture, partially capture and void the remainder, or void the authorization. The AI does not move money by itself.
6. PayPal webhooks record payment state changes. A later iteration may add eligible seller payouts through PayPal Payouts.

## Why AI and PayPal?

AI makes a rubric-based review easier to understand by mapping each criterion to submitted evidence and calling out gaps instead of returning an unexplained score. PayPal Sandbox makes the consequences of a decision tangible: the prototype can demonstrate an authorization and the resulting capture or void without using real funds.

## Important boundaries

- A PayPal authorization is **not escrow**, a guarantee of payment, or a substitute for a contract or dispute-resolution process.
- AI output is advisory. A person reviews the evidence and explicitly confirms any payment action.
- The project is for a hackathon prototype and Sandbox testing, not production financial, legal, or payment advice.
- Do not commit PayPal credentials, API keys, or private client deliverables to the repository.

## Planned technical direction

- **Web app:** Next.js with an English-language interface
- **Payments:** PayPal Orders v2 in Sandbox; evaluate Payouts for a later seller-payment step
- **Payment events:** PayPal Webhooks
- **AI review:** an LLM produces criterion-by-criterion recommendations grounded in submitted evidence
- **Deployment target:** a free-tier web host for the demo

The implementation may change as the prototype is validated. Any supported provider and setup steps will be documented here as they are added.

## Development status

- [x] Public repository and MIT license
- [ ] Milestone creation and acceptance criteria UI
- [ ] PayPal Sandbox order authorization
- [ ] Evidence submission and AI review with per-criterion rationale
- [ ] Human-confirmed capture, partial capture, or void
- [ ] Webhook event handling and status history
- [ ] Deployed demo and short walkthrough video

## License

ProofPay is released under the [MIT License](LICENSE).
