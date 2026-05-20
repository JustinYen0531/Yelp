// yelp-agent.jsx — OpenRouter integration for the panic-signal-interpreter Agent.
// System prompt + schema mirror yelp-agent-spec.md §2 + §3.
// Exposes window.YelpAgent.runAgent({ rawInput, sourceType, ... }) → Promise<{parsed, usage}>.

(function () {
  const STORAGE_KEY   = "yelp.openrouter.key";
  const STORAGE_MODEL = "yelp.openrouter.model";
  const DEFAULT_MODEL = "google/gemini-2.5-flash";
  const ENDPOINT      = "https://openrouter.ai/api/v1/chat/completions";

  // System prompt is the source of truth for Agent behavior.
  // Keep in sync with yelp-agent-spec.md §2.
  const SYSTEM_PROMPT = [
    "你是 yelp 災情語意解析 Agent。",
    "你的任務是將使用者在緊急情境下輸入的混亂文字、語音轉錄或手勢線索，",
    "轉換為標準化 JSON 災情情報。",
    "",
    "請遵守：",
    "1. 只輸出 JSON，不輸出解釋文字。",
    "2. 不確定的欄位填 null。",
    "3. 不得編造地點、人數、災情類型。",
    "4. 可根據語氣與字詞推估 panic_level、urgency_level、confidence、priority_score。",
    "5. 若訊息包含行動不便、老人、小孩、受困、受傷，需標記 vulnerable_flags。",
    "6. 每個推論欄位都要附上 evidence 中對應的依據原文。",
    "7. 必須完整保留原始輸入於 raw_input 欄位，不得改寫、修飾或標點化。",
    "8. 必須標註資料來源類型 source_type (text / voice_transcript / gesture / location_button / block_report)。",
    "",
    "輸出 JSON Schema (對應 yelp-agent-spec.md §3，所有欄位皆必須出現)：",
    "{",
    '  "event_id": "string or null",',
    '  "timestamp": "ISO-8601 or null",',
    '  "source_type": "text | voice_transcript | gesture | location_button | block_report",',
    '  "raw_input": "string or null",',
    '  "location": {"lat": "number or null", "lng": "number or null", "raw_text": "string or null"},',
    '  "event_type": "earthquake | flood | landslide | fire | medical | trapped | infrastructure_damage | unknown",',
    '  "hazards": ["string"],',
    '  "severity_level": "1-5 or null",',
    '  "urgency_level": "1-5 or null",',
    '  "panic_level": "0.0-1.0",',
    '  "confidence": "0.0-1.0",',
    '  "priority_score": "0.0-1.0",',
    '  "reporter_status": "safe | trapped | injured | unknown",',
    '  "people": {"count": "number or null", "vulnerable_flags": {"elderly": "boolean", "child": "boolean", "mobility_issue": "boolean", "injured": "boolean", "alone": "boolean"}},',
    '  "needs": ["evacuation | medical | rescue | food_water | shelter | information | unknown"],',
    '  "evidence": {"event_type": "string", "severity_level": "string", "panic_level": "string", "needs": "string"},',
    '  "missing_information": ["string"],',
    '  "recommended_next_action": "string"',
    "}",
    "",
    "hazards 建議詞彙集：rising_water, blocked_exit, power_outage, road_damage, structural_collapse, gas_leak, landslide_debris.",
  ].join("\n");

  function getApiKey()  { try { return localStorage.getItem(STORAGE_KEY)   || ""; } catch (e) { return ""; } }
  function getModel()   { try { return localStorage.getItem(STORAGE_MODEL) || DEFAULT_MODEL; } catch (e) { return DEFAULT_MODEL; } }
  function hasKey()     { return getApiKey().length > 0; }

  // Best-effort JSON extraction — handles bare JSON, markdown fenced blocks,
  // and leading explanatory prose (which the Agent shouldn't produce but might).
  function extractJson(text) {
    if (!text || typeof text !== "string") return null;
    // 1) try direct parse
    try { return JSON.parse(text); } catch (e) {}
    // 2) try fenced ```json ... ``` block
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
    // 3) try first {...} balanced block
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
    }
    return null;
  }

  // Force the contract: raw_input must equal what we sent, verbatim.
  // Per spec rule 7, the Agent MUST NOT modify it.
  function enforceContract(parsed, originalRawInput, originalSourceType) {
    if (!parsed || typeof parsed !== "object") return parsed;
    if (originalRawInput   !== undefined) parsed.raw_input   = originalRawInput;
    if (originalSourceType !== undefined && !parsed.source_type) parsed.source_type = originalSourceType;
    return parsed;
  }

  async function runAgent({
    rawInput,
    sourceType = "voice_transcript",
    eventId    = null,
    location   = null,
    signal     = undefined,    // AbortSignal
    modelOverride,
  } = {}) {
    if (!rawInput || typeof rawInput !== "string") {
      throw new Error("runAgent: rawInput is required (string)");
    }
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("尚未設定 API key — 請在 preferences.cfg 視窗貼上 OpenRouter key 後 save");
    }
    const model = modelOverride || getModel();

    // Pass structured input — model gets explicit fields, not just freeform text.
    const userMsg = [
      "請依規則將下列災情訊號轉換為 JSON：",
      "",
      "raw_input:   " + JSON.stringify(rawInput),
      "source_type: " + JSON.stringify(sourceType),
      "event_id:    " + JSON.stringify(eventId),
      location ? "location:    " + JSON.stringify(location) : "location:    null",
    ].join("\n");

    const startedAt = Date.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type":  "application/json",
        "HTTP-Referer":  window.location.origin || "http://localhost",
        "X-Title":       "yelp-panic-interpreter",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userMsg },
        ],
        // Many OpenRouter-routed models honor this; Gemini 2.5 Flash does.
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal,
    });

    const elapsedMs = Date.now() - startedAt;

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = (j && j.error && j.error.message) || JSON.stringify(j).slice(0, 240);
      } catch (e) {
        detail = res.statusText;
      }
      const err = new Error("HTTP " + res.status + " · " + detail);
      err.status = res.status;
      throw err;
    }

    const data    = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) {
      throw new Error("回傳格式異常：缺少 choices[0].message.content");
    }
    const parsed = extractJson(content);
    if (!parsed) {
      throw new Error("回傳不是合法 JSON · 開頭片段：" + String(content).slice(0, 120));
    }
    enforceContract(parsed, rawInput, sourceType);

    return {
      parsed,
      usage:     data.usage || null,
      model:     data.model || model,
      elapsedMs,
      rawContent: content,
    };
  }

  window.YelpAgent = {
    runAgent,
    getApiKey,
    getModel,
    hasKey,
    DEFAULT_MODEL,
    SYSTEM_PROMPT,
  };
})();
