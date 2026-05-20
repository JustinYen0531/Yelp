/**
 * yelp — Panic Signal Interpreter Library (Node.js / ESM)
 *
 * Single-function library that turns a chaotic disaster-victim message into a
 * structured JSON disaster report.
 *
 * Conforms to yelp-agent-spec.md §3.
 * Backend: OpenRouter (default model: google/gemini-2.5-flash).
 * Requires: Node.js 18+ (native fetch). No npm dependencies.
 *
 * Quick start
 * -----------
 *     export OPENROUTER_API_KEY=sk-or-v1-...
 *     node yelp.mjs "救命水一直進來我媽走不了快點快點"
 *
 * Programmatic
 * ------------
 *     import { analyzePanicSignal } from "./yelp.mjs";
 *     const result = await analyzePanicSignal({
 *       rawInput: "救命水一直進來我媽走不了快點快點",
 *       sourceType: "voice_transcript",
 *       location: { lat: 23.4012, lng: 121.3104 },
 *     });
 *     console.log(result.event_type);     // "flood"
 *     console.log(result.priority_score); // ~0.94
 *
 * Mock mode (no API call, returns canonical fixture)
 * ---------------------------------------------------
 *     YELP_MOCK=1 node yelp.mjs "anything"
 *
 * See lib/README.md for failure modes and self-test recipes.
 */

export const DEFAULT_MODEL = "google/gemini-2.5-flash";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// NOTE: keep this prompt in sync with yelp-agent.js (browser) and yelp.py (python).
const SYSTEM_PROMPT = `你是 yelp 災情語意解析 Agent。
你的任務是將使用者在緊急情境下輸入的混亂文字、語音轉錄或手勢線索，
轉換為標準化 JSON 災情情報。

請遵守：
1. 只輸出 JSON，不輸出解釋文字。
2. 不確定的欄位填 null。
3. 不得編造地點、人數、災情類型。
4. 可根據語氣與字詞推估 panic_level、urgency_level、confidence、priority_score。
5. 若訊息包含行動不便、老人、小孩、受困、受傷，需標記 vulnerable_flags。
6. 每個推論欄位都要附上 evidence 中對應的依據原文。
7. 必須完整保留原始輸入於 raw_input 欄位，不得改寫、修飾或標點化。
8. 必須標註資料來源類型 source_type (text / voice_transcript / gesture / location_button / block_report)。

輸出 JSON Schema (對應 yelp-agent-spec.md §3，所有欄位皆必須出現)：
{
  "event_id": "string or null",
  "timestamp": "ISO-8601 or null",
  "source_type": "text | voice_transcript | gesture | location_button | block_report",
  "raw_input": "string or null",
  "location": {"lat": "number or null", "lng": "number or null", "raw_text": "string or null"},
  "event_type": "earthquake | flood | landslide | fire | medical | trapped | infrastructure_damage | unknown",
  "hazards": ["string"],
  "severity_level": "1-5 or null",
  "urgency_level": "1-5 or null",
  "panic_level": "0.0-1.0",
  "confidence": "0.0-1.0",
  "priority_score": "0.0-1.0",
  "reporter_status": "safe | trapped | injured | unknown",
  "people": {"count": "number or null", "vulnerable_flags": {"elderly": "boolean", "child": "boolean", "mobility_issue": "boolean", "injured": "boolean", "alone": "boolean"}},
  "needs": ["evacuation | medical | rescue | food_water | shelter | information | unknown"],
  "evidence": {"event_type": "string", "severity_level": "string", "panic_level": "string", "needs": "string"},
  "missing_information": ["string"],
  "recommended_next_action": "string"
}

hazards 建議詞彙集：rising_water, blocked_exit, power_outage, road_damage, structural_collapse, gas_leak, landslide_debris.`;

// Canonical mock — same example as the demo, used when YELP_MOCK=1.
const MOCK_FIXTURE = {
  event_id: "evt_mock_06420f",
  timestamp: "2026-05-17T06:42:11+08:00",
  source_type: "voice_transcript",
  raw_input: null, // filled at runtime
  location: { lat: 23.4012, lng: 121.3104, raw_text: "low-lying riverside" },
  event_type: "flood",
  hazards: ["rising_water", "blocked_exit"],
  severity_level: 4,
  urgency_level: 5,
  panic_level: 0.86,
  confidence: 0.72,
  priority_score: 0.94,
  reporter_status: "unknown",
  people: {
    count: 2,
    vulnerable_flags: {
      elderly: false, child: false, mobility_issue: true,
      injured: false, alone: false,
    },
  },
  needs: ["rescue", "evacuation"],
  evidence: {
    event_type: "水一直進來",
    severity_level: "水一直進來、快點快點",
    panic_level: "救命、快點快點、語句急促",
    needs: "我媽走不了",
  },
  missing_information: ["exact_location", "injury_status", "reporter_self_status"],
  recommended_next_action: "優先確認定位並派送撤離支援",
};

