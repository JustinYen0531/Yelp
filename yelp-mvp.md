# Yelp MVP 規格

> **小而硬。**
> 第一版要能被別的系統接住，而不是看起來很豐富。

---

## 0. 文件位置

| 文件 | 角色 |
|---|---|
| [yelp-positioning.md](yelp-positioning.md) | 為什麼存在（哲學 / 定位 / 跟 119 的關係） |
| [yelp-spec.md](yelp-spec.md) | 整體技術規格（問題分析、解決方案、可行性） |
| [yelp-agent-spec.md](yelp-agent-spec.md) | AI Agent 輸出 JSON 規範 |
| [yelp-ux-spec.md](yelp-ux-spec.md) | UX 規格 |
| **yelp-mvp.md（本文件）** | **第一版必須交付什麼、怎麼算做完** |

---

## 1. MVP 判準（3 條）

每個候選功能用以下三題篩過：

1. **它是不是支撐 `yelp-positioning.md` 核心論點？**（不是 → OUT）
2. **它是不是「至少一項可驗證之核心功能」的一部分？**（競賽簡章原文，是 → MUST）
3. **沒有它，現場 demo 會不會講不通？**（會 → MUST；少了花絮 → SHOULD；無感 → OUT）

第三條最容易自我欺騙。「加上會比較炫」不等於「沒有就講不通」。

---

## 2. 元件實作型態：**Library / Package 型**

### 2.1 為什麼選 Library

| | **Library（函式庫）** | **API Service（線上服務）** |
|---|---|---|
| **比喻** | 工具箱 | 工具店 |
| **使用方式** | `from yelp import analyze_panic_signal` | `POST /analyze` |
| **執行位置** | 別人的程式裡 | 你架的 server 上 |
| **誰部署** | 別人 | 你 |
| **依賴** | 一段程式 + AI key | server + DNS + 部署管線 |
| **適合場景** | 積木、SDK、parser、AI agent 模組 | 平台、線上服務 |

Yelp 的核心是 **「panic → structured JSON」的語意轉換**。
這個本質更像 parser / agent component / semantic module，
而不是平台。所以走 Library。

### 2.2 為什麼 Library 更符合「積木」哲學

Library 形態讓 yelp 可以被插進任何下游系統：

- 消防 dashboard 內嵌呼叫
- LINE bot 後端模組
- 避難所平台
- GIS 系統
- AI Agent 工具鏈
- 其他公民科技團隊的成果

每個下游系統都自帶執行環境與部署機制，yelp 只負責**核心邏輯 + AI parser + schema**。
這比起架一個中央 API service，更符合競賽「可堆疊、可組合、可傳承」的積木精神。

### 2.3 升級路徑

```
v1（MVP）            v2（賽後）
─────────            ──────────
Library              API Service
analyze(text)   ─→   POST /analyze
                     + OpenAPI / Swagger
                     + 雲端部署
                     + Auth
```

v1 完成後，把同樣的核心函式包一層 HTTP 即可變成 v2 API。
Library 永遠不會白做。

---

## 3. 核心 UX 原則

從一連串討論結晶出五條，所有 victim-side UI 都要服從。
這幾條合在一起，定義了 yelp 跟「普通災情通報 app」的根本差別。

### 3.0 總綱

> **系統應該努力理解人類，而不是要求人類理解系統。**

這句是 victim-side 所有設計決策的最後仲裁。

### 3.1 前台安心透明、後台機器可讀

| 前台（victim 看的） | 後台（responder / 下游系統看的） |
|---|---|
| 簡潔、安心、透明 | 複雜、欄位化、可分析 |
| 操作步驟極少 | 結構化 JSON |
| 看得到「我有被接住」 | 看得到所有欄位、信心、依據 |
| 不暴露 API key、schema、debug log | 完整 schema + evidence + missing_information |

### 3.2 低操作 ≠ 低透明

