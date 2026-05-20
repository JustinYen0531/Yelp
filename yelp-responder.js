// yelp-responder.jsx — responder/operator desktop console.
// Wraps the (read-only) victim iPhone with an OS-style multi-panel UI.

// ─────────────────────────────────────────────────────────────
// Window chrome (atoms)
// ─────────────────────────────────────────────────────────────
function OSWindow({ title, sub, icon, accent = "#4a7c9c", footer, children, style, bodyStyle }) {
  return (
    <div className="os-win" style={{ ...style }}>
      <div className="os-win-title" style={{ borderTopColor: accent }}>
        <div className="os-win-lights">
          <span className="os-light close" />
          <span className="os-light min" />
          <span className="os-light max" />
        </div>
        <div className="os-win-titletext">
          {icon && <span className="os-win-icon" style={{ background: accent }}>{icon}</span>}
          <span className="os-win-name">{title}</span>
          {sub && <span className="os-win-sub">— {sub}</span>}
        </div>
        <div className="os-win-rightbtns">
          <button className="os-win-btn" tabIndex={-1}>⟳</button>
          <button className="os-win-btn" tabIndex={-1}>⋯</button>
        </div>
      </div>
      <div className="os-win-body" style={bodyStyle}>{children}</div>
      {footer && <div className="os-win-status">{footer}</div>}
    </div>
  );
}

