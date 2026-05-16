// yelp-app.jsx — main app: state + tweaks + frame

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "paper_intensity": 0.55,
  "auto_open_board": true,
  "skip_intro": false,
  "show_operator_pane": false,
  "low_load": false,
  "accent": "#c8332c"
}/*EDITMODE-END*/;

const JSON_BLOB = `{
  "event_id": "evt_06420f",
  "event_type": "flood",
  "severity": 4,
  "panic_level": 0.86,
  "confidence": 0.72,
  "location": {
    "lat": 23.4012,
    "lng": 121.3104,
    "accuracy_m": 18,
    "note": "low-lying riverside"
  },
  "signals": {
    "voice": true,
    "voice_features": {
      "rate_increase": true,
      "tremor": true,
      "repetition": 3
    },
    "text": true,
    "gesture": false
  },
  "needs": ["rescue", "mobility_assistance"],
  "vulnerability_flags": ["mobility_impaired"],
  "exchange_targets": [
    "rescue_dispatch",
    "medical_support",
    "shelter_accessibility",
    "flood_hotspot_map"
  ],
  "recommended_actions": [
    "dispatch_rescue_team",
    "prepare_mobility_assistance",
    "mark_as_high_priority"
  ],
  "source_evidence": [
    "speaker repeatedly mentioned water entering the room",
    "speech rate increased, pauses shortened",
    "mention of family member who cannot walk"
  ],
  "raw_input_ref": "raw://evt_06420f/audio_01.wav",
  "status": {
    "created": true,
    "sent": true,
    "read": true,
    "review_required": true
  }
}`;

