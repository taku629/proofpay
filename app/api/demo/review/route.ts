import { NextResponse } from "next/server";

export const runtime = "nodejs";

const stopWords = new Set([
  "the", "and", "for", "with", "from", "that", "this", "uses", "using", "works", "displays", "shows", "should", "must", "have", "has", "into", "onto",
]);

type Criterion = { id: string; text: string };
type ReviewItem = {
  id: string;
  status: "met" | "partial" | "not_met" | "unclear";
  evidence: string;
  rationale: string;
  matchRatio: number;
};

function keywords(text: string) {
  return [...new Set((text.toLowerCase().match(/[a-z0-9#-]{3,}/g) ?? []).filter((word) => !stopWords.has(word)))];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const criteria = body.criteria as Criterion[];
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 12000) : "";
    if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > 8 || criteria.some((item) =>
      !item || typeof item.id !== "string" || item.id.length > 80 || typeof item.text !== "string" || !item.text.trim() || item.text.length > 240)) {
      return NextResponse.json({ error: "Add between 1 and 8 acceptance criteria, each up to 240 characters." }, { status: 400 });
    }

    const noteWords = new Set(keywords(notes));
    const results: ReviewItem[] = criteria.map((criterion) => {
      const words = keywords(criterion.text);
      const matched = words.filter((word) => noteWords.has(word));
      const matchRatio = words.length ? matched.length / words.length : 0;
      const status: ReviewItem["status"] = !notes.trim() ? "unclear" : matchRatio >= 0.55 ? "met" : matchRatio > 0 ? "partial" : "not_met";
      return {
        id: criterion.id,
        status,
        evidence: matched.length ? `Matching terms in your notes: ${matched.slice(0, 6).join(", ")}.` : "No matching keywords were found in your notes.",
        rationale: `Demo rule only: ${matched.length} of ${words.length} criterion keywords appear in the notes. This does not assess quality or verify the work.`,
        matchRatio,
      };
    });

    return NextResponse.json({
      summary: "LOCAL DEMO ONLY — deterministic keyword overlap. No AI model or external review service is called.",
      results,
      mode: "demo_fixture",
      model: null,
      caution: "This is not an AI assessment or verification. The optional link is not sent to this check or opened. Inspect the actual deliverable yourself before deciding what to do.",
    });
  } catch {
    return NextResponse.json({ error: "Unable to run the local demo check." }, { status: 400 });
  }
}