export class YelpAgentError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "YelpAgentError";
    this.status = status;
  }
}

/**
 * Turn a chaotic disaster-victim message into a structured JSON disaster report.
 *
 * @param {Object} opts
 * @param {string} opts.rawInput               Required. Victim's raw text / transcript.
 * @param {string} [opts.sourceType]           "text" | "voice_transcript" | "gesture" |
 *                                             "location_button" | "block_report".
 * @param {string|null} [opts.eventId]         Optional event identifier.
 * @param {Object|null} [opts.location]        Optional {lat, lng, raw_text}.
 * @param {string} [opts.apiKey]               OpenRouter key. Defaults to env OPENROUTER_API_KEY.
 * @param {string} [opts.model]                Defaults to google/gemini-2.5-flash.
 * @param {AbortSignal} [opts.signal]          Optional AbortSignal.
 * @returns {Promise<Object>}                  Dict matching yelp-agent-spec.md §3.
 * @throws {YelpAgentError}                    On missing key / HTTP error / parse failure.
 */
export async function analyzePanicSignal({
  rawInput,
  sourceType = "voice_transcript",
  eventId = null,
  location = null,
  apiKey,
  model,
  signal,
} = {}) {
  if (typeof rawInput !== "string" || !rawInput) {
    throw new YelpAgentError("rawInput is required (non-empty string)");
  }

  // Mock mode
  if (process.env.YELP_MOCK === "1") {
    const fixture = JSON.parse(JSON.stringify(MOCK_FIXTURE));
    fixture.raw_input = rawInput;
    fixture.source_type = sourceType;
    if (eventId !== null) fixture.event_id = eventId;
    if (location !== null) fixture.location = location;
    return fixture;
  }

  apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    throw new YelpAgentError(
      "missing API key — set OPENROUTER_API_KEY env var or pass apiKey",
    );
  }
  model = model || DEFAULT_MODEL;

  const userMsg = [
    "請依規則將下列災情訊號轉換為 JSON：",
    "",
    `raw_input:   ${JSON.stringify(rawInput)}`,
    `source_type: ${JSON.stringify(sourceType)}`,
    `event_id:    ${JSON.stringify(eventId)}`,
    `location:    ${location ? JSON.stringify(location) : "null"}`,
  ].join("\n");

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://github.com/yelp-panic-interpreter",
        "X-Title":       "yelp-panic-interpreter",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMsg },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    throw new YelpAgentError(`network error: ${e.message || e}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j).slice(0, 200);
    } catch (e) {
      detail = res.statusText;
    }
    throw new YelpAgentError(`HTTP ${res.status}: ${detail || res.statusText}`, res.status);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new YelpAgentError("malformed response: missing choices[0].message.content");

  const parsed = extractJson(content);
  if (parsed === null) {
    throw new YelpAgentError(`response is not valid JSON · prefix: ${String(content).slice(0, 120)}`);
  }

  // spec rule 7 — raw_input preserved verbatim
  parsed.raw_input = rawInput;
  if (!parsed.source_type) parsed.source_type = sourceType;

  return parsed;
}

function extractJson(text) {
  // 1) direct parse
  try { return JSON.parse(text); } catch (e) {}
  // 2) fenced ```json ... ```
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) { try { return JSON.parse(m[1]); } catch (e) {} }
  // 3) first balanced {...}
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}

// CLI entry — only when invoked directly, not when imported.
const isMain = (() => {
  try {
    const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/");
    const self    = new URL(import.meta.url).pathname.replace(/\\/g, "/");
    return invoked && (self.endsWith(invoked) || invoked.endsWith(self.split("/").pop()));
  } catch (e) { return false; }
})();

if (isMain) {
  const text = process.argv[2];
  if (!text || text === "-h" || text === "--help") {
    process.stderr.write(
      "Usage: node yelp.mjs '<raw input text>'\n" +
      "Required: OPENROUTER_API_KEY env var (or YELP_MOCK=1 for fixture)\n"
    );
    process.exit(text === "-h" || text === "--help" ? 0 : 2);
  }
  try {
    const result = await analyzePanicSignal({ rawInput: text });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`yelp error: ${e.message}\n`);
    process.exit(1);
  }
}
