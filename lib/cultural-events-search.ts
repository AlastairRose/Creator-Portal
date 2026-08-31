import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CULTURAL_EVENT_REGIONS } from "@/lib/types";

type SuggestedEvent = {
  title: string;
  event_date: string;
  event_end_date: string | null;
  category: string | null;
  regions: string[];
  description: string | null;
};

// Vercel's Hobby plan hard-caps a serverless function/action at 60s of
// execution no matter what's configured — this isn't a preference, it's a
// platform ceiling. A broad research task (many searches, lots of
// deliberation) can easily run for minutes, so the request has to stay on
// a short leash: few searches, a small output, and a client-side timeout
// that fails fast well inside that budget rather than letting Vercel kill
// it uncleanly right at the edge.
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_SEARCHES = 4;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANT-ena isn't configured yet (missing ANTHROPIC_API_KEY).");
  return new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
}

// Asks Claude to search the web for what's coming up and return strict
// JSON. Web search is a server-executed tool — Anthropic runs the searches
// and feeds results back within this single API call, so there's no
// multi-turn tool loop to manage here.
async function searchForCulturalEvents(existingTitles: string[]): Promise<SuggestedEvent[]> {
  const client = getClient();
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Search the web and find major worldwide cultural, entertainment, sporting, and gaming events happening between ${today} and 10 weeks from now that would be widely talked about on social media in the United States, United Kingdom, Canada, Europe, and Australia. Think: major sporting finals/tournaments, big video game or album releases, awards shows, major holidays, and similarly viral cultural moments — the kind of thing a social media content team would want to plan posts around.

Work quickly: do no more than ${MAX_SEARCHES} focused web searches total, then answer immediately from what you found — this needs to finish in well under a minute, so do not keep researching past that.

Skip anything already in this list: ${existingTitles.length > 0 ? existingTitles.join(", ") : "(none yet)"}.

Respond with ONLY a JSON array (no other text before or after) of objects with this exact shape:
[{"title": string, "event_date": "YYYY-MM-DD", "event_end_date": "YYYY-MM-DD" or null, "category": string, "regions": array of one or more of ${JSON.stringify(CULTURAL_EVENT_REGIONS)}, "description": a one-sentence note on why it's culturally relevant}]`;

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    // Extended thinking was eating almost the whole output budget on a
    // plain extraction task like this, leaving nothing for the actual
    // JSON answer — disabled so every output token goes to the result.
    thinking: { type: "disabled" },
    tools: [{ type: "web_search_20260318", name: "web_search", max_uses: MAX_SEARCHES }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Couldn't find any events in the search results.");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error("Unexpected search result format.");

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item.title === "string" && typeof item.event_date === "string"
    )
    .map((item) => ({
      title: item.title as string,
      event_date: item.event_date as string,
      event_end_date: typeof item.event_end_date === "string" ? item.event_end_date : null,
      category: typeof item.category === "string" ? item.category : null,
      regions: Array.isArray(item.regions) ? item.regions.filter((r): r is string => typeof r === "string") : [],
      description: typeof item.description === "string" ? item.description : null,
    }));
}

// Shared by the "Search now" server action and the weekly cron route —
// only the Supabase client differs (request-scoped vs. admin/service-role,
// since a cron invocation has no signed-in session to carry RLS).
export async function runCulturalEventsSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<number> {
  const { data: existing, error: existingError } = await supabase.from("cultural_events").select("title");
  if (existingError) throw new Error(existingError.message);
  const existingTitles = (existing ?? []).map((e) => e.title as string);

  const found = await searchForCulturalEvents(existingTitles);
  const newOnes = found.filter(
    (event) => !existingTitles.some((title) => title.toLowerCase() === event.title.toLowerCase())
  );
  if (newOnes.length === 0) return 0;

  const { error: insertError } = await supabase.from("cultural_events").insert(
    newOnes.map((event) => ({
      ...event,
      status: "suggested",
      source: "ai_suggested",
    }))
  );
  if (insertError) throw new Error(insertError.message);

  return newOnes.length;
}