function YelpApp() {
  const [t, setTweak] = useTweaks(DEFAULT_TWEAKS);
  const [phase, setPhase] = React.useState(t.skip_intro ? "active" : "idle");
  const [board, setBoard] = React.useState(t.skip_intro && t.auto_open_board ? "open" : "closed");
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const lastTapRef = React.useRef(0);

  // apply dark mode to body for css vars
  React.useEffect(() => {
    document.body.classList.toggle("cs-dark", !!t.dark);
  }, [t.dark]);

  // apply low-load mode to body — strips decorative styling
  React.useEffect(() => {
    document.body.classList.toggle("cs-lowload", !!t.low_load);
  }, [t.low_load]);

  // re-sync phase when skip_intro toggles
  React.useEffect(() => {
    if (t.skip_intro) { setPhase("active"); if (t.auto_open_board) setBoard("open"); }
  }, [t.skip_intro]);

  const ctx = {
    eventId: "evt_06420f",
    sheetId: "S-2026-05-17-014",
    dateStr: "2026-05-17 SAT",
    timeStr: "06:42:18 +08",
    createdAt: "06:42:11",
    jsonStr: JSON_BLOB,
  };

  function press() {
    if (phase === "idle") {
      setPhase("pressing");
      setTimeout(() => {
        setPhase("active");
        if (t.auto_open_board) setTimeout(() => setBoard("open"), 900);
      }, 240);
    } else if (phase === "active") {
      // double-tap detection → "calling" sub-state
      const now = Date.now();
      if (now - lastTapRef.current < 600) {
        lastTapRef.current = 0;
        setPhase("calling");
        // simulate connection sequence
        setTimeout(() => setPhase("connected"), 2400);
      } else {
        lastTapRef.current = now;
      }
    } else if (phase === "connected" || phase === "calling") {
      // tap again to expand board
      if (board === "closed") setBoard("open");
    }
  }

  function reset() {
    setBoard("closed");
    setJsonOpen(false);
    setPhase("idle");
  }

  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      overflowX: "auto",
      background:
        "radial-gradient(ellipse at top, #2a2620 0%, #181613 55%, #0e0c0a 100%)",
      backgroundAttachment: "fixed",
      position: "relative",
    }}>
    <div style={{
      minHeight: "100vh",
      minWidth: t.show_operator_pane ? 1180 : 520,
      width: "max-content", margin: "0 auto",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 22, padding: "32px 24px 60px",
      position: "relative",
    }}>
      <StationBackdrop />
      <RoleSwitcher
        role={t.show_operator_pane ? "responder" : "victim"}
        setRole={(r) => setTweak("show_operator_pane", r === "responder")}
        lowLoad={t.low_load}
        setLowLoad={(v) => setTweak("low_load", v)}
      />
      {t.show_operator_pane && <OperatorPane t={t} ctx={ctx} phase={phase} reset={reset} />}

      <div style={{ position: "relative", zIndex: 2 }}>
        <IOSDevice width={402} height={874}>
          <div style={{ height: "100%", position: "relative", background: "var(--paper)" }}>
            <MainScreen
              phase={phase}
              onPress={press}
              onOpenBoard={() => setBoard("open")}
              t={ctx}
              lowLoad={t.low_load}
            />
            {board === "open" && (
              <CommandBoard
                onClose={() => setBoard("closed")}
                onOpenJson={() => setJsonOpen(true)}
                t={ctx}
                showPlaceholders={true}
              />
            )}
          </div>
        </IOSDevice>

        {/* phone tape strips, holding it to the board (decorative) */}
        {!t.low_load && (
          <React.Fragment>
            <div style={{
              position: "absolute", top: -16, left: 60, width: 80, height: 26,
              background: "rgba(244,216,110,0.85)",
              transform: "rotate(-5deg)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }} />
            <div style={{
              position: "absolute", top: -14, right: 50, width: 86, height: 24,
              background: "rgba(160,196,222,0.8)",
              transform: "rotate(6deg)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }} />
          </React.Fragment>
        )}

        {/* caption tag below the phone — only meaningful when responder pane is visible */}
        {t.show_operator_pane && !t.low_load && (
          <div style={{
            position: "absolute", bottom: -48, left: "50%", transform: "translateX(-50%) rotate(-1deg)",
            background: "var(--paper)", border: "1px solid var(--ink)",
            padding: "6px 14px",
            fontFamily: "var(--f-stamp)", fontSize: 12, letterSpacing: 1, color: "var(--ink)",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--marker-red)" }} />
            SUBJECT PHONE · YELP MVP
          </div>
        )}
      </div>

      {t.show_operator_pane && <ReportPane t={t} ctx={ctx} jsonStr={JSON_BLOB} />}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="顯示">
          <TweakToggle label="深色現場板" value={t.dark} onChange={(v) => setTweak("dark", v)} />
          <TweakToggle label="左右兩側指揮台" value={t.show_operator_pane} onChange={(v) => setTweak("show_operator_pane", v)} />
          <TweakToggle label="按下後自動展開狀態板" value={t.auto_open_board} onChange={(v) => setTweak("auto_open_board", v)} />
          <TweakToggle label="跳過 idle，直接顯示已啟動" value={t.skip_intro} onChange={(v) => setTweak("skip_intro", v)} />
        </TweakSection>
        <TweakSection label="紙質強度">
          <TweakSlider label="紋路深度" min={0} max={1} step={0.05}
            value={t.paper_intensity} onChange={(v) => setTweak("paper_intensity", v)} />
        </TweakSection>
        <TweakSection label="現場演示">
          <TweakButton label="重設 (回到 idle)" onClick={reset} />
        </TweakSection>
      </TweaksPanel>

      {/* apply paper intensity */}
      <style>{`
        .cs-paper::before { opacity: ${t.paper_intensity} !important; }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Role switcher — pinned top-right. Toggles operator panes.
// ──────────────────────────────────────────────────────────
function RoleSwitcher({ role, setRole, lowLoad, setLowLoad }) {
  return (
    <div style={{
      position: "fixed", top: 14, right: 18, zIndex: 50,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="cs-mono" style={{
          fontSize: 10, color: "#cfc7b3", letterSpacing: 1.5,
          textTransform: "uppercase", paddingRight: 2,
        }}>
          身分 / role
        </div>
        <div style={{
          display: "flex",
          background: "#1a1814",
          border: "1.5px solid #c9a96a",
          boxShadow: "0 4px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: 3, gap: 2,
        }}>
          <RoleBtn
            on={role === "victim"}
            onClick={() => setRole("victim")}
            glyph="🆘"
            label="民眾"
            sub="victim"
          />
          <RoleBtn
            on={role === "responder"}
            onClick={() => setRole("responder")}
            glyph="🎯"
            label="救援人員"
            sub="responder"
          />
        </div>
      </div>

      {/* low-load toggle — only meaningful in victim view */}
      {role === "victim" && (
        <button
          onClick={() => setLowLoad(!lowLoad)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 10px 6px 8px",
            background: lowLoad ? "#f1ead8" : "rgba(26,24,20,0.85)",
            color: lowLoad ? "#1a1814" : "#cfc7b3",
            border: "1.5px solid " + (lowLoad ? "#1a1814" : "#c9a96a"),
            boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
            cursor: "pointer",
            fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 12,
            letterSpacing: 0.3,
          }}
          title="拿掉所有花俏元素，只用線條與單一字體；給恐慌中、視力負擔大的人">
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 14,
            borderRadius: 8,
            background: lowLoad ? "#4a7c45" : "#5a554a",
            position: "relative",
            transition: "background 0.18s",
          }}>
            <span style={{
              position: "absolute",
              top: 1, left: lowLoad ? 9 : 1,
              width: 12, height: 12, borderRadius: "50%",
              background: "#fff",
              transition: "left 0.18s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.05 }}>
            <span>低負擔版</span>
            <span className="cs-mono" style={{ fontSize: 8, opacity: 0.7, letterSpacing: 1 }}>
              low-load · 簡化版面
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function RoleBtn({ on, onClick, glyph, label, sub }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "5px 11px",
      background: on ? "#f1ead8" : "transparent",
      color: on ? "#1a1814" : "#cfc7b3",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 12,
      letterSpacing: 0.3,
      position: "relative",
    }}>
      <span style={{ fontSize: 14, filter: on ? "none" : "grayscale(0.6)" }}>{glyph}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.05 }}>
        <span>{label}</span>
        <span className="cs-mono" style={{ fontSize: 8, opacity: 0.65, letterSpacing: 1 }}>{sub}</span>
      </span>
      {on && (
        <span style={{
          position: "absolute", left: 6, right: 6, bottom: 2, height: 2,
          background: "var(--marker-red)",
        }} />
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Backdrop: dark tent canvas + pinned papers behind phone
// ──────────────────────────────────────────────────────────
function StationBackdrop() {
  return (
    <React.Fragment>
      {/* canvas tarp texture overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/></svg>\")",
        opacity: 0.6,
      }} />
      {/* spotlights */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle at 30% 25%, rgba(255,220,150,0.08), transparent 30%), radial-gradient(circle at 75% 80%, rgba(200,150,80,0.06), transparent 30%)",
      }} />
    </React.Fragment>
  );
}

// ──────────────────────────────────────────────────────────
// LEFT pane: incident log on plywood board
// ──────────────────────────────────────────────────────────
function OperatorPane({ t, ctx, phase, reset }) {
  return (
    <div style={{ position: "relative", zIndex: 2, width: 320, flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* header sign */}
      <div className="cs-board" style={{ padding: "14px 16px", position: "relative" }}>
        <div className="cs-stamp-font" style={{ fontSize: 20, color: "#3a2a14", letterSpacing: 1 }}>
          現場指揮站 · FIELD OPS
        </div>
        <div className="cs-mono" style={{ fontSize: 10, color: "#5a4322", letterSpacing: 1, marginTop: 2 }}>
          SECTOR&nbsp;C / TENT-04 · LISTENING POST
        </div>
        <div style={{ position: "absolute", top: -8, right: 18, transform: "rotate(8deg)" }}>
          <Stamp color="#8a221c" rotate={0} style={{ background: "rgba(241,234,216,0.92)" }}>
            17 MAY · 06:40
          </Stamp>
        </div>
      </div>

      {/* incident log */}
      <div className="cs-card lined" style={{ padding: "12px 14px 14px", position: "relative", flex: 1, minHeight: 380 }}>
        <Tape color="yellow" style={{ left: -10, top: -10, transform: "rotate(-8deg)" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="cs-stamp-font" style={{ fontSize: 15, color: "var(--ink)", letterSpacing: 0.5 }}>
            INCOMING · 收訊紀錄
          </span>
          <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)" }}>page 03 / 14</span>
        </div>

        <LogRow time="06:38:02" who="—"   text="(待命中…)" muted />
        <LogRow time="06:42:11" who="evt_06420f" text="新事件建立 · 自手機 yelp" pin="red" />
        <LogRow time="06:42:14" who="evt_06420f" text="位置送達 · 23.4012,121.3104" pin="blue" />
        <LogRow time="06:42:14" who="evt_06420f" text='文字片段：「水一直進來」' />
        <LogRow time="06:42:16" who="evt_06420f" text='語音片段：「我爸不能走，拜託快點」' />
        <LogRow time="06:42:18" who="后端"  text="後端已讀；判讀 → flood / sev 4" pin="yellow" />
        <LogRow time="06:42:19" who="agent" text="信心 0.72，已標記需複核" />
        <LogRow time="06:42:21" who="dispatch" text="→ 推送 rescue_dispatch · medical_support" />

        {/* margin notes */}
        <div className="cs-hand" style={{
          position: "absolute", right: 8, bottom: 26,
          fontSize: 19, color: "var(--marker-red)",
          transform: "rotate(-3deg)",
        }}>
          → 推派 R-12<br/>需擔架
        </div>
      </div>

      {/* legend */}
      <div className="cs-kraft" style={{ padding: "10px 12px", position: "relative" }}>
        <div className="cs-mono" style={{ fontSize: 10, color: "#3a2a14", letterSpacing: 1, marginBottom: 6 }}>
          LEGEND · 圖例
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "#2c200e" }}>
          <LegendItem c="#c8332c" l="紅 = 求助 / 高優先" />
          <LegendItem c="#1b4a82" l="藍 = 位置 / 地圖" />
          <LegendItem c="#b07b1f" l="黃 = 系統判讀" />
          <LegendItem c="#4a7c45" l="綠 = 已確認" />
        </div>
      </div>

      {/* button strip */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="cs-btn" onClick={reset} style={{ flex: 1 }}>
          <span style={{ width: 10, height: 10, background: "var(--marker-red)", borderRadius: "50%" }} />
          重播 / replay
        </button>
        <div className="cs-mono" style={{
          flex: 1, padding: "9px 12px", background: "var(--paper-2)", border: "1.5px solid var(--ink)",
          fontSize: 11, color: "var(--ink-soft)", letterSpacing: 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          phase: <b>{phase}</b>
        </div>
      </div>
    </div>
  );
}

function LogRow({ time, who, text, pin, muted }) {
  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "flex-start", padding: "3px 0",
      opacity: muted ? 0.5 : 1, position: "relative",
    }}>
      <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", width: 56, flex: "none", lineHeight: "22px" }}>
        {time}
      </span>
      <span className="cs-mono" style={{ fontSize: 10, color: pin === "red" ? "var(--marker-red)" : "var(--ink-soft)", width: 68, flex: "none", fontWeight: 700, lineHeight: "22px" }}>
        {who}
      </span>
      <span style={{ flex: 1, fontFamily: "var(--f-body)", fontSize: 13, color: "var(--ink)", lineHeight: "22px" }}>
        {text}
      </span>
      {pin && <span style={{
        flex: "none", width: 8, height: 8, marginTop: 6, borderRadius: "50%",
        background: pin === "red" ? "var(--marker-red)" : pin === "blue" ? "#1b4a82" : pin === "yellow" ? "var(--highlight-dim)" : "var(--ok)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(0,0,0,0.3)",
      }} />}
    </div>
  );
}

function LegendItem({ c, l }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, background: c, borderRadius: "50%", flex: "none", boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.3)" }} />
      <span>{l}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// RIGHT pane: dispatch board with task strips + JSON slip
// ──────────────────────────────────────────────────────────
function ReportPane({ t, ctx, jsonStr }) {
  return (
    <div style={{ position: "relative", zIndex: 2, width: 340, flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* board sign */}
      <div className="cs-board" style={{ padding: "14px 16px", position: "relative" }}>
        <div className="cs-stamp-font" style={{ fontSize: 20, color: "#3a2a14", letterSpacing: 1 }}>
          派遣板 · DISPATCH
        </div>
        <div className="cs-mono" style={{ fontSize: 10, color: "#5a4322", letterSpacing: 1, marginTop: 2 }}>
          任務分流 · TASK STRIPS · 已自 JSON 轉派
        </div>
      </div>

      {/* task strips */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TaskStrip
          tag="RESCUE" color="var(--marker-red)"
          title="派遣救援 R-12"
          meta="rescue_dispatch · sev 4"
          state="ok"
          stateLabel="已派出"
          note="座標 23.4012, 121.3104" />
        <TaskStrip
          tag="MEDICAL" color="#1b4a82"
          title="準備行動協助"
          meta="medical_support · 行動不便"
          state="sent"
          stateLabel="已通知"
          note="擔架 / 輪椅" />
        <TaskStrip
          tag="MAP" color="#b07b1f"
          title="淹水熱區標記"
          meta="flood_hotspot_map"
          state="read"
          stateLabel="已標記"
          note="GIS 已收" />
        <TaskStrip
          tag="REVIEW" color="var(--pencil)"
          title="人工複核"
          meta="confidence 0.72"
          state="warn"
          stateLabel="待複核"
          note="若可，追問是否其他人受困" />
      </div>

      {/* mini JSON receipt */}
      <div style={{ position: "relative", marginTop: 4 }}>
        <Tape color="red" style={{ right: 30, top: -10, transform: "rotate(6deg)" }} />
        <div style={{
          background: "var(--paper-2)",
          border: "1.5px solid var(--ink)",
          padding: "10px 12px",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div className="cs-stamp-font" style={{ fontSize: 13, letterSpacing: 1 }}>EXCHANGE PAYLOAD</div>
            <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)" }}>application/json</div>
          </div>
          <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginTop: 2 }}>
            ↓ 給後續積木使用 · 任一系統可接
          </div>
          <pre className="cs-mono" style={{
            margin: "8px 0 0",
            fontSize: 10, lineHeight: 1.5,
            color: "var(--ink)",
            maxHeight: 220, overflow: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            background: "var(--paper)",
            padding: "8px 10px",
            border: "1px dashed var(--line-strong)",
          }}>{trimJson(jsonStr)}</pre>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip mono>rescue_dispatch</Chip>
            <Chip mono>medical_support</Chip>
            <Chip mono>shelter_accessibility</Chip>
            <Chip mono>flood_hotspot_map</Chip>
          </div>
        </div>
      </div>

      {/* footer stamp row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Stamp color="var(--ok)" rotate={-4} style={{ fontSize: 10 }}>已送出</Stamp>
        <Stamp color="#1b4a82" rotate={3} style={{ fontSize: 10 }}>已讀</Stamp>
        <Stamp color="var(--warn)" rotate={-2} style={{ fontSize: 10 }}>需複核</Stamp>
        <div className="cs-mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--paper)" }}>seq 014</div>
      </div>
    </div>
  );
}

function TaskStrip({ tag, color, title, meta, state, stateLabel, note }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: "var(--paper)", border: "1.5px solid var(--ink)",
      boxShadow: "2px 3px 0 rgba(0,0,0,0.18)",
      position: "relative",
    }}>
      {/* color flag */}
      <div style={{
        width: 22, background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRight: "1.5px solid var(--ink)",
      }}>
        <span style={{
          color: "#fff", fontFamily: "var(--f-stamp)", fontSize: 9, letterSpacing: 1,
          writingMode: "vertical-rl", transform: "rotate(180deg)", padding: "4px 0",
        }}>{tag}</span>
      </div>
      <div style={{ flex: 1, padding: "8px 10px 8px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{title}</span>
          <Sticker kind={state} style={{ flex: "none" }}>{stateLabel}</Sticker>
        </div>
        <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginTop: 2 }}>{meta}</div>
        <div className="cs-hand" style={{ fontSize: 16, color: color, marginTop: 3 }}>{note}</div>
      </div>
    </div>
  );
}

function trimJson(s) {
  // pull out a short, readable subset
  return [
    '{',
    '  "event_type": "flood",',
    '  "severity": 4,',
    '  "panic_level": 0.86,',
    '  "confidence": 0.72,',
    '  "location": {"lat": 23.4012, "lng": 121.3104},',
    '  "needs": ["rescue", "mobility_assistance"],',
    '  "vulnerability_flags": ["mobility_impaired"],',
    '  "exchange_targets": [',
    '    "rescue_dispatch", "medical_support",',
    '    "shelter_accessibility", "flood_hotspot_map"',
    '  ],',
    '  "status": {"created": true, "sent": true, "read": true}',
    '}',
  ].join('\n');
}

// fade-up keyframes available globally
const styleNode = document.createElement("style");
styleNode.textContent = `
  @keyframes cs-fadeup { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes cs-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;
document.head.appendChild(styleNode);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<YelpApp />);
