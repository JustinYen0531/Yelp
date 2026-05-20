# yelp · Library

`yelp` 的 **Library 元件**（M8）—— 把混亂災情訊號轉成標準 JSON 的單一函式。

兩個等效實作：

| 檔 | 執行環境 | 依賴 |
|---|---|---|
| [yelp.py](yelp.py)  | Python 3.7+ | stdlib only |
| [yelp.mjs](yelp.mjs) | Node.js 18+ | 無 npm 依賴（用 native fetch） |

兩邊輸入/輸出契約完全相同，對應 [../yelp-agent-spec.md](../yelp-agent-spec.md) §3 schema。

---

## 快速開始

### 1. 取得 OpenRouter API key

到 [openrouter.ai/keys](https://openrouter.ai/keys) 生一把，免費 model（含 gemini-2.5-flash）就有 credit。

### 2. 設定環境變數

```bash
# Linux / macOS / Git Bash on Windows
export OPENROUTER_API_KEY=sk-or-v1-...

# Windows PowerShell
$env:OPENROUTER_API_KEY="sk-or-v1-..."

# Windows cmd
set OPENROUTER_API_KEY=sk-or-v1-...
```

### 3. 跑 CLI

**Python**：

```bash
python lib/yelp.py "救命水一直進來我媽走不了快點快點"
```

**Node**：

```bash
node lib/yelp.mjs "救命水一直進來我媽走不了快點快點"
```

兩者都會把符合 spec §3 的 JSON 印到 stdout，類似：

```json
{
  "event_id": null,
  "timestamp": null,
  "source_type": "voice_transcript",
  "raw_input": "救命水一直進來我媽走不了快點快點",
  "location": { "lat": null, "lng": null, "raw_text": null },
  "event_type": "flood",
  "hazards": ["rising_water", "blocked_exit"],
  "severity_level": 4,
  "urgency_level": 5,
  "panic_level": 0.92,
  "confidence": 0.82,
  "priority_score": 0.94,
  "reporter_status": "unknown",
  "people": { "count": 2, "vulnerable_flags": { "mobility_issue": true, ... } },
  "needs": ["rescue", "evacuation"],
  "evidence": { ... },
  "missing_information": ["exact_location", "injury_status", "reporter_self_status"],
  "recommended_next_action": "優先確認定位並派送撤離支援"
}
```

---

## Programmatic 用法

### Python

```python
from yelp import analyze_panic_signal

result = analyze_panic_signal(
    raw_input="救命水一直進來我媽走不了快點快點",
    source_type="voice_transcript",
    location={"lat": 23.4012, "lng": 121.3104},
)
print(result["event_type"])      # "flood"
print(result["priority_score"])  # ~0.94
```

### Node.js (ESM)

```js
import { analyzePanicSignal } from "./yelp.mjs";

const result = await analyzePanicSignal({
  rawInput: "救命水一直進來我媽走不了快點快點",
  sourceType: "voice_transcript",
  location: { lat: 23.4012, lng: 121.3104 },
});
console.log(result.event_type);     // "flood"
console.log(result.priority_score); // ~0.94
```

---

## API 契約

| 參數 | 型別 | 必要 | 預設 | 說明 |
|---|---|---|---|---|
| `raw_input` / `rawInput`     | string | ✓ | — | 受災者原文 / 語音轉錄 |
| `source_type` / `sourceType` | enum | | `"voice_transcript"` | 5 種來源類型 |
| `event_id` / `eventId`       | string \| null | | `null` | 事件識別碼 |
| `location`                   | dict / object \| null | | `null` | `{lat, lng, raw_text}` |
| `api_key` / `apiKey`         | string | | env `OPENROUTER_API_KEY` | OpenRouter key |
| `model`                      | string | | `"google/gemini-2.5-flash"` | 任何 OpenRouter 模型 |
| `timeout` (Python only)      | float | | `30.0` | HTTP 逾時秒數 |
| `signal` (Node only)         | AbortSignal | | — | 取消用 |

**回傳值**：完整對應 [../yelp-agent-spec.md](../yelp-agent-spec.md) §3 的 dict / object。

**錯誤**：兩邊都拋 `YelpAgentError`。HTTP 失敗時 `.status` 帶 status code。

---

## 失敗模式 (failure modes)

| 症狀 | 原因 | 解法 |
|---|---|---|
| `missing API key` | 沒設 env var | `export OPENROUTER_API_KEY=...` |
| `HTTP 401: User not found` | key 無效或被 revoke | 到 openrouter.ai 重新生 key |
| `HTTP 402: ...` | OpenRouter credit 不足 | 到 openrouter.ai 加值 |
| `HTTP 429: rate limit` | 短時間打太多次 | 稍等 / 換 model |
| `response is not valid JSON` | 模型沒守 json_object 模式 | 重試 / 換更穩的 model |
| `network error` | 離線 / DNS / 防火牆 | 檢查連線 |
| Python 中文亂碼 | Windows cmd 預設不是 UTF-8 | 先跑 `chcp 65001` 或用 PowerShell |

---

## 自我測試 (self-test)

### Smoke test 1 — Mock 模式（不需 API key）

無需 OpenRouter，純粹驗證 library 載得到、I/O 正常：

```bash
# Python
YELP_MOCK=1 python lib/yelp.py "救命水一直進來"

# Node
YELP_MOCK=1 node lib/yelp.mjs "救命水一直進來"
```

**預期**：印出 mock fixture，`raw_input` 欄位等於你輸入的字串，其餘欄位是 canonical 範例值。
這個測試不會打 OpenRouter，**現場斷網也能跑**。

### Smoke test 2 — 假 key（驗證錯誤路徑）

```bash
OPENROUTER_API_KEY=sk-or-v1-fake python lib/yelp.py "test"
```

**預期**：stderr 印 `yelp error: HTTP 401: User not found`，exit code 1。
這個測試會打 OpenRouter 一次，但 401 不會扣 credit。

### Smoke test 3 — 真實呼叫

```bash
export OPENROUTER_API_KEY=sk-or-v1-...your real key...
python lib/yelp.py "救命水一直進來我媽走不了快點快點"
```

**預期**：5–10 秒內回傳完整 JSON，至少這些欄位要對：

- `event_type` == `"flood"`
- `hazards` 至少含 `"rising_water"`
- `panic_level` ≥ 0.7
- `people.vulnerable_flags.mobility_issue` == `true`
- `raw_input` 完全等於你輸入的字串（spec rule 7 強制）

如果這四項都對 → library 工作正常。

### Smoke test 4 — 跨 library 等價性

同樣的 input、同樣的 key，跑 Python 跟 Node：

```bash
python lib/yelp.py "救命水一直進來" > /tmp/a.json
node   lib/yelp.mjs "救命水一直進來" > /tmp/b.json
diff <(jq -S . /tmp/a.json) <(jq -S . /tmp/b.json)
```

模型輸出本來就有隨機性（不會 byte-identical），但結構性欄位（`event_type`, `hazards`, `needs`, `people.vulnerable_flags.mobility_issue`）應該一致。

---

## 為什麼是 Library 而不是 API Service

| | Library（這個版本） | API Service（v2 路徑） |
|---|---|---|
| 比喻 | 工具箱 | 工具店 |
| 使用 | `import yelp; yelp.analyze(...)` | `POST https://yelp.example.com/analyze` |
| 部署 | 別人的程式裡 | 我的 server |
| 適合 | 積木、SDK、AI agent 模組 | 平台、線上服務 |

詳細理由見 [../yelp-mvp.md](../yelp-mvp.md) §2。

簡言之：Library 形態讓 yelp 可以被 LINE bot / GIS / 避難所平台 / 消防 dashboard / MCP server 任意嵌入，這比較符合競賽「積木」精神。

---

## 升級為 API Service（v2，賽後）

把 `analyze_panic_signal` 包一層 HTTP 即可：

```python
# Flask 範例
from flask import Flask, request, jsonify
from yelp import analyze_panic_signal, YelpAgentError

app = Flask(__name__)

@app.post("/analyze")
def analyze():
    body = request.get_json()
    try:
        result = analyze_panic_signal(
            raw_input=body["raw_input"],
            source_type=body.get("source_type", "voice_transcript"),
            location=body.get("location"),
        )
        return jsonify(result)
    except YelpAgentError as e:
        return jsonify({"error": str(e)}), getattr(e, "status", None) or 500
```

Library 永遠不會白做 —— v2 API 還是呼叫同一支函式。

---

## 內部對齊提醒

`SYSTEM_PROMPT` 字串在三個地方各有一份：

- `/yelp-agent.js`（瀏覽器版）
- `/lib/yelp.py`（這裡）
- `/lib/yelp.mjs`（這裡）

修改 prompt 時請**三個地方同步改**。第二版會抽到單一 `prompt.txt`。