function OSPanelTab({ active, onClick, children, badge }) {
  return (
    <button onClick={onClick} className={"os-tab" + (active ? " active" : "")}>
      {children}
      {badge && <span className="os-badge">{badge}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Top menu bar
// ─────────────────────────────────────────────────────────────
function OSMenuBar({ ctx }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toTimeString().slice(0, 5);
  return (
    <div className="os-menubar">
      <div className="os-menubar-left">
        <span className="os-menubar-app">YELP OPS CONSOLE</span>
        <span className="os-menubar-sep">|</span>
        {["檔案","事件","派遣","檢視","工具","說明"].map((m) => (
          <button key={m} className="os-menubar-item" tabIndex={-1}>{m}</button>
        ))}
      </div>
      <div className="os-menubar-right">
        <span className="os-menubar-stat">
          <span className="os-dot ok" /> 後端連線正常
        </span>
        <span className="os-menubar-stat">op-id: <b>R-12</b></span>
        <span className="os-menubar-stat">{ctx.dateStr}</span>
        <span className="os-menubar-stat clock">{time}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LEFT: incoming event queue
// ─────────────────────────────────────────────────────────────
function WinEventQueue({ ctx }) {
  // mock a small queue, with the live event highlighted
  const events = [
    { id: "evt_06420f", type: "flood",        sev: 4, time: "06:42:11", note: "現場 · 行動不便", live: true },
    { id: "evt_06419b", type: "trapped",      sev: 3, time: "06:39:54", note: "車內 · 已派遣",   ack: true },
    { id: "evt_06418a", type: "injury",       sev: 2, time: "06:36:22", note: "輕傷 · 已結案",   closed: true },
    { id: "evt_06417c", type: "missing",      sev: 3, time: "06:31:07", note: "失聯 · 追蹤中",   ack: true },
    { id: "evt_06416e", type: "structural",   sev: 5, time: "06:24:48", note: "倒塌 · 已結案",   closed: true },
  ];
  return (
    <OSWindow
      title="incoming.queue"
      sub="事件佇列"
      icon="◰"
      accent="#c8332c"
      footer={<><span>5 件 · 1 進行中 · 2 已結案</span><span className="os-mono">refresh 2s</span></>}
    >
      <div className="os-queue">
        {events.map((e) => (
          <div key={e.id} className={"os-queue-row" + (e.live ? " live" : "") + (e.closed ? " closed" : "")}>
            <div className="os-queue-sev" data-sev={e.sev}>{e.sev}</div>
            <div className="os-queue-main">
              <div className="os-queue-top">
                <span className="os-mono os-queue-id">{e.id}</span>
                {e.live && <span className="os-pill live">LIVE</span>}
                {e.ack && <span className="os-pill ack">ACK</span>}
                {e.closed && <span className="os-pill closed">CLOSED</span>}
              </div>
              <div className="os-queue-type">{e.type}</div>
              <div className="os-queue-note">{e.note}</div>
            </div>
            <div className="os-queue-time os-mono">{e.time}</div>
          </div>
        ))}
      </div>
    </OSWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// LEFT-BOTTOM: live comms log
// ─────────────────────────────────────────────────────────────
function WinCommsLog({ phase, agentState }) {
  const rows = [
    { t: "06:38:02", who: "—",          text: "(待命中…)",                       muted: true },
    { t: "06:42:11", who: "evt_06420f", text: "新事件建立 · 自手機 yelp",         pin: "red" },
    { t: "06:42:14", who: "evt_06420f", text: "位置送達 · 23.4012,121.3104",     pin: "blue" },
    { t: "06:42:14", who: "evt_06420f", text: "文字片段：「水一直進來」" },
    { t: "06:42:16", who: "evt_06420f", text: "語音片段：「我爸不能走，拜託快點」" },
    { t: "06:42:18", who: "后端",        text: "後端已讀；判讀 → flood / sev 4",  pin: "yellow" },
  ];

  // Dynamic rows reflecting the real Agent call
  const as = agentState || {};
  if (as.status === "running") {
    rows.push({ t: "06:42:19", who: "agent", text: "OpenRouter 呼叫中…等候回應", pin: "yellow" });
  } else if (as.status === "success") {
    const ms = as.elapsedMs != null ? " · " + (as.elapsedMs / 1000).toFixed(1) + "s" : "";
    rows.push({ t: "06:42:19", who: "agent", text: "200 OK · " + (as.model || "model") + ms, pin: "yellow" });
    rows.push({ t: "06:42:21", who: "dispatch", text: "→ JSON 解析成功，已更新所有檢視" });
  } else if (as.status === "error") {
    rows.push({ t: "06:42:19", who: "agent", text: "✗ " + (as.error || "錯誤"), pin: "red" });
  } else if (as.status === "skipped") {
    rows.push({ t: "06:42:19", who: "agent", text: as.reason === "no-key" ? "略過 · 尚未設定 API key (mock 資料展示中)" : "略過", muted: true });
  } else {
    // idle / waiting — show the original mock dispatch line
    rows.push({ t: "06:42:19", who: "agent",    text: "信心 0.72，已標記需複核" });
    rows.push({ t: "06:42:21", who: "dispatch", text: "→ 推送 rescue_dispatch · medical_support" });
  }
  return (
    <OSWindow
      title="comms.log"
      sub="收訊紀錄"
      icon="≡"
      accent="#b07b1f"
      footer={<><span>tail -f · 即時更新</span><span className="os-mono">phase: {phase}</span></>}
    >
      <div className="os-log">
        <div className="os-log-head">
          <span style={{ flex: "0 0 64px" }}>time</span>
          <span style={{ flex: "0 0 78px" }}>source</span>
          <span style={{ flex: 1 }}>message</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className={"os-log-row" + (r.muted ? " muted" : "")}>
            <span className="os-mono" style={{ flex: "0 0 64px", color: "#8aa0c0" }}>{r.t}</span>
            <span className="os-mono" style={{
              flex: "0 0 78px",
              color: r.pin === "red" ? "#ff7a72" : r.who === "agent" || r.who === "后端" ? "#a8d8b0" : "#cfd2c8",
              fontWeight: 600,
            }}>{r.who}</span>
            <span style={{ flex: 1 }}>{r.text}</span>
            {r.pin && <span className={"os-log-pin " + r.pin} />}
          </div>
        ))}
      </div>
    </OSWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// CENTER: phone live mirror — wraps the (read-only) iPhone
// ─────────────────────────────────────────────────────────────
function WinPhoneMirror({ ctx, phase, children }) {
  // simulated cursor — pure CSS animation so React doesn't re-render every step.
  return (
    <OSWindow
      title="phone-mirror"
      sub={"subject device · " + ctx.eventId}
      icon="▣"
      accent="#4a7c9c"
      style={{ alignSelf: "start" }}
      footer={<>
        <span><span className="os-dot live" /> mirroring · 1080×2400 · 30 fps</span>
        <span className="os-mono">latency 48ms</span>
      </>}
      bodyStyle={{ padding: 0, background: "#0e1316", position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-start" }}
    >
      <div style={{
        padding: "18px 18px 24px",
        position: "relative",
        background:
          "radial-gradient(ellipse at center top, #232a30 0%, #14181c 70%, #0a0d10 100%)",
        width: "100%",
        display: "flex", justifyContent: "center",
      }}>
        {/* phone */}
        <div style={{ position: "relative" }}>
          {children}
          {/* simulated remote cursor — pure CSS drift, no React state */}
          <div className="os-cursor" aria-hidden="true">
            <svg width="22" height="28" viewBox="0 0 22 28">
              <path d="M2 2 L2 22 L7 18 L11 26 L14 24 L10 16 L18 16 Z"
                fill="#fff" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="os-mono os-cursor-tag">R-12</span>
          </div>
        </div>
        {/* corner glyphs — record / signal */}
        <div className="os-mirror-rec">
          <span className="os-rec-dot" /> REC · 06:42:18
        </div>
        <div className="os-mirror-sig">
          ▮▮▮▮▯ · 4G · 75% · GPS LOCK
        </div>
      </div>
    </OSWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT-TOP: dispatch
// ─────────────────────────────────────────────────────────────
function WinDispatch() {
  const rows = [
    { tag: "RESCUE",  color: "#c8332c", title: "派遣救援 R-12",    meta: "rescue_dispatch · sev 4",     state: "ok",   stateLabel: "已派出", note: "座標 23.4012, 121.3104" },
    { tag: "MEDICAL", color: "#1b4a82", title: "準備行動協助",      meta: "medical_support · 行動不便",  state: "sent", stateLabel: "已通知", note: "擔架 / 輪椅" },
    { tag: "MAP",     color: "#b07b1f", title: "淹水熱區標記",      meta: "flood_hotspot_map",           state: "read", stateLabel: "已標記", note: "GIS 已收" },
    { tag: "REVIEW",  color: "#777",    title: "人工複核",          meta: "confidence 0.72",             state: "warn", stateLabel: "待複核", note: "若可，追問是否其他人受困" },
  ];
  const statePill = (s, l) => {
    const c = { ok: "#4caf7e", sent: "#5a9ed4", read: "#b07b1f", warn: "#d99b3b" }[s] || "#888";
    return <span className="os-pill" style={{ background: "transparent", color: c, borderColor: c }}>{l}</span>;
  };
  return (
    <OSWindow
      title="dispatch.board"
      sub="任務分流"
      icon="▤"
      accent="#4a7c45"
      footer={<><span>4 件 · 1 待複核</span><span className="os-mono">auto-sync</span></>}
    >
      <div className="os-tasks">
        {rows.map((r, i) => (
          <div key={i} className="os-task">
            <div className="os-task-flag" style={{ background: r.color }}>
              <span>{r.tag}</span>
            </div>
            <div className="os-task-body">
              <div className="os-task-top">
                <span className="os-task-title">{r.title}</span>
                {statePill(r.state, r.stateLabel)}
              </div>
              <div className="os-mono os-task-meta">{r.meta}</div>
              <div className="os-task-note" style={{ color: r.color }}>{r.note}</div>
            </div>
          </div>
        ))}
      </div>
    </OSWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT-BOTTOM: JSON payload (compact)
// ─────────────────────────────────────────────────────────────
function WinPayload({ jsonStr }) {
  return (
    <OSWindow
      title="exchange.payload"
      sub="application/json"
      icon="{ }"
      accent="#7a5cb8"
      footer={<><span>v1 · sha256 …a3f9</span><span className="os-mono">read-only</span></>}
      bodyStyle={{ padding: 0 }}
    >
      <pre className="os-code">{jsonStr}</pre>
    </OSWindow>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom taskbar
// ─────────────────────────────────────────────────────────────
function OSTaskbar({ phase, reset }) {
  return (
    <div className="os-taskbar">
      <button className="os-tb-start" tabIndex={-1}>
        <span className="os-tb-start-glyph">⏻</span>
        <span>YELP</span>
      </button>
      <div className="os-tb-divider" />
      {[
        { name: "queue",    glyph: "◰", active: false },
        { name: "mirror",   glyph: "▣", active: true  },
        { name: "comms",    glyph: "≡", active: false },
        { name: "dispatch", glyph: "▤", active: false },
        { name: "map",      glyph: "◉", active: false, dim: true },
        { name: "payload",  glyph: "{}",active: false },
      ].map((b) => (
        <button key={b.name} className={"os-tb-app" + (b.active ? " active" : "") + (b.dim ? " dim" : "")} tabIndex={-1}>
          <span className="os-tb-glyph">{b.glyph}</span>
          <span>{b.name}</span>
        </button>
      ))}
      <div className="os-tb-spacer" />
      <button className="os-tb-app" onClick={reset} tabIndex={-1} title="重設情境 (回到 idle)">
        <span className="os-tb-glyph">⟲</span>
        <span>replay</span>
      </button>
      <div className="os-tb-tray">
        <span className="os-tb-tray-item"><span className="os-dot ok" /> sync</span>
        <span className="os-tb-tray-item">phase: <b>{phase}</b></span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating preferences window — tucked into bottom-right corner
// Stores OpenRouter API key + model in localStorage.
// Collapsed by default (just titlebar); click to expand.
// ─────────────────────────────────────────────────────────────
const PREFS_KEYS = { key: "yelp.openrouter.key", model: "yelp.openrouter.model" };
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function PreferencesWindow() {
  const [open, setOpen] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState(DEFAULT_MODEL);
  const [reveal, setReveal] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(0);

  // hydrate from localStorage on mount
  React.useEffect(() => {
    try {
      setApiKey(localStorage.getItem(PREFS_KEYS.key) || "");
      setModel(localStorage.getItem(PREFS_KEYS.model) || DEFAULT_MODEL);
    } catch (e) { /* private mode etc. */ }
  }, []);

  const save = () => {
    try {
      localStorage.setItem(PREFS_KEYS.key, apiKey.trim());
      localStorage.setItem(PREFS_KEYS.model, model.trim() || DEFAULT_MODEL);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(0), 1800);
    } catch (e) { /* ignore */ }
  };
  const clearKey = () => { setApiKey(""); try { localStorage.removeItem(PREFS_KEYS.key); } catch(e){} };

  const hasKey = apiKey.trim().length > 0;
  // mask: show first 7 + last 4 chars, dots in middle (sk-or-v1-…abcd)
  const masked = hasKey && !reveal
    ? apiKey.slice(0, 7) + "…".repeat(8) + apiKey.slice(-4)
    : apiKey;

  return (
    <div className={"os-prefs" + (open ? " open" : "")}>
      {/* titlebar — always visible; click to toggle */}
      <button
        className="os-prefs-bar"
        onClick={() => setOpen(v => { if (v) setReveal(false); return !v; })}
        title={hasKey ? "API key 已設定，點擊開啟設定" : "尚未設定 API key"}
      >
        <span className={"os-prefs-led" + (hasKey ? " on" : "")} />
        <span className="os-mono os-prefs-title">preferences.cfg</span>
        <span className="os-prefs-caret">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="os-prefs-body">
          <div className="os-prefs-row">
            <label className="os-prefs-label">provider</label>
            <input className="os-prefs-input os-mono" value="openrouter" readOnly tabIndex={-1} />
          </div>

          <div className="os-prefs-row">
            <label className="os-prefs-label">model</label>
            <input
              className="os-prefs-input os-mono"
              value={model}
              spellCheck={false}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL}
            />
          </div>

          <div className="os-prefs-row">
            <label className="os-prefs-label">api_key</label>
            <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 0 }}>
              <input
                className="os-prefs-input os-mono"
                type={reveal ? "text" : (hasKey ? "text" : "password")}
                value={reveal ? apiKey : masked}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => { setApiKey(e.target.value); setReveal(true); }}
                onFocus={() => setReveal(true)}
                onBlur={() => setReveal(false)}
                placeholder="sk-or-v1-…"
              />
              {hasKey && (
                <button className="os-prefs-btn small" onClick={clearKey} title="清除已存的 key" tabIndex={-1}>×</button>
              )}
            </div>
          </div>

          <div className="os-prefs-hint">
            僅儲存在這台瀏覽器 (localStorage) · 不會送出任何地方除了 openrouter
          </div>

          <div className="os-prefs-actions">
            <span className="os-prefs-status">
              {savedAt > 0
                ? <span style={{ color: "var(--os-ok)" }}>✓ 已存檔</span>
                : hasKey
                  ? <span style={{ color: "var(--os-text-dim)" }}>● key 已設定</span>
                  : <span style={{ color: "var(--os-warn)" }}>○ key 未設定</span>}
            </span>
            <button className="os-prefs-btn" onClick={save}>save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main console — composes everything
// ─────────────────────────────────────────────────────────────
function ResponderConsole({ ctx, phase, reset, jsonStr, children }) {
  return (
    <div className="os-desktop">
      <OSMenuBar ctx={ctx} />
      <div className="os-grid">
        <div className="os-col-left">
          <WinEventQueue ctx={ctx} />
          <WinCommsLog phase={phase} agentState={ctx && ctx.agentState} />
        </div>
        <div className="os-col-center">
          <WinPhoneMirror ctx={ctx} phase={phase}>{children}</WinPhoneMirror>
        </div>
        <div className="os-col-right">
          <WinDispatch />
          <WinPayload jsonStr={jsonStr} />
        </div>
      </div>
      <PreferencesWindow />
      <OSTaskbar phase={phase} reset={reset} />
    </div>
  );
}

Object.assign(window, { ResponderConsole });
