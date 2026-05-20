# Yelp AI Agent 輸出規範

> yelp 的 AI Agent 不要求人類冷靜，而是把不冷靜本身也視為一種可分析的訊號。

---

## 1. 目的

本文件規範 yelp 災情語意解析 Agent 的行為與輸出格式。

Agent 的角色是 **「恐慌訊息 → 災情 JSON」的嚴格轉譯器**，不是聊天機器人。
最重要原則：**AI 不安慰、不評論、不腦補過頭，只做「可交換災情情報抽取」。**

---

## 2. System Prompt

```text
你是 yelp 災情語意解析 Agent。
你的任務是將使用者在緊急情境下輸入的混亂文字、語音轉錄或手勢線索，
轉換為標準化 JSON 災情情報。

請遵守：
1. 只輸出 JSON，不輸出解釋文字。
2. 不確定的欄位填 null。
3. 不得編造地點、人數、災情類型。
4. 可根據語氣與字詞推估 panic_level、urgency_level、confidence、priority_score。
5. 若訊息包含行動不便、老人、小孩、受困、受傷，需標記 vulnerable_flags。
6. 每個推論欄位都要附上 evidence_text。
7. 必須完整保留原始輸入於 raw_input 欄位，不得改寫、修飾或標點化。
8. 必須標註資料來源類型 source_type (text / voice_transcript / gesture / location_button / block_report)。
```

---

## 3. 輸出 JSON Schema

```json
{
  "event_id": "string or null",
  "timestamp": "ISO-8601 or null",
  "source_type": "text | voice_transcript | gesture | location_button | block_report",
  "raw_input": "string or null",
  "location": {
    "lat": "number or null",
    "lng": "number or null",
    "raw_text": "string or null"
  },
  "event_type": "earthquake | flood | landslide | fire | medical | trapped | infrastructure_damage | unknown",
  "hazards": ["string"],
  "severity_level": "1-5 or null",
  "urgency_level": "1-5 or null",
  "panic_level": "0.0-1.0",
  "confidence": "0.0-1.0",
  "priority_score": "0.0-1.0",
  "reporter_status": "safe | trapped | injured | unknown",
  "people": {
    "count": "number or null",
    "vulnerable_flags": {
      "elderly": "boolean",
      "child": "boolean",
      "mobility_issue": "boolean",
      "injured": "boolean",
      "alone": "boolean"
    }
  },
  "needs": [
    "evacuation",
    "medical",
    "rescue",
    "food_water",
    "shelter",
    "information",
    "unknown"
  ],
  "evidence": {
    "event_type": "string",
    "severity_level": "string",
    "panic_level": "string",
    "needs": "string"
  },
  "missing_information": ["string"],
  "recommended_next_action": "string"
}
```

### 3.1 hazards 詞彙建議集

`hazards` 為開放詞彙陣列，但第一版建議用以下標準字串以利後續系統對接：

- `rising_water` — 水位上升
- `blocked_exit` — 出口受阻
- `power_outage` — 停電
- `road_damage` — 道路毀損
- `structural_collapse` — 建物倒塌
- `gas_leak` — 瓦斯外洩
- `landslide_debris` — 土石流堆積物

---

## 4. 範例

**輸入：**

```
救命水一直進來我媽走不了快點快點
```

**輸出：**

```json
{
  "event_id": null,
  "timestamp": null,
  "source_type": "voice_transcript",
  "raw_input": "救命水一直進來我媽走不了快點快點",
  "location": {
    "lat": null,
    "lng": null,
    "raw_text": null
  },
  "event_type": "flood",
  "hazards": ["rising_water", "blocked_exit"],
  "severity_level": 4,
  "urgency_level": 5,
  "panic_level": 0.92,
  "confidence": 0.82,
  "priority_score": 0.94,
  "reporter_status": "unknown",
  "people": {
    "count": 2,
    "vulnerable_flags": {
      "elderly": false,
      "child": false,
      "mobility_issue": true,
      "injured": false,
      "alone": false
    }
  },
  "needs": ["rescue", "evacuation"],
  "evidence": {
    "event_type": "水一直進來",
    "severity_level": "水一直進來、快點快點",
    "panic_level": "救命、快點快點、語句急促",
    "needs": "我媽走不了"
  },
  "missing_information": ["exact_location", "injury_status", "reporter_self_status"],
  "recommended_next_action": "優先確認定位並派送撤離支援"
}
```

---

## 5. 為什麼要 `source_type` 與 `raw_input`

這兩個是讓 yelp 從「AI 分類器」變成「可交換災情情報積木」的關鍵欄位。

### 5.1 `source_type`

yelp 有多種輸入來源：手勢、語音、鍵盤、積木、定位按鈕。
交換時，**別的系統要知道這筆資料是怎麼來的** —— 因為不同來源代表不同的可信度、不同的後處理方式、不同的人類狀態：

- `voice_transcript` 來的，可能本身就帶有恐慌語氣訊號
- `gesture` 來的，代表使用者無法說話或打字（極端情況）
- `location_button` 來的，代表使用者只剩力氣按一次（最低能量輸入）
- `block_report` 來的，代表使用者相對冷靜、用積木 UI 拼出來的

### 5.2 `raw_input`

**一定要保留原始訊息。**
AI 解析可能錯，但原始語句可以讓人類或後續模型重新判讀。

這是 yelp 的「不可變底層」—— AI 抽取的所有欄位都可能在新模型出來後被重新計算，但 `raw_input` 是受災者實際說過/打過/錄下的真實語料，永遠不該被覆寫。

---

## 6. 為什麼要 `evidence` 欄位

我會特別加一個 `evidence` 欄位。這很重要，因為**防災不能只是 AI 說「我覺得」**。它要能說：

- 我為什麼判斷這是水災？
- 我為什麼判斷需要撤離？
- 我為什麼判斷恐慌程度高？

這會讓 yelp 比一般 AI 分類器更可信。

---

## 7. 三段式 Agent 架構

技術上可以做成三段 Agent：

1. **Extractor** — 抽取災情、地點、人、需求
2. **Risk Scorer** — 評估嚴重度、急迫度、恐慌程度、優先分數
3. **JSON Validator** — 檢查格式、補 null、防止亂輸出、確認 `raw_input` 未被改動

---

## 8. 第一版原則：小而硬

> 別再加太多欄位了。第一版要「小而硬」，才像真正能被其他系統接的積木。

新增欄位的判準：

- 是不是有**別的系統會用**？（不是只給人看好看）
- 是不是**沒辦法從現有欄位推出**？（不是冗餘）
- 是不是會讓**Agent 更容易說錯話**？（會的話先不加）

若三個答案不是「是/是/否」，就先放進 backlog，等真的有第二個系統來接 yelp 時再開。

---

## 9. 設計哲學

> yelp 的 AI Agent 不要求人類冷靜，而是把不冷靜本身也視為一種可分析的訊號。
