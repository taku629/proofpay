import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const routeSource = readFileSync(new URL("../app/api/ai/review/route.ts", import.meta.url), "utf8");
const routeJs = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(routeJs).toString("base64")}`);

const envNames = ["GEMINI_API_KEY", "GEMINI_PROJECT_ID", "GEMINI_FREE_TIER_CONFIRMED"];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const sample = {
  criteria: [{ id: "criterion-1", text: "Public demo page uses a responsive layout" }],
  notes: "Fake public demo notes: checked the layout at two viewport sizes.",
  consent: true,
};

function setConfigured() {
  process.env.GEMINI_API_KEY = "MOCK_ONLY_NOT_A_REAL_KEY";
  process.env.GEMINI_PROJECT_ID = "mock-project-id";
  process.env.GEMINI_FREE_TIER_CONFIRMED = "true";
}

function setResponse(payload, status = 200) {
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function send(payload = sample) {
  return POST(new Request("http://localhost/api/ai/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

function modelResponse(value) {
  return { candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] };
}

afterEach(() => {
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
  globalThis.fetch = originalFetch;
});

test("requires consent and all three server-side configuration guards", async () => {
  for (const name of envNames) delete process.env[name];
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("unexpected network"); };

  const consentRequired = await send({ ...sample, consent: false });
  assert.equal(consentRequired.status, 400);
  const notConfigured = await send();
  assert.equal(notConfigured.status, 503);
  assert.equal(called, false);
});

test("sends only bounded review inputs to the fixed Gemini model and returns advisory output", async () => {
  setConfigured();
  let requestUrl = "";
  let requestBody = "";
  let requestHeaders = {};
  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestBody = String(init.body);
    requestHeaders = init.headers;
    return new Response(JSON.stringify(modelResponse({
      summary: "Notes appear to address the criterion, but inspect the deliverable.",
      results: [{ id: "criterion-1", status: "partial", evidence: "Notes mention two viewport sizes.", rationale: "The note is relevant but does not independently verify the layout." }],
    })), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const response = await send();
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(requestHeaders["x-goog-api-key"], "MOCK_ONLY_NOT_A_REAL_KEY");
  assert.equal(requestBody.includes(sample.notes), true);
  assert.equal(requestBody.includes(sample.criteria[0].text), true);
  assert.equal(requestBody.includes("MOCK_ONLY_NOT_A_REAL_KEY"), false);
  assert.equal(JSON.parse(requestBody).generationConfig.maxOutputTokens, 4096);
  assert.equal(result.mode, "gemini_advisory");
  assert.equal(result.model, "gemini-2.5-flash");
  assert.equal("matchRatio" in result.results[0], false);
  assert.match(result.caution, /advisory/i);
});

test("rejects extra fields, oversized notes, and duplicate criterion ids before any external call", async () => {
  setConfigured();
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("unexpected network"); };
  const invalidPayloads = [
    { ...sample, deliverableUrl: "https://example.com/not-sent" },
    { ...sample, criteria: [{ ...sample.criteria[0], privateField: "not-sent" }] },
    { ...sample, notes: "x".repeat(8001) },
    { ...sample, criteria: [sample.criteria[0], sample.criteria[0]] },
  ];
  for (const payload of invalidPayloads) assert.equal((await send(payload)).status, 400);
  assert.equal(called, false);
});

test("rejects malformed model output without falling back or exposing upstream errors", async () => {
  setConfigured();
  setResponse(modelResponse({ summary: "Wrong ids", results: [{ id: "other", status: "met", evidence: "Evidence", rationale: "Reason" }] }));
  const invalidOutput = await send();
  assert.equal(invalidOutput.status, 502);
  assert.match((await invalidOutput.json()).error, /No local fallback/);

  setResponse({ error: { message: "UPSTREAM_PRIVATE_ERROR_DETAIL" } }, 429);
  const upstreamFailure = await send();
  assert.equal(upstreamFailure.status, 502);
  const failureBody = await upstreamFailure.text();
  assert.equal(failureBody.includes("UPSTREAM_PRIVATE_ERROR_DETAIL"), false);
});
