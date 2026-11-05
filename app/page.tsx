"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Config = {
  paypalReady: boolean;
  paypalMisconfigured: boolean;
  paypalClientId: string | null;
  geminiDemoReady: boolean;
};
type Criterion = { id: string; text: string };
type ReviewResult = {
  id: string;
  status: "met" | "partial" | "not_met" | "unclear";
  evidence: string;
  rationale: string;
  matchRatio?: number;
};
type Review = {
  summary: string;
  results: ReviewResult[];
  mode: "demo_fixture" | "gemini_advisory";
  model?: string;
  caution: string;
};
type PayPalButtonsOptions = {
  style?: Record<string, string | number>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
};
declare global {
  interface Window {
    paypal?: { Buttons: (options: PayPalButtonsOptions) => { render: (target: HTMLElement) => Promise<void> } };
  }
}

type Phase = "draft" | "authorized" | "reviewed" | "settled";
type PaymentMode = "sandbox" | "simulation";

const initialCriteria = [
  "Hero section uses the approved copy and brand colors",
  "Layout works on desktop and mobile",
  "Contact form displays a clear success message",
].join("\n");
const initialEvidence = "Implemented in the landing page PR. The hero uses the approved copy, navy #14233b, and coral #f27862. I tested the responsive layout at 390px and 1440px. The contact form shows “Thanks, we’ll be in touch.” after submit.";

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status}).`);
  return body as T;
}

function money(value: string | number) {
  const number = Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(number) ? number : 0);
}

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M8 16.4 13.2 22 24 10.5" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  );
}

function StepIcon({ number, active, done }: { number: string; active: boolean; done: boolean }) {
  return <span className={`step-icon${active ? " is-active" : ""}${done ? " is-done" : ""}`}>{done ? "✓" : number}</span>;
}

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [title, setTitle] = useState("Landing page implementation");
  const [amount, setAmount] = useState("750");
  const [criteriaText, setCriteriaText] = useState(initialCriteria);
  const [deliverableUrl, setDeliverableUrl] = useState("https://github.com/acme/landing-page/pull/42");
  const [evidenceNotes, setEvidenceNotes] = useState(initialEvidence);
  const [phase, setPhase] = useState<Phase>("draft");
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [flowToken, setFlowToken] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [reviewMode, setReviewMode] = useState<"local" | "gemini">("local");
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [error, setError] = useState("");
  const paypalContainer = useRef<HTMLDivElement | null>(null);
  const activeFlowToken = useRef("");

  const criteria = useMemo<Criterion[]>(() => criteriaText
    .split("\n")
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((text, index) => ({ id: `criterion-${index + 1}`, text })), [criteriaText]);

  useEffect(() => {
    let active = true;
    fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: Config) => { if (active) setConfig(value); })
      .catch(() => { if (active) setError("Could not read the demo configuration."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!config?.paypalReady || !config.paypalClientId) return;
    if (window.paypal) {
      setSdkLoaded(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-proofpay-paypal]");
    if (existing) {
      existing.addEventListener("load", () => setSdkLoaded(Boolean(window.paypal)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.proofpayPaypal = "true";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.paypalClientId)}&currency=USD&intent=authorize&components=buttons`;
    script.async = true;
    script.onload = () => setSdkLoaded(Boolean(window.paypal));
    script.onerror = () => setSdkError(true);
    document.head.appendChild(script);
  }, [config]);

  const completeAuthorization = useCallback(async (orderId: string, mode: PaymentMode, token: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ authorizationId: string; status: string; flowToken: string }>("/api/paypal/authorize", { orderId, flowToken: token });
      activeFlowToken.current = result.flowToken;
      setFlowToken(result.flowToken);
      setPaymentStatus(result.status || "AUTHORIZED");
      setPaymentMode(mode);
      setPhase("authorized");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Authorization could not be completed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!config?.paypalReady || !sdkLoaded || !window.paypal || !paypalContainer.current || phase !== "draft" || busy) return;
    const container = paypalContainer.current;
    container.replaceChildren();
    let active = true;
    window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 44 },
      createOrder: async () => {
        setError("");
        const order = await postJson<{ id: string; flowToken: string }>("/api/paypal/order", { title, amount });
        activeFlowToken.current = order.flowToken;
        setFlowToken(order.flowToken);
        return order.id;
      },
      onApprove: async (data) => { if (active) await completeAuthorization(data.orderID, "sandbox", activeFlowToken.current); },
      onCancel: () => setError("PayPal checkout was cancelled. No authorization was created."),
      onError: (issue) => {
        const message = issue instanceof Error ? issue.message : "PayPal checkout could not be loaded.";
        setError(message);
        setBusy(false);
      },
    }).render(container).catch(() => {
      if (active) setError("The PayPal Sandbox button could not be rendered. Check the Sandbox client ID and try again.");
    });
    return () => { active = false; container.replaceChildren(); };
  }, [config, sdkLoaded, phase, busy, title, amount, completeAuthorization]);

  async function startSimulation() {
    setBusy(true);
    setError("");
    try {
      const order = await postJson<{ id: string; flowToken: string }>("/api/paypal/order", { title, amount });
      activeFlowToken.current = order.flowToken;
      setFlowToken(order.flowToken);
      await completeAuthorization(order.id, "simulation", order.flowToken);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The local walkthrough could not start.");
      setBusy(false);
    }
  }

  async function runReview() {
    if (reviewMode === "gemini" && !aiConsent) {
      setError("Please acknowledge the Gemini data notice before sending a review.");
      return;
    }
    setBusy(true);
    setError("");
    if (reviewMode === "gemini") setAiConsent(false);
    try {
      const result = reviewMode === "gemini"
        ? await postJson<Review>("/api/ai/review", { criteria, notes: evidenceNotes, consent: aiConsent })
        : await postJson<Review>("/api/demo/review", { criteria, notes: evidenceNotes });
      setReview(result);
      setPhase("reviewed");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The review could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function settle(decision: "capture" | "void") {
    const action = decision === "capture" ? `capture ${money(amount)}` : "void this authorization";
    const context = paymentMode === "simulation"
      ? "This only updates the local simulation; no PayPal request or money transfer will happen."
      : "This will send a test action to PayPal Sandbox. You must confirm it yourself.";
    if (!window.confirm(`Confirm that you want to ${action}? ${context}`)) return;
    setDecisionBusy(true);
    setError("");
    try {
      const result = await postJson<{ status: string; flowToken: string }>("/api/paypal/settle", { flowToken, decision });
      setFlowToken(result.flowToken);
      activeFlowToken.current = result.flowToken;
      setPaymentStatus(result.status);
      setPhase("settled");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The payment decision could not be completed.");
    } finally {
      setDecisionBusy(false);
    }
  }

  function startOver() {
    setPhase("draft");
    setPaymentMode(null);
    setFlowToken("");
    activeFlowToken.current = "";
    setPaymentStatus("");
    setReview(null);
    setReviewMode("local");
    setAiConsent(false);
    setError("");
  }

  const hasInvalidAmount = !Number.isFinite(Number(amount)) || Number(amount) < 1 || Number(amount) > 10000;
  const invalidCriteria = criteria.length === 0 || criteriaText.split("\n").filter((line) => line.trim()).length > 8 || criteria.some((item) => item.text.length > 240);
  const locked = phase !== "draft";
  const progress = phase === "draft" ? 1 : phase === "authorized" ? 2 : phase === "reviewed" ? 3 : 4;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ProofPay home"><Mark /><span>proof<span className="brand-light">pay</span></span></a>
        <div className="topbar-right">
          <span className="topbar-note">A little more clarity. A lot more trust.</span>
          <span className="sandbox-pill"><span className="live-dot" /> NO LIVE PAYMENTS</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> MILESTONE PAYMENTS, MADE CLEARER</div>
          <h1>Proof, before<br /><em>payment.</em></h1>
          <p>Agree on what “done” means. Review the evidence together. You stay in control of the final payment.</p>
          <div className="hero-proof"><span className="proof-check">✓</span> Demo only. A person decides.</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-sheet"><div className="sheet-label">MILESTONE REVIEW</div><div className="sheet-line wide" /><div className="sheet-line medium" /><div className="sheet-rule" />
            <div className="sheet-check"><span>✓</span><i /></div><div className="sheet-check"><span>✓</span><i /></div><div className="sheet-check pending"><span>·</span><i /></div>
            <div className="sheet-footer"><span>REVIEW READY</span><strong>{money(amount)}</strong></div>
          </div>
          <div className="orbit-label"><span className="mini-check">✓</span> HUMAN APPROVED</div>
          <div className="hero-spark spark-a">✳</div><div className="hero-spark spark-b">✳</div>
        </div>
        <div className="hero-index"><span>01</span><i />  A FAIRER WAY TO WORK TOGETHER</div>
      </section>

      <section className="workspace" aria-label="ProofPay demo workspace">
        <div className="workspace-heading">
          <div><span className="section-kicker">LOCAL WALKTHROUGH</span><h2>Your milestone, step by step</h2></div>
          <span className={`connection-pill ${config?.paypalReady ? "is-connected" : ""}`}><span className="connection-dot" />{config?.paypalReady ? "PayPal Sandbox connected" : "Interactive demo"}</span>
        </div>

        <nav className="progress-track" aria-label="Milestone progress">
          {[
            ["01", "Set the terms"], ["02", "Authorize"], ["03", "Review evidence"], ["04", "Decide"],
          ].map(([num, label], index) => {
            const step = index + 1;
            return <div className={`progress-step ${progress === step ? "current" : ""} ${progress > step ? "complete" : ""}`} key={num}>
              <StepIcon number={num} active={progress === step} done={progress > step} /><span>{label}</span>
            </div>;
          })}
        </nav>

        <div className="workspace-grid">
          <div className="main-column">
            <section className={`panel terms-panel ${locked ? "is-locked" : ""}`}>
              <div className="panel-heading">
                <div className="panel-title"><span className="panel-number">01</span><div><h3>Agree on “done”</h3><p>Set the price and clear acceptance criteria before work begins.</p></div></div>
                {locked && <span className="locked-label"><span>✓</span> TERMS LOCKED</span>}
              </div>
              <div className="form-grid">
                <label className="field title-field"><span>Milestone name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={locked} /></label>
                <label className="field amount-field"><span>Milestone amount</span><div className="money-input"><span>$</span><input type="number" min="1" max="10000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={locked} /><b>USD</b></div></label>
                <label className="field criteria-field"><span>Acceptance criteria <small>One criterion per line · up to 8</small></span><textarea rows={4} value={criteriaText} onChange={(event) => setCriteriaText(event.target.value)} disabled={locked} /></label>
                <div className="form-footnote"><span className="footnote-icon">i</span> Specific, observable criteria make the review fairer for both sides.</div>
              </div>
            </section>

            <section className={`panel evidence-panel ${phase === "draft" ? "muted-panel" : ""}`}>
              <div className="panel-heading">
                <div className="panel-title"><span className="panel-number">02</span><div><h3>Share the evidence</h3><p>Choose a local keyword demo or an optional third-party Gemini review. Neither opens the link.</p></div></div>
                {phase === "draft" && <span className="after-auth">AFTER AUTHORIZATION</span>}
              </div>
              <div className="evidence-fields">
                <label className="field"><span>Deliverable link <small>Optional · not sent to the demo check</small></span><input type="url" value={deliverableUrl} onChange={(event) => setDeliverableUrl(event.target.value)} disabled={phase === "draft" || phase === "settled"} placeholder="https://github.com/..." /></label>
                <label className="field"><span>Evidence notes <small>What should the reviewer look for?</small></span><textarea rows={4} value={evidenceNotes} onChange={(event) => setEvidenceNotes(event.target.value)} disabled={phase === "draft" || phase === "settled"} /></label>
              </div>
              {phase === "draft" && <div className="locked-hint"><span className="lock-icon">⌑</span> Authorize the milestone first. Your agreed terms stay fixed during review.</div>}
              {phase === "authorized" && <>
                <fieldset className="review-mode-picker">
                  <legend>Review method</legend>
                  <label><input type="radio" name="review-mode" checked={reviewMode === "local"} onChange={() => setReviewMode("local")} /> Local keyword demo <small>Deterministic · no external call</small></label>
                  <label><input type="radio" name="review-mode" checked={reviewMode === "gemini"} onChange={() => setReviewMode("gemini")} disabled={!config?.geminiDemoReady} /> Gemini AI demo <small>{config?.geminiDemoReady ? "Optional · operator-configured" : "Unavailable · free-tier configuration not confirmed"}</small></label>
                </fieldset>
                {reviewMode === "gemini" && <div className="ai-data-notice">
                  <b>Third-party Gemini API Free-tier demo</b>
                  <p>Only acceptance criteria and evidence notes will be sent to Google. Prompts and responses may be used to improve Google products. Use fake/public demo data only; do not enter personal information or confidential client work. Gemini may be inaccurate and does not verify evidence or decide payment.</p>
                  <label><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /> I understand and acknowledge this data use; I am using fake/public demo data only.</label>
                </div>}
                <div className="review-cta-row"><div className="review-ready"><span className="ready-check">✓</span><span><b>Demo state recorded</b><small>{paymentMode === "simulation" ? "Local simulation · no PayPal funds involved" : "PayPal Sandbox test authorization"}</small></span></div><button className="button button-ink" onClick={runReview} disabled={busy || invalidCriteria || (reviewMode === "gemini" && (!config?.geminiDemoReady || !aiConsent))}>{busy ? <><span className="spinner" /> Checking…</> : reviewMode === "gemini" ? <>Send to Gemini <span>→</span></> : <>Run local demo <span>→</span></>}</button></div>
              </>}
            </section>

            {review && <section className="panel review-panel">
              <div className="panel-heading review-heading">
                <div className="panel-title"><span className="panel-number">03</span><div><h3>{review.mode === "gemini_advisory" ? "Gemini advisory review" : "Local demo check"}</h3><p>{review.mode === "gemini_advisory" ? "Third-party AI output · advisory only · not verification." : "Deterministic keyword overlap only — not AI and not verification."}</p></div></div>
                <span className={`ai-badge ${review.mode === "gemini_advisory" ? "real-ai" : "offline-ai"}`}><span>{review.mode === "gemini_advisory" ? "✳" : "◌"}</span>{review.mode === "gemini_advisory" ? "GEMINI · ADVISORY" : "LOCAL DEMO · NOT AI"}</span>
              </div>
              <p className="review-summary">{review.summary}</p>
              <div className="criteria-results">
                {criteria.map((criterion, index) => {
                  const result = review.results.find((item) => item.id === criterion.id);
                  if (!result) return null;
                  return <article className={`result-card ${review.mode === "gemini_advisory" ? "result-card-advisory" : ""}`} key={criterion.id}>
                    <div className="result-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className="result-content"><div className="result-topline"><h4>{criterion.text}</h4><span className={`status-tag status-${result.status}`}>{result.status.replace("_", " ")}</span></div><p className="result-evidence"><span>Evidence</span> {result.evidence}</p><p className="result-rationale">{result.rationale}</p></div>
                    {review.mode === "demo_fixture" && typeof result.matchRatio === "number" && <div className="confidence"><strong>{Math.round(result.matchRatio * 100)}%</strong><span>keyword match</span></div>}
                  </article>;
                })}
              </div>
              <div className="review-disclaimer"><span>!</span><p>{review.caution}</p></div>
            </section>}

            {phase === "reviewed" && <section className="panel decision-panel">
              <div className="decision-intro"><div><span className="section-kicker">YOUR CALL</span><h3>What happens next?</h3><p>Read the notes, inspect the deliverable, then choose. ProofPay never moves money automatically.</p></div><div className="decision-amount"><span>{paymentMode === "simulation" ? "DEMO AMOUNT" : "AUTHORIZED"}</span><strong>{money(amount)}</strong></div></div>
              <div className="decision-actions">
                <button className="decision-button capture-button" onClick={() => settle("capture")} disabled={decisionBusy}><span className="decision-icon">✓</span><span><b>{paymentMode === "simulation" ? "Mark demo captured" : "Capture Sandbox payment"}</b><small>{paymentMode === "simulation" ? "Local state only · no money moves" : `Sandbox test capture · ${money(amount)}`}</small></span><i>→</i></button>
                <button className="decision-button void-button" onClick={() => settle("void")} disabled={decisionBusy}><span className="decision-icon">×</span><span><b>{paymentMode === "simulation" ? "Void demo authorization" : "Void Sandbox authorization"}</b><small>{paymentMode === "simulation" ? "Local state only · no payment exists" : "Cancel this pending Sandbox authorization"}</small></span><i>→</i></button>
              </div>
            </section>}

            {phase === "settled" && <section className={`panel settled-panel ${paymentStatus === "CAPTURED" ? "settled-captured" : "settled-voided"}`}>
              <span className="settled-icon">{paymentStatus === "CAPTURED" ? "✓" : "×"}</span><div><span className="section-kicker">DECISION RECORDED · {paymentMode === "simulation" ? "LOCAL SIMULATION" : "PAYPAL SANDBOX"}</span><h3>{paymentStatus === "CAPTURED" ? "Payment captured" : "Authorization voided"}</h3><p>{paymentMode === "simulation" ? "This walkthrough did not send a request to PayPal or move any money." : `PayPal Sandbox returned status ${paymentStatus}.`}</p></div><button className="text-button" onClick={startOver}>Start a new milestone <span>↗</span></button>
            </section>}

            {error && <div className="error-banner" role="alert"><span>!</span><p>{error}</p><button aria-label="Dismiss error" onClick={() => setError("")}>×</button></div>}
          </div>

          <aside className="side-column">
            <section className="payment-card">
              <div className="payment-card-top"><span className="section-kicker">PAYMENT STATUS</span><span className={`status-led ${phase === "settled" ? "led-done" : phase !== "draft" ? "led-wait" : ""}`} /></div>
              <h3>{phase === "draft" ? "Ready to authorize?" : phase === "authorized" ? "Authorization active" : phase === "reviewed" ? "Awaiting your decision" : paymentStatus === "CAPTURED" ? "Payment captured" : "Authorization voided"}</h3>
              <p>{phase === "draft" ? (config?.paypalReady ? "Approve a PayPal Sandbox test order, or use the local simulation." : "Use the local simulation. No PayPal connection is currently configured.") : phase === "authorized" ? (paymentMode === "simulation" ? "Local demo state only; no funds are involved." : "No funds have been captured. Review the submission before deciding.") : phase === "reviewed" ? "The local demo check is complete. Inspect the work and choose." : paymentMode === "simulation" ? "The local simulation recorded your choice; no money moved." : "PayPal Sandbox returned a test result."}</p>
              <div className="payment-amount"><span>Milestone amount</span><strong>{money(amount)}</strong></div>
              {phase === "draft" && <div className="payment-action">
                {config?.paypalReady ? <><div ref={paypalContainer} className="paypal-button-container" />{!sdkLoaded && <div className="paypal-loading"><span className="spinner" /> Loading PayPal Sandbox…</div>}{sdkError && <p className="payment-note error-note">PayPal SDK did not load. Check your Sandbox client ID and network.</p>}</> : config?.paypalMisconfigured ? <div className="setup-alert"><b>PayPal setup incomplete</b><span>Set matching Sandbox client IDs and a Sandbox secret in your environment.</span></div> : <><button className="button button-paypal" onClick={startSimulation} disabled={busy || !config || hasInvalidAmount || !title.trim()}>{busy ? <><span className="spinner" /> Starting…</> : <>Start local demo <span>→</span></>}</button><p className="payment-note">This simulates authorization locally. It does not connect to PayPal or move money.</p></>}
                {(!config?.paypalReady && !config?.paypalMisconfigured) && <div className="payment-divider"><span>or connect Sandbox keys</span></div>}
              </div>}
              {phase !== "draft" && <div className={`authorization-badge ${phase === "settled" ? "is-settled" : ""}`}><span>{phase === "settled" ? "✓" : "◷"}</span><div><b>{paymentStatus}</b><small>{paymentMode === "simulation" ? "Local demo · no real payment" : "PayPal Sandbox · test transaction"}</small></div></div>}
              <div className="payment-safety"><span className="safety-icon">⌑</span><p><b>No live payments.</b> The verified walkthrough is a local simulation. A PayPal authorization is not escrow or a guarantee of payment.</p></div>
            </section>

            <section className="principles-card"><span className="section-kicker">BUILT ON THREE PROMISES</span><div className="principle"><span>01</span><div><b>Agree first</b><p>Set clear, testable criteria upfront.</p></div></div><div className="principle"><span>02</span><div><b>Show your work</b><p>Every recommendation points to evidence.</p></div></div><div className="principle"><span>03</span><div><b>Human in control</b><p>Only the client can confirm a payment action.</p></div></div></section>

            <section className="setup-card"><div className="setup-card-heading"><span className="section-kicker">DEMO STATUS</span><span className="setup-status">{config ? "STATUS" : "CHECKING"}</span></div><div className="connection-row"><span className="connection-icon paypal-icon">P</span><span><b>PayPal Sandbox</b><small>{config?.paypalReady ? "Sandbox test path ready; transaction not yet verified" : config?.paypalMisconfigured ? "Configuration incomplete" : "Local simulation only · not connected"}</small></span><i className={config?.paypalReady ? "connected" : ""}>{config?.paypalReady ? "✓" : "–"}</i></div><div className="connection-row"><span className="connection-icon ai-icon">◌</span><span><b>Review method</b><small>{config?.geminiDemoReady ? "Local demo + optional Gemini Free-tier path configured" : "Local keyword demo · optional Gemini path not configured"}</small></span><i className={config?.geminiDemoReady ? "connected" : ""}>{config?.geminiDemoReady ? "✓" : "–"}</i></div><p className="setup-caption">Gemini configuration is not independently verified here. Use only after the operator confirms free-tier/no-billing status. Never use PayPal Live credentials.</p></section>
          </aside>
        </div>
      </section>

      <footer className="footer"><a className="brand footer-brand" href="#top"><Mark /><span>proof<span className="brand-light">pay</span></span></a><p>Designed for clearer agreements, not automatic decisions.</p><div><span>MIT LICENSE</span><span>LOCAL DEMO</span></div></footer>
    </main>
  );
}