很多防災系統會犯一個錯：為了簡化，結果使用者完全不知道發生什麼事 ── 按一下、畫面轉圈圈、就沒了。
在 panic 狀態下，這比繁瑣的表格更可怕。

yelp 走的不是 dashboard，而是：

> **「事件生命週期 UI」 ── 像訊息串一樣慢慢往下長，
> 一步一步告訴使用者「我有被接住」。**

> yelp 不是 dashboard 型產品，
> 它是「災難中的陪伴型訊號系統」。

核心引述：

> **yelp 不要求受害者操作系統，
> 但必須讓使用者知道每一步是否成功，
> 避免求救變成「把訊息丟進黑盒子」。**

受災者主畫面**至少**要按順序展現這六個生命週期狀態：

```
[1] 已收到你的訊號
       ↓
[2] 已取得位置
       ↓
[3] 正在理解現場狀況
       ↓
[4] 已建立求救事件
       ↓
[5] 已送出
       ↓
[6] 等待救援單位接收
```

關鍵：**像訊息串往下長，不要像 progress bar 從左到右**。
panic 狀態下「事情正在發生」比「進度幾 %」更安心。

### 3.3 三層回饋優先序

| 層級 | 元素 | 重要性 | 範例 |
|---|---|---|---|
| **主回饋** | **語音 (Speech Synthesis)** | **核心 / MUST** | 「已收到你的訊號。」「正在傳送位置。」「已建立災情事件。」 |
| **次回饋** | **Timeline 主頁**（事件生命週期 UI） | **核心 / MUST** | 上方六步驟逐步推進 |
| **輔助** | 小紅點 / toast | 可選 / SHOULD | 次要更新、非核心事件 |

語音為什麼是 yelp 的靈魂之一：

panic 狀態下，使用者**不一定看得到、不一定看得懂、不一定有注意力**。
但聲音是直接的 ── 它帶來「被接住感、陪伴感、活著感」，而且**不需要視覺注意力**。

**至少三取二，且語音必選。** 視覺 timeline 與小提示可擇一，但語音不可省略。

### 3.4 不要用工程語言

人在 panic 狀態下，看到「JSON created」會懷疑系統壞了。
所有 victim-side 文字必須改寫成**人話**。

| ✗ 工程語言（禁用） | ✓ 人話（必用） |
|---|---|
| JSON created | 我們已收到你的訊號 |
| panic level analyzed | 正在理解現場狀況 |
| API connected | 與救援系統已連線 |
| GPS coordinates dispatched | 位置已傳送 |
| Schema validated | 已整理好你的求救內容 |
| confidence: 0.72 | （完全不顯示） |

判準：**講給家裡長輩聽，他能不能聽得懂？**
聽得懂 → 留；聽不懂 → 改。

### 3.5 不要讓受災者看到這些

| 類別 | 範例 |
|---|---|
| 技術設定 | API key、模型名稱、endpoint |
| 結構細節 | JSON schema、欄位定義 |
| AI 判讀內部值 | confidence、panic_level 數值、evidence 內文 |
| 偵錯訊息 | debug log、HTTP status、stack trace |
| 操作門檻 | 任何「需要設定才能用」的按鈕 |

這些都應該**只在 responder console 出現**。

---

## 4. MUST — 必要交付物

沒有它，MVP 不成立。

