"""
yelp — Panic Signal Interpreter Library (Python)

Single-function library that turns a chaotic disaster-victim message into a
structured JSON disaster report.

Conforms to yelp-agent-spec.md §3.
Backend: OpenRouter (default model: google/gemini-2.5-flash).
Dependencies: Python stdlib only.

Quick start
-----------

    export OPENROUTER_API_KEY=sk-or-v1-...
    python yelp.py "救命水一直進來我媽走不了快點快點"

Programmatic
------------

    from yelp import analyze_panic_signal
    result = analyze_panic_signal(
        raw_input="救命水一直進來我媽走不了快點快點",
        source_type="voice_transcript",
        location={"lat": 23.4012, "lng": 121.3104},
    )
    print(result["event_type"])     # "flood"
    print(result["priority_score"]) # ~0.94

Mock mode (no API call, returns canonical fixture)
---------------------------------------------------

    YELP_MOCK=1 python yelp.py "anything"

See lib/README.md for failure modes and self-test recipes.
"""

import json
import os
import re
import sys
import urllib.request
import urllib.error

__all__ = ["analyze_panic_signal", "YelpAgentError", "DEFAULT_MODEL"]

DEFAULT_MODEL = "google/gemini-2.5-flash"
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"

# NOTE: keep this prompt in sync with yelp-agent.js (browser) and yelp.mjs (node).
SYSTEM_PROMPT = """你是 yelp 災情語意解析 Agent。
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

hazards 建議詞彙集：rising_water, blocked_exit, power_outage, road_damage, structural_collapse, gas_leak, landslide_debris.
"""

# Canonical mock — same example as the demo, used when YELP_MOCK=1.
_MOCK_FIXTURE = {
    "event_id": "evt_mock_06420f",
    "timestamp": "2026-05-17T06:42:11+08:00",
    "source_type": "voice_transcript",
    "raw_input": None,  # filled at runtime
    "location": {"lat": 23.4012, "lng": 121.3104, "raw_text": "low-lying riverside"},
    "event_type": "flood",
    "hazards": ["rising_water", "blocked_exit"],
    "severity_level": 4,
    "urgency_level": 5,
    "panic_level": 0.86,
    "confidence": 0.72,
    "priority_score": 0.94,
    "reporter_status": "unknown",
    "people": {
        "count": 2,
        "vulnerable_flags": {
            "elderly": False, "child": False, "mobility_issue": True,
            "injured": False, "alone": False,
        },
    },
    "needs": ["rescue", "evacuation"],
    "evidence": {
        "event_type": "水一直進來",
        "severity_level": "水一直進來、快點快點",
        "panic_level": "救命、快點快點、語句急促",
        "needs": "我媽走不了",
    },
    "missing_information": ["exact_location", "injury_status", "reporter_self_status"],
    "recommended_next_action": "優先確認定位並派送撤離支援",
}


class YelpAgentError(Exception):
    """Raised on missing API key, HTTP error, or response parse failure."""
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def analyze_panic_signal(
    raw_input,
    source_type="voice_transcript",
    event_id=None,
    location=None,
    api_key=None,
    model=None,
    timeout=30.0,
):
    """
    Turn a chaotic disaster-victim message into a structured JSON disaster report.

    Args:
        raw_input (str): The victim's raw text or voice transcript (required).
        source_type (str): One of "text", "voice_transcript", "gesture",
                           "location_button", "block_report".
        event_id (str | None): Optional caller-supplied event identifier.
        location (dict | None): Optional dict with "lat", "lng", "raw_text".
        api_key (str | None): OpenRouter key. Defaults to env OPENROUTER_API_KEY.
        model (str | None): Defaults to google/gemini-2.5-flash.
        timeout (float): HTTP timeout in seconds (default 30).

    Returns:
        dict: A dict conforming to yelp-agent-spec.md §3.

    Raises:
        YelpAgentError: missing key, HTTP non-2xx, network error, or JSON parse failure.

    Side effects:
        None except the HTTP request.

    Mock mode:
        If env var YELP_MOCK=1, returns the canonical fixture with raw_input
        substituted in. No HTTP call is made. Useful for downstream-integration
        tests without burning OpenRouter credits.
    """
    if not isinstance(raw_input, str) or not raw_input:
        raise YelpAgentError("raw_input is required (non-empty string)")

    # Mock mode
    if os.environ.get("YELP_MOCK") == "1":
        fixture = json.loads(json.dumps(_MOCK_FIXTURE))  # deep-copy
        fixture["raw_input"] = raw_input
        fixture["source_type"] = source_type
        if event_id is not None:
            fixture["event_id"] = event_id
        if location is not None:
            fixture["location"] = location
        return fixture

    api_key = api_key or os.environ.get("OPENROUTER_API_KEY") or ""
    if not api_key:
        raise YelpAgentError(
            "missing API key — set OPENROUTER_API_KEY env var or pass api_key=..."
        )
    model = model or DEFAULT_MODEL

    user_msg = "\n".join([
        "請依規則將下列災情訊號轉換為 JSON：",
        "",
        "raw_input:   " + json.dumps(raw_input, ensure_ascii=False),
        "source_type: " + json.dumps(source_type),
        "event_id:    " + json.dumps(event_id),
        "location:    " + (json.dumps(location, ensure_ascii=False) if location else "null"),
    ])

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type":  "application/json",
            "HTTP-Referer":  "https://github.com/yelp-panic-interpreter",
            "X-Title":       "yelp-panic-interpreter",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            err_body = json.loads(e.read().decode("utf-8"))
            detail = err_body.get("error", {}).get("message") or json.dumps(err_body)[:200]
        except Exception:
            pass
        raise YelpAgentError("HTTP " + str(e.code) + ": " + (detail or e.reason), status=e.code)
    except urllib.error.URLError as e:
        raise YelpAgentError("network error: " + str(e.reason))

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise YelpAgentError("malformed response: missing choices[0].message.content")
    if not content:
        raise YelpAgentError("malformed response: empty content")

    parsed = _extract_json(content)
    if parsed is None:
        raise YelpAgentError("response is not valid JSON · prefix: " + content[:120])

    # spec rule 7 — raw_input must be preserved verbatim
    parsed["raw_input"] = raw_input
    if not parsed.get("source_type"):
        parsed["source_type"] = source_type

    return parsed


def _extract_json(text):
    """Best-effort JSON extraction: direct → fenced ```json``` block → first {...}"""
    # 1) direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 2) fenced ```json ... ```
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # 3) first balanced {...}
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return None


def _cli():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(0 if "-h" in sys.argv or "--help" in sys.argv else 2)

    text = sys.argv[1]
    try:
        result = analyze_panic_signal(text)
    except YelpAgentError as e:
        print("yelp error: " + str(e), file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _cli()