| # | 項目 | 對應原則 | 目前狀態 |
|---|---|---|---|
| **M1** | 可運行 demo：受災者按 SOS → 取得結構化 JSON | 簡章「可驗證之核心功能」 | ✓ 已實作 |
| **M2** | 完整 JSON Schema + 規範文件 | 積木賽核心契約 | ✓ yelp-agent-spec.md §3 |
| **M3** | 真實 AI 呼叫（OpenRouter / Gemini 2.5 Flash） | positioning 講「AI 前處理」 | ✓ 已實作 |
| **M4** | 三份核心文件（positioning / spec / agent-spec） | 評審理解入口 | ✓ 完成 |
| **M5** | 可重現的 canonical 範例（救命水一直進來那一句） | demo 必須能 5 分鐘走完 | ✓ 已內建 |
| **M6** | JSON 的人類可讀視覺化（至少一種） | 純 JSON 無說服力 | ✓ 三種版本（簡約／折衷／RAW） |
| **M7** | Mock fallback（無 key / 斷網時不崩潰） | demo 現場安全網 | ✓ 已實作 |
| **M8** | **Library 元件契約文件 + client sample code**（升級自舊 S6） | 簡章對元件型態的硬性要求；Library 形態的「使用說明」 | ✓ 已實作（`lib/yelp.py` + `lib/yelp.mjs` + `lib/README.md`） |
| **M9a** | **事件生命週期 UI**（六步驟 timeline，受災者主頁） | §3.2 + §3.4 | ✓ 已實作（Lifecycle 元件 · 六步驟逐一展開 · 文字全人話 · 最後一步保持等待狀態） |
| **M9b** | **語音回饋**（Speech Synthesis 朗讀各階段） | §3.3 「語音為 yelp 靈魂之一」 | ✗ 未實作 |

### M8 實作

兩個等效 library，無外部依賴：

- [`lib/yelp.py`](lib/yelp.py) — Python 3.7+，stdlib only（urllib + json）
- [`lib/yelp.mjs`](lib/yelp.mjs) — Node.js 18+，用 native fetch、無 npm 依賴
- [`lib/README.md`](lib/README.md) — 使用文件 + 失敗模式 + 自我測試指引

兩邊都支援 **CLI** 與 **programmatic** 兩種用法，並都內建 `YELP_MOCK=1` 模式（不打 API，回傳 canonical fixture，方便下游開發者測試）。

Python 範例：

```python
from yelp import analyze_panic_signal

result = analyze_panic_signal(
    raw_input="救命水一直進來我媽走不了快點快點",
    source_type="voice_transcript",
    location={"lat": 23.4012, "lng": 121.3104},
)
print(result["event_type"])     # "flood"
print(result["priority_score"]) # ~0.94
```

Node 範例：

```js
import { analyzePanicSignal } from "./yelp.mjs";

const result = await analyzePanicSignal({
  rawInput: "救命水一直進來我媽走不了快點快點",
  sourceType: "voice_transcript",
});
console.log(result.event_type);     // "flood"
console.log(result.priority_score); // ~0.94
```

詳細自我測試流程（mock / bad-key / 真實呼叫 / 跨 library 等價性）見 [lib/README.md](lib/README.md)。

### M9a 補完項（事件生命週期 UI）

受災者主畫面 SOS 按下後，必須依序展開 §3.2 那六個生命週期狀態。

設計要點：

- **像訊息串往下長，不要像 progress bar**。Panic 狀態下「事情正在發生」比「進度幾 %」更安心。
- 文字**全用人話**，禁用工程語言（見 §3.4 對照表）。
- 每個狀態對應一個明確事件：
  - 已收到你的訊號 ← SOS 按下瞬間
  - 已取得位置 ← GPS（或 GPS unavailable 的對應人話）
  - 正在理解現場狀況 ← Agent runAgent() 開始
  - 已建立求救事件 ← Agent 成功回傳
  - 已送出 ← 假設下游（mock or real）接收成功
  - 等待救援單位接收 ← 持續顯示直到 reset
- 視覺要像勾選清單／訊息串，**不是 debug log**。
- 不顯示任何技術細節（model 名稱、elapsed ms、confidence）。

### M9b 補完項（語音回饋）

每個生命週期狀態觸發時，**並行用瀏覽器 SpeechSynthesis API 朗讀**。

設計要點：

- 中文 zh-TW 語音
- 短句、語調平靜（rate 略慢、不要尖銳）
- 範例：
  - 「已收到你的訊號。」
  - 「位置已傳送。」
  - 「正在理解現場狀況。」
  - 「已建立求救事件。」
  - 「已送出。」
  - 「正在等待救援單位接收。」
- 提供使用者**靜音切換**（小喇叭 icon），但**預設開啟**。
- 不要播放錯誤 / 警告音 ── panic 狀態下任何 alert 音都會讓人更焦慮。
- 跳過已播過的訊息（不要每次重 render 都重唸）。

「至少三取二，且語音必選」── 語音是 yelp 的靈魂之一，不可省略。

---

## 5. SHOULD — 強化項

加強 demo，但拿掉不傷論點。優先序由高到低：

| # | 項目 | 為什麼 SHOULD 而非 MUST | 目前狀態 |
|---|---|---|---|
| S1 | 救援者 OS Console | 展示「可交換」的下游接收者 | ✓ 已實作 |
| S2 | Preferences 視窗（API key 設定） | 讓現場可換 key 重跑；demo 也可預先 hardcode | ✓ 已實作 |
| S3 | 群體層的 mock 視覺化（5 件 LIVE 事件中只 1 件通到 119） | 強化 collective sensing 論點 | ✗ 未實作 |
| S4 | UI 微調 — SOS 下加 slogan「不會只是按鈕，會撥 119 同時留下危機訊號」 | 第一眼建立 positioning 印象 | ✗ 未實作 |
| S5 | 主畫面 footer 印章 slogan「當你無法完整求救時，我們仍努力理解」 | 強化品牌一致性 | ✗ 未實作 |

---

## 6. OUT — 不在 MVP

明確排除，避免 scope creep。每項都是未來版本的合理擴充。

| # | 項目 | 為什麼 OUT |
|---|---|---|
| X1 | 真正的多用戶 → 群體聚合（後端 / DB / 即時同步） | 工程量超 MVP 一個數量級 |
| X2 | 真正的地圖熱區（Leaflet / Mapbox + 多事件 GIS） | 同上 |
| X3 | 真正的 Whisper / Gemini audio 整合 | 目前 `raw_input` 假設已轉錄；錄音→STT 是另一條長線 |
| X4 | 真正的 `tel:119` 撥號整合 | 瀏覽器 demo 無電話模組 |
| X5 | 手勢輸入、積木式回報 UI | spec §4.2 已明寫「暫緩到第二階段」 |
| X6 | API Service 版本（OpenAPI / Swagger） | v2，需 server 部署 |
| X7 | MCP server 包裝 | v2，同上 |
| X8 | 後端持久化、稽核軌跡 | 真實 deployment 需要，MVP demo 不需要 |
| X9 | 多語言介面 | 一個 demo 用得到的語言（中文）就好 |

---

## 7. 對競賽簡章 checklist

| 簡章條文 | MVP 對應 | 狀態 |
|---|---|---|
| 至少一項可驗證之核心功能 | M1（混亂語句 → JSON） | ✓ |
| 可操作 demo / mock API / 模擬資料流程 | M1 + M7 | ✓ |
| 說明輸入、處理邏輯、輸出結果 | M2 + M4 | ✓ |
| client sample code | M8 | ◐ 待補 |
| 元件實作型態明確 | **Library / Package 型**（§2） | ✓ 已選定 |
| 若 API 型 → OpenAPI Swagger | 不適用（選 Library） | — |
| 對應 2025/09 馬太鞍溪堰塞湖情境 | positioning §8 + canonical 範例 | ✓ |

---

## 8. Demo 流程腳本（5 分鐘版）

| 段 | 時間 | 內容 | 對應 MUST |
|---|---|---|---|
| 開場 | 0:00–0:30 | 「想像 2025/09 馬太鞍堰塞湖溢流當天，有人被困、有人聽障、有人小孩、有人快沒電 ── 119 接得到幾通？」 | positioning |
| 受災者視角 | 0:30–2:00 | 切到 victim 手機 → 按 SOS → **語音逐句朗讀「已收到你的訊號…」** → 六步驟 timeline 依序展開 → JSON 在背景生成 | M1 + M9a + M9b |
| JSON 可讀化 | 2:00–3:00 | 開通報單 → 切三種版本：簡約勾選表 / 折衷 markdown / 原始 JSON | M6 |
| 救援者視角 | 3:00–4:00 | 切到 responder console → 看 incoming queue / comms log / dispatch / 真實 AI 解析的 payload | S1 |
| 積木展示 | 4:00–4:30 | 「這份 JSON 任何下游元件都能接」→ 示範 client sample code 一行呼叫 | M8 |
| 收尾 | 4:30–5:00 | 「119 處理會講話的人，yelp 處理講不清楚的人。兩者互補。」+ collective sensing 願景 | positioning |

---

## 9. Acceptance Criteria（怎麼算「做完」）

MVP 算完成當且僅當以下全部成立：

### 9.1 功能面

- [ ] M1：受災者按 SOS 後，**5 秒內**看到第一個 ✓ 狀態，**10 秒內**看到 JSON 結果
- [ ] M3：真實 OpenRouter 呼叫成功率 ≥ 90%（網路正常時）
- [ ] M7：無 key 時，**整個 demo 仍能跑完**，僅顯示「MOCK」badge
- [ ] M8：有一段 ≤ 10 行的 client sample code，從零開始能跑出 canonical JSON
- [ ] M9a：六步驟 timeline 按順序展開，無跳號、文字全為人話、無工程術語
- [ ] M9b：每個生命週期狀態都伴隨**語音朗讀**（zh-TW、平靜語調、預設開啟、可靜音）

### 9.2 文件面

- [ ] positioning / spec / agent-spec / mvp 四份文件互相超連結
- [ ] 任何一份文件第一段就能讓讀者知道專案在做什麼
- [ ] yelp-agent-spec.md §3 schema 與實際 JSON 輸出**欄位完全一致**

### 9.3 Demo 面

- [ ] 5 分鐘 demo 腳本（§8）可走完不卡
- [ ] 現場斷網時，能切到 MOCK 模式繼續演示
- [ ] 評審能在 30 秒內回答「yelp 跟 119 差在哪」

### 9.4 品質面

- [ ] 主要 view 切換不會出現 React 警告或 console error
- [ ] 受災者 UI 不暴露任何技術細節（API key、schema、debug log、confidence 數值、model 名稱）
- [ ] 受災者 UI 文字通過「家裡長輩聽得懂嗎？」測試
- [ ] 救援者 UI 預設讓使用者**看得懂自己在看什麼**（不要全是英文 code-name）

---

## 10. 不在 MVP 的「下一階段優先序」

如果 MVP 順利完成且還有時間，按以下順序往下做：

1. **S3 群體層 mock 視覺化** ← 最能拉開跟一般 app 的差距
2. **X4 `tel:119` 真實撥號**（一行 JS 就能加）← 印證 positioning §6 並行動作設計
3. **S4 / S5 UI slogan** ← 強化品牌一致性
4. **X3 Whisper STT 整合**（瀏覽器 SpeechRecognition API）← 讓 raw_input 真的來自語音
5. **X6 / X7 API Service / MCP server 包裝** ← 真實積木供應鏈

不要在 MVP 階段去做這些。等核心穩定再說。

---

## 結語

> 第一版要「小而硬」。
> 寧可少做、但每樣都能被其他系統接住，
> 也不要多做、但全部都長得像 PowerPoint。

MVP 完成日的判準不是「功能很多」，而是：

**有沒有一份 JSON，
是被真實 AI 解析出來的、
是符合 spec schema 的、
是可以被別人的程式接走的、
而且受災者按一下就能產生的。**

如果這四項都成立，MVP 就完成了。
