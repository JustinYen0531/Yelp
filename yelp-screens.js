// yelp-screens.jsx — screens for the Yelp field-command prototype
// Loaded after React + Babel. Exports to window.

// ---------- tiny atoms ----------
function Sticker({ kind = "idle", children, style }) {
  const map = {
    idle: "st-idle", ok: "st-ok", sent: "st-sent", read: "st-read",
    warn: "st-warn", err: "st-err",
  };
  return <span className={"cs-sticker " + (map[kind] || "st-idle")} style={style}>{children}</span>;
}

function Stamp({ children, color = "var(--marker-red)", rotate = -3, style }) {
  return (
    <span className="cs-stamp" style={{ borderColor: color, color, transform: `rotate(${rotate}deg)`, ...style }}>
      {children}
    </span>
  );
}

function Tape({ color = "yellow", style }) {
  const cls = color === "blue" ? "tape-blue" : color === "red" ? "tape-red" : "";
  return <div className={"cs-tape " + cls} style={style} />;
}

// Hand-drawn ECG / heartbeat wave that pulses around the SOS button
function HeartbeatWave({ side = "left" }) {
  // sharp ECG spike: flat → tiny dip → small bump → big spike → flat
  // hand-drawn marker feel via stroke-linecap round + slight rotation
  const isLeft = side === "left";
  return (
    <div style={{
      position: "absolute",
      top: "50%",
      [isLeft ? "right" : "left"]: "calc(50% + 105px)",
      transform: `translateY(-50%) ${isLeft ? "scaleX(-1)" : ""}`,
      pointerEvents: "none",
      width: 92, height: 80,
      overflow: "visible",
      zIndex: 1,
    }}>
      <svg viewBox="0 0 92 80" width="92" height="80" style={{ overflow: "visible" }}>
        <defs>
          <filter id={"hb-rough-" + side} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
            <feDisplacementMap in="SourceGraphic" scale="1.2"/>
          </filter>
        </defs>
        <g style={{ animation: "hb-pulse 1.6s ease-in-out infinite" }}>
          {/* main ECG line — chunky red marker */}
          <path
            d="M2 40 L18 40 L22 38 L26 42 L30 40 L42 40 L48 12 L52 64 L58 40 L72 40 L76 36 L80 44 L90 40"
            fill="none"
            stroke="#c8332c"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={"url(#hb-rough-" + side + ")"}
          />
          {/* ghost echo, slightly offset */}
          <path
            d="M2 40 L18 40 L22 38 L26 42 L30 40 L42 40 L48 12 L52 64 L58 40 L72 40 L76 36 L80 44 L90 40"
            fill="none"
            stroke="#c8332c"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.35"
            transform="translate(0.8 1.2)"
          />
        </g>
      </svg>
    </div>
  );
}

function FieldLine({ label, value, status, time }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
      <div style={{ flex: "0 0 78px", fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--pencil)", letterSpacing: 0.5, paddingTop: 2 }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 500, color: "var(--ink)", wordBreak: "break-all" }}>
          {value}
        </div>
        {time && <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--pencil)", marginTop: 2 }}>{time}</div>}
      </div>
      {status && <div style={{ paddingTop: 2 }}>{status}</div>}
    </div>
  );
}

function SectionTitle({ num, children, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "18px 0 6px" }}>
      <span className="cs-mono" style={{ fontSize: 11, color: "var(--pencil)", letterSpacing: 1 }}>§ {num}</span>
      <span className="cs-stamp-font" style={{ fontSize: 15, color: "var(--ink)", letterSpacing: 0.5 }}>{children}</span>
      {sub && <span className="cs-hand" style={{ fontSize: 14, color: "var(--marker-red)", marginLeft: "auto" }}>{sub}</span>}
    </div>
  );
}

// =====================================================================
// MAIN SCREEN — big SOS button, field-station header
// =====================================================================

// Lifecycle steps — six human-language messages the victim should see grow
// down the screen as the system processes their signal. Spec: yelp-mvp.md §3.2.
// Order is meaningful; no English / no engineering terms (yelp-mvp.md §3.4).
const LIFECYCLE_STEPS = [
  "已收到你的訊號",      // 0 · SOS pressed
  "已取得位置",          // 1 · GPS resolved
  "正在理解現場狀況",    // 2 · Agent began analysis
  "已建立求救事件",      // 3 · Agent returned (success / skipped / error → mock)
  "已送出",              // 4 · downstream dispatch
  "等待救援單位接收",    // 5 · final / awaiting
];

function Lifecycle({ phase, agentState, onSpeakStep }) {
  // currentStep counts how many steps have COMPLETED (0..6).
  // The next-to-show step is steps[currentStep], rendered as "active".
  const [currentStep, setCurrentStep] = React.useState(0);
  const [stampTimes, setStampTimes] = React.useState({});

  // Reset whenever phase returns to idle (replay).
  React.useEffect(() => {
    if (phase === "idle") {
      setCurrentStep(0);
      setStampTimes({});
    }
  }, [phase]);

  React.useEffect(() => {
    if (phase === "idle") return;
    if (typeof onSpeakStep !== "function") return;
    onSpeakStep(currentStep);
  }, [currentStep, onSpeakStep, phase]);

  // Drive the timeline forward. Each step decides its own wait condition
  // and delay; the effect re-runs on (phase, agentState.status, currentStep).
  React.useEffect(() => {
    if (phase === "idle") return;

    let timer;
    // Clamp at length-1 so the last step ("等待救援單位接收") stays active forever.
    // It has no terminal event by design — the system is perpetually waiting.
    const MAX_DONE = LIFECYCLE_STEPS.length - 1;
    const advance = (delay) => {
      timer = setTimeout(() => {
        setStampTimes((p) => {
          if (p[currentStep] != null) return p;
          const hms = new Date().toTimeString().slice(0, 8);
          return { ...p, [currentStep]: hms };
        });
        setCurrentStep((s) => Math.min(s + 1, MAX_DONE));
      }, delay);
    };

    if (currentStep === 0) advance(50);
    else if (currentStep === 1) advance(600);
    else if (currentStep === 2) {
      // wait for Agent to leave idle (any of running / success / skipped / error)
      if (agentState && agentState.status && agentState.status !== "idle") advance(200);
    }
    else if (currentStep === 3) {
      // wait for Agent to reach a terminal state
      const s = agentState && agentState.status;
      if (s === "success" || s === "skipped" || s === "error") advance(300);
    }
    else if (currentStep === 4) advance(500);
    // currentStep === 5 → final, step 6 stays "active" indefinitely (no advance)

    return () => { if (timer) clearTimeout(timer); };
  }, [phase, agentState && agentState.status, currentStep]);

  // Idle state — no events yet
  if (phase === "idle" && currentStep === 0) {
    return (
      <div className="cs-hand" style={{
        fontSize: 18, color: "var(--ink-soft)",
        padding: "12px 0 6px", textAlign: "center",
      }}>
        準備好建立求助事件
      </div>
    );
  }

  // visible = how many step rows to render (all done + 1 active)
  const visible = Math.min(currentStep + 1, LIFECYCLE_STEPS.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 2 }}>
      {LIFECYCLE_STEPS.slice(0, visible).map((text, i) => {
        const isDone = i < currentStep;
        const time = stampTimes[i];
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "var(--paper)",
              border: "1.5px solid " + (isDone ? "var(--line-strong)" : "var(--ink)"),
              padding: "5px 9px 5px 7px",
              animation: "cs-fadeup 0.32s both",
              boxShadow: isDone ? "none" : "2px 2px 0 rgba(26,24,20,0.18)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 18, height: 18, flex: "none",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, lineHeight: 1,
                color: isDone ? "var(--ok)" : "var(--marker-red)",
                border: "1.5px " + (isDone ? "solid var(--ok)" : "dashed var(--marker-red)"),
                borderRadius: "50%",
                background: "var(--paper)",
              }}
            >
              {isDone ? "✓" : <span className="lc-pulse-dot" />}
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--f-body)", fontSize: 14, fontWeight: 500,
                color: isDone ? "var(--ink-soft)" : "var(--ink)",
                letterSpacing: 0.02,
              }}
            >
              {text}
            </span>
            {time && (
              <span className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)" }}>
                {time}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MoreOptionRow({ label, sub, on, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "8px 12px",
        background: "transparent",
        border: "none",
        borderBottom: "1px dashed var(--line)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        textAlign: "left",
        fontFamily: "var(--f-body)",
      }}>
      <span style={{
        width: 18, height: 18, flex: "none",
        border: "1.5px solid var(--ink)",
        background: on ? "var(--marker-red)" : "var(--paper)",
        boxShadow: on ? "inset 0 0 0 2px var(--paper)" : "none",
        position: "relative",
      }}>
        {on && <span style={{
          position: "absolute", inset: 2, background: "var(--marker-red)",
        }} />}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "block" }}>{label}</span>
        <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", letterSpacing: 0.5 }}>{sub}</span>
      </span>
      <span className="cs-stamp-font" style={{
        fontSize: 10, letterSpacing: 1,
        color: on ? "var(--ok)" : "var(--pencil)",
        border: "1px solid currentColor",
        padding: "1px 5px",
      }}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function SpeechStatus({ speechState }) {
  if (!speechState) return null;
  const mode = !speechState.enabled
    ? "OFF"
    : speechState.muted
      ? "MUTED"
      : speechState.dryRun
        ? "DRY-RUN"
        : speechState.supported
          ? (speechState.speaking ? "SPEAKING" : "READY")
          : "UNSUPPORTED";
  const modeColor = mode === "SPEAKING"
    ? "var(--marker-red)"
    : mode === "READY"
      ? "var(--ok)"
      : "var(--pencil)";

  return (
    <div style={{
      marginTop: 10,
      borderTop: "1px dashed var(--line-strong)",
      paddingTop: 8,
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", letterSpacing: 1 }}>
          SPEECH
        </span>
        <span style={{
          fontFamily: "var(--f-mono)",
          fontSize: 10,
          color: modeColor,
          border: "1px solid currentColor",
          padding: "1px 5px",
          letterSpacing: 1,
        }}>
          {mode}
        </span>
        {speechState.voiceName && (
          <span className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", opacity: 0.85 }}>
            {speechState.voiceName}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--f-body)", fontSize: 13, color: "var(--ink)" }}>
        {speechState.lastText || "No speech events yet."}
      </div>
      {speechState.history && speechState.history.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {speechState.history.slice(0, 3).map((item, idx) => (
            <span key={item.at + "-" + idx} className="cs-mono" style={{
              fontSize: 9,
              color: "var(--pencil)",
              border: "1px dashed var(--line)",
              padding: "2px 5px",
            }}>
              {item.at} · {item.mode}
            </span>
          ))}
        </div>
      )}
      {speechState.error && (
        <div className="cs-hand" style={{ fontSize: 13, color: "var(--marker-red)" }}>
          speech error: {speechState.error}
        </div>
      )}
    </div>
  );
}

function MainScreen({ phase, onPress, onOpenBoard, t, lowLoad, readOnly = false, speechState, onLifecycleSpeak }) {
  // phase: 'idle' | 'pressing' | 'active' | 'calling' | 'connected'
  const active    = phase === "active" || phase === "calling" || phase === "connected";
  const calling   = phase === "calling";
  const connected = phase === "connected";
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [extras, setExtras] = React.useState({ screen: false, camera: false, mic: true });
  const [blockedAt, setBlockedAt] = React.useState(0); // for read-only "blocked" flash
  const moreRef = React.useRef(null);

  // wrap actions so read-only viewers see a "唯讀" flash instead of mutating state
  const blocked = () => { setBlockedAt(Date.now()); setTimeout(() => setBlockedAt(0), 1100); };
  const safePress     = readOnly ? blocked : onPress;
  const safeOpenBoard = readOnly ? blocked : onOpenBoard;
  const safeToggleExtra = (k) => { if (readOnly) return blocked(); toggleExtra(k); };

  React.useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  // close menu when phase resets
  React.useEffect(() => { if (!active) setMoreOpen(false); }, [active]);

  const toggleExtra = (k) => setExtras((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="cs-paper cs-scroll" style={{
      height: "100%", width: "100%", overflowY: "auto",
      display: "flex", flexDirection: "column",
      padding: "60px 22px 30px",
      position: "relative",
    }}>
      {/* read-only viewer overlay (only when MainScreen is being mirrored to operator) */}
      {readOnly && (
        <React.Fragment>
          <div style={{
            position: "absolute", top: 38, right: 14, zIndex: 40,
            padding: "2px 8px", background: "rgba(20,20,20,0.82)", color: "#9ef0c4",
            border: "1px solid #4caf7e",
            fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 1,
            display: "flex", alignItems: "center", gap: 6,
            pointerEvents: "none",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4caf7e", animation: "cs-pulse 1.4s infinite" }} />
            VIEWER · 監控中 · 唯讀
          </div>
          {blockedAt > 0 && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                background: "rgba(20,20,20,0.86)", color: "#ffb4ad",
                border: "1.5px solid #c8332c",
                padding: "8px 14px",
                fontFamily: "var(--f-stamp)", fontSize: 13, letterSpacing: 1,
                animation: "cs-fadeup 0.18s both",
              }}>
                ⊘ 唯讀模式 · 監控者無法替報案人按鈕
              </div>
            </div>
          )}
        </React.Fragment>
      )}

      {/* corner registration marks */}
      <div className="cs-reg tl" />
      <div className="cs-reg tr" />
      <div className="cs-reg bl" />
      <div className="cs-reg br" />

      {/* header band — like a clipboard form header */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--ink)", color: "var(--paper)",
          padding: "7px 10px",
          fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 0.5,
          position: "relative", whiteSpace: "nowrap",
        }}>
          <span style={{
            display: "inline-block", width: 7, height: 7, borderRadius: "50%",
            background: active ? "var(--marker-red)" : "var(--highlight)",
            boxShadow: active ? "0 0 0 3px rgba(200,51,44,0.35)" : "none",
            animation: active ? "cs-pulse 1.2s infinite" : "none",
            flexShrink: 0,
          }} />
          YELP · FIELD STATION
          <span style={{ marginLeft: "auto", opacity: 0.7 }}>FORM-01 / v1</span>
        </div>
        <Tape color="yellow" style={{ left: -8, top: -10, transform: "rotate(-8deg)" }} />
        <Tape color="blue" style={{ right: -10, top: -8, transform: "rotate(7deg)" }} />
      </div>

      {/* sheet metadata */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
        fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--pencil)",
        marginBottom: 16,
        borderBottom: "1px solid var(--line)",
        paddingBottom: 6,
      }}>
        <div>SHEET&nbsp;&nbsp;{t.sheetId}</div>
        <div style={{ textAlign: "right" }}>{t.dateStr}</div>
        <div>OP&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{active ? "self / phone" : "—"}</div>
        <div style={{ textAlign: "right" }}>{t.timeStr}</div>
      </div>

      {/* hand-written instruction */}
      <div style={{ textAlign: "center", marginBottom: 18, position: "relative" }}>
        <div className="cs-hand" style={{ fontSize: 28, color: "var(--ink)", lineHeight: 1.05 }}>
          {active ? "Yelp 正在運作" : "需要幫忙？"}
        </div>
        <div className="cs-hand" style={{ fontSize: 22, color: "var(--marker-red)", marginTop: 2 }}>
          {active ? <span className="cs-underline">系統會把訊號整理好</span> : <span className="cs-underline">按一下中間的紅鈕</span>}
        </div>
      </div>

      {/* big SOS */}
      <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 18px", position: "relative" }}>
        {/* arrow scribbles around button when idle */}
        {!active && !lowLoad && (
          <React.Fragment>
            <div className="cs-hand" style={{
              position: "absolute", left: -2, top: -6, color: "var(--marker-red)",
              fontSize: 22, transform: "rotate(-10deg)", zIndex: 2,
            }}>按這裡 ↘</div>
          </React.Fragment>
        )}

        {/* heartbeat ECG waves around button when active */}
        {active && !lowLoad && (
          <React.Fragment>
            <HeartbeatWave side="left" />
            <HeartbeatWave side="right" />
          </React.Fragment>
        )}

        {/* double-tap hint balloon — only while monitoring, before connecting */}
        {phase === "active" && (
          <div style={{
            position: "absolute",
            top: -42, left: "50%", transform: "translateX(-50%) rotate(-1deg)",
            background: "var(--highlight)",
            border: "1.5px solid var(--ink)",
            padding: "5px 12px",
            fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 13,
            color: "var(--ink)", whiteSpace: "nowrap",
            boxShadow: "2px 3px 0 rgba(0,0,0,0.25)",
            zIndex: 3,
            animation: "cs-fadeup 0.4s both, hint-wiggle 2.4s ease-in-out 0.4s infinite",
          }}>
            再按連續兩下進行連線
            <span style={{
              position: "absolute", left: "50%", bottom: -8,
              transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "8px solid var(--ink)",
            }} />
            <span style={{
              position: "absolute", left: "50%", bottom: -6,
              transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "7px solid var(--highlight)",
            }} />
          </div>
        )}

        {/* calling-status balloon */}
        {(calling || connected) && (
          <div style={{
            position: "absolute",
            top: -42, left: "50%", transform: "translateX(-50%) rotate(-1deg)",
            background: connected ? "#e6efd9" : "var(--paper)",
            border: "1.5px solid " + (connected ? "var(--ok)" : "var(--marker-red)"),
            padding: "5px 12px",
            fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 13,
            color: connected ? "var(--ok)" : "var(--marker-red)",
            whiteSpace: "nowrap",
            boxShadow: "2px 3px 0 rgba(0,0,0,0.2)",
            zIndex: 3,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "currentColor",
              animation: connected ? "none" : "cs-dot 0.9s infinite",
            }} />
            {connected ? "已接通 · 救援端通話中" : "連線中…"}
            {!connected && <span className="cs-dots"><span/><span/><span/></span>}
          </div>
        )}

        <button
          className={"cs-sos" + (active ? " active" : "") + (readOnly ? " readonly" : "")}
          onClick={safePress}
          aria-label="發出求助"
          title={readOnly ? "監控模式 · 唯讀，無法觸發救援" : undefined}>
          <div style={{ fontSize: 64, lineHeight: 1, letterSpacing: 0.04 }}>YELP</div>
          <div style={{ fontSize: 15, opacity: 0.95, marginTop: 4, letterSpacing: 0.18 }}>
            {connected ? "已接通" : calling ? "連線中" : active ? "監測中" : "發出求助"}
          </div>
        </button>
      </div>

      {/* status strip */}
      <div ref={moreRef} style={{
        margin: "6px auto 0", width: "100%",
        background: "var(--paper-2)", border: "1.5px dashed var(--line-strong)",
        padding: "10px 12px",
        position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", letterSpacing: 1 }}>
            ▸ STATUS / 目前狀態
          </div>
          {active && (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="更多選項"
              style={{
                background: moreOpen ? "var(--ink)" : "transparent",
                color: moreOpen ? "var(--paper)" : "var(--ink)",
                border: "1.5px solid var(--ink)",
                padding: "1px 8px 3px",
                fontFamily: "var(--f-stamp)",
                fontSize: 14, letterSpacing: 2, lineHeight: 1,
                cursor: "pointer",
              }}>
              ⋯
            </button>
          )}
        </div>
        {/* Event-lifecycle UI (M9a · yelp-mvp.md §3.2)
            Six human-language messages grow down as system processes the signal.
            No engineering terms · no model/confidence values exposed. */}
        <Lifecycle phase={phase} agentState={t && t.agentState} onSpeakStep={onLifecycleSpeak} />
        <SpeechStatus speechState={speechState} />

        {/* — extras chips, visible after at least one is enabled — */}
        {active && (extras.screen || extras.camera) && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {extras.camera && <Sticker kind="sent" style={{ transform: "rotate(0deg)", fontSize: 10 }}>📷 相機 ON</Sticker>}
            {extras.screen && <Sticker kind="sent" style={{ transform: "rotate(0deg)", fontSize: 10 }}>🖥 螢幕 ON</Sticker>}
          </div>
        )}

        {/* — more-options popover — */}
        {moreOpen && (
          <div style={{
            position: "absolute", top: -4, right: -6, zIndex: 30,
            transform: "translateY(-100%)",
            background: "var(--paper)",
            border: "1.5px solid var(--ink)",
            boxShadow: "3px 4px 0 rgba(0,0,0,0.18), 5px 8px 16px rgba(60,40,10,0.18)",
            minWidth: 200,
            animation: "cs-fadeup 0.18s both",
          }}>
            {/* header strip */}
            <div style={{
              background: "var(--ink)", color: "var(--paper)",
              padding: "5px 10px",
              fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: 1,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>更多訊號來源</span>
              <span style={{ opacity: 0.6 }}>signals++</span>
            </div>
            <MoreOptionRow
              label="共用螢幕"
              sub="screen share"
              on={extras.screen}
              onClick={() => safeToggleExtra("screen")} />
            <MoreOptionRow
              label="啟用相機"
              sub="camera feed"
              on={extras.camera}
              onClick={() => safeToggleExtra("camera")} />
            <MoreOptionRow
              label="啟用麥克風"
              sub="microphone (already on)"
              on={extras.mic}
              disabled
              onClick={() => {}} />
            <div className="cs-hand" style={{
              fontSize: 14, color: "var(--marker-red)",
              padding: "6px 12px 8px", borderTop: "1px dashed var(--line-strong)",
              background: "var(--paper-2)",
            }}>
              不勉強，能給多少給多少
            </div>
          </div>
        )}
      </div>

      {/* spacer */}
      <div style={{ flex: 1, minHeight: 12 }} />

      {/* view-status button (appears only after activation) */}
      <div style={{ height: 64, display: "flex", justifyContent: "center", alignItems: "center" }}>
        {active && (
          <button className="cs-btn" onClick={safeOpenBoard} style={{ animation: "cs-fadeup 0.5s both" }}>
            <span style={{
              display: "inline-block", width: 10, height: 10, background: "var(--marker-red)",
              transform: "rotate(45deg)",
            }} />
            查看狀態 / open command board
            <span className="cs-mono" style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }}>→</span>
          </button>
        )}
      </div>

      {/* bottom hand-stamp serial */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--line)",
      }}>
        <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", letterSpacing: 1 }}>
          YELP-FIELD-KIT · MVP · public civic tech
        </div>
        {active && <Stamp color="#1b4a82" rotate={-6} style={{ fontSize: 9 }}>LIVE</Stamp>}
      </div>
    </div>
  );
}

// =====================================================================
// COMMAND BOARD — the "查看狀態" screen / drawer-style
// =====================================================================
function CommandBoard({ onClose, onOpenJson, t, showPlaceholders }) {
  const [tab, setTab] = React.useState("status");

  return (
    <div className="cs-paper cs-scroll" style={{
      // z-index 10 ensures we cover MainScreen's inner decorations
      // (heartbeat wave / arrow scribbles) which set z-index: 1-3
      // without creating their own stacking context.
      position: "absolute", top: 58, left: 0, right: 0, bottom: 0, overflowY: "auto",
      zIndex: 10,
      display: "flex", flexDirection: "column",
      borderTop: "1px solid var(--line-strong)",
      animation: "cs-slideup 0.32s cubic-bezier(.2,.7,.2,1) both",
    }}>
      {/* board top bar — like manila folder tab */}
      <div style={{ position: "sticky", top: 0, zIndex: 5 }}>
        <div className="cs-header-bar" />
        <div style={{
          background: "var(--paper)", borderBottom: "1px solid var(--line-strong)",
          padding: "10px 14px 8px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <button onClick={onClose} style={{
            background: "transparent", border: "1.5px solid var(--ink)",
            width: 28, height: 24, fontFamily: "var(--f-mono)", fontSize: 14,
            cursor: "pointer", padding: 0,
          }}>×</button>
          <div>
            <div className="cs-stamp-font" style={{ fontSize: 16, color: "var(--ink)", letterSpacing: 0.5, lineHeight: 1 }}>
              COMMAND BOARD
            </div>
            <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", letterSpacing: 1, marginTop: 2 }}>
              求助資料流 / 現場板
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Stamp rotate={-2}>事件中</Stamp>
          </div>
        </div>

        {/* tabs as folder dividers */}
        <div style={{ display: "flex", gap: 0, background: "var(--paper-2)", borderBottom: "1px solid var(--line-strong)" }}>
          {[
            { k: "status",  l: "狀態板" },
            { k: "json",    l: "通報單" },
            { k: "modules", l: "未啟用" },
          ].map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: "10px 4px 9px",
              fontFamily: "var(--f-stamp)", fontSize: 13, letterSpacing: 1,
              background: tab === k ? "var(--paper)" : "transparent",
              color: tab === k ? "var(--ink)" : "var(--pencil)",
              border: "none",
              borderRight: "1px dashed var(--line-strong)",
              borderTop: tab === k ? "2px solid var(--marker-red)" : "2px solid transparent",
              cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* tab content */}
      <div style={{ padding: "8px 16px 24px" }}>
        {tab === "status"  && <BoardStatus t={t} onOpenJson={onOpenJson} />}
        {tab === "json"    && <BoardJson t={t} onOpenJson={onOpenJson} />}
        {tab === "modules" && <BoardModules showPlaceholders={showPlaceholders} />}
      </div>
    </div>
  );
}

// Parse the live jsonStr defensively. Falls back to {} so render never crashes
// mid-agent-call when the value is transiently invalid.
function parseAgentOutput(jsonStr) {
  if (!jsonStr) return {};
  try { return JSON.parse(jsonStr); } catch (e) { return {}; }
}

// human-readable dictionaries for chips
const HAZARD_ZH = {
  rising_water: "水位上升", blocked_exit: "出口受阻", power_outage: "停電",
  road_damage: "道路毀損", structural_collapse: "建物倒塌",
  gas_leak: "瓦斯外洩", landslide_debris: "土石流堆積物",
};
const NEED_ZH = {
  rescue: "救援", evacuation: "撤離", medical: "醫療",
  food_water: "食水", shelter: "庇護", information: "資訊", unknown: "未知",
};
const EVENT_TYPE_ZH = {
  flood: "淹水", earthquake: "地震", landslide: "山崩", fire: "火災",
  medical: "醫療", trapped: "受困", infrastructure_damage: "設施毀損", unknown: "未知",
};

// Small "AGENT" stamp that reflects current run state.
function AgentBadge({ agentState }) {
  if (!agentState) return null;
  const { status, model, elapsedMs, error, reason } = agentState;
  const map = {
    idle:    { color: "var(--pencil)",     label: "WAITING",  sub: "等候 SOS" },
    skipped: { color: "var(--pencil)",     label: "MOCK",     sub: reason === "no-key" ? "未設定 key" : "略過" },
    running: { color: "var(--warn)",       label: "RUNNING",  sub: "Agent 解析中…" },
    success: { color: "var(--ok)",         label: "LIVE",     sub: (model || "agent") + (elapsedMs ? " · " + (elapsedMs / 1000).toFixed(1) + "s" : "") },
    error:   { color: "var(--marker-red)", label: "ERR",      sub: (error || "").slice(0, 40) },
  };
  const c = map[status] || map.idle;
  return (
    <span title={status === "error" ? error : undefined} style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      border: "1.5px solid " + c.color, color: c.color,
      padding: "2px 8px", marginLeft: "auto",
      fontFamily: "var(--f-stamp)", letterSpacing: 1,
      lineHeight: 1.1, transform: "rotate(-2deg)",
      background: "rgba(241,234,216,0.7)",
    }}>
      <span style={{ fontSize: 10 }}>AGENT · {c.label}</span>
      <span className="cs-mono" style={{ fontSize: 8, opacity: 0.85, marginTop: 1 }}>{c.sub}</span>
    </span>
  );
}

// ----- tab 1: status -----
function BoardStatus({ t, onOpenJson }) {
  const data = parseAgentOutput(t.jsonStr);
  const eventType   = data.event_type      || "unknown";
  const hazards     = Array.isArray(data.hazards) ? data.hazards : [];
  const severity    = data.severity_level  != null ? data.severity_level  : null;
  const urgency     = data.urgency_level   != null ? data.urgency_level   : null;
  const panic       = data.panic_level     != null ? data.panic_level     : null;
  const priority    = data.priority_score  != null ? data.priority_score  : null;
  const confidence  = data.confidence      != null ? data.confidence      : null;
  const needs       = Array.isArray(data.needs) ? data.needs : [];
  const reporterSt  = data.reporter_status || "unknown";
  const people      = data.people || {};
  const flags       = (people.vulnerable_flags || {});
  const flagSummary = Object.keys(flags).filter(k => flags[k]).map(k => ({
    elderly: "長者", child: "孩童", mobility_issue: "行動不便", injured: "受傷", alone: "獨自",
  }[k])).filter(Boolean);

  return (
    <React.Fragment>
      {/* Section: event */}
      <SectionTitle num="01" sub="EVENT">事件狀態</SectionTitle>
      <div className="cs-card" style={{ padding: "12px 14px", marginBottom: 4, position: "relative" }}>
        <Tape color="red" style={{ left: 14, top: -10, transform: "rotate(-6deg)" }} />
        <FieldLine label="EVENT ID" value={<span className="cs-mono">{t.eventId}</span>}
          status={<Sticker kind="ok">已建立</Sticker>} time={"06:42:11"} />
        <FieldLine label="CREATED"  value={t.createdAt}
          status={<Sticker kind="sent">已送出</Sticker>} time={"+0.4s"} />
        <FieldLine label="LAST SYNC" value="06:42:18"
          status={<Sticker kind="read">已讀</Sticker>} time={"+7s, 後端確認"} />
        <FieldLine label="REVIEW"   value={<span style={{ color: "var(--warn)" }}>系統判讀信心略低</span>}
          status={<Sticker kind="warn">需複核</Sticker>} time="人工確認中" />
      </div>

      {/* Section: location (spec §3.location) */}
      <SectionTitle num="02" sub="LOCATION">位置狀態</SectionTitle>
      <div className="cs-card" style={{ padding: "12px 14px" }}>
        <FieldLine label="STATUS"   value={<span>已取得 GPS 位置</span>}
          status={<Sticker kind="sent">已送出</Sticker>} time={"06:42:14"} />
        <FieldLine label="LAT"      value={<span className="cs-mono">23.4012</span>} />
        <FieldLine label="LNG"      value={<span className="cs-mono">121.3104</span>} />
        <FieldLine label="RAW_TEXT" value={<span className="cs-hand" style={{ fontSize: 18, color: "var(--marker-red)" }}>low-lying riverside</span>} />
      </div>

      {/* Section: input sources — feeds INTO the Agent; not part of Agent output schema. */}
      <SectionTitle num="03" sub="INPUT SOURCES">輸入訊號來源</SectionTitle>
      <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginBottom: 4, lineHeight: 1.5 }}>
        // upstream of Agent · source_type = voice_transcript
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SignalCard name="文字訊息"   status="ok"   note="片段 ×3" />
        <SignalCard name="語音轉錄"   status="ok"   note="14.2s" />
        <SignalCard name="語音特徵"   status="sent" note="語速↑ 顫抖↑" />
        <SignalCard name="位置"      status="read" note="GPS 已讀" />
      </div>

      {/* Section: Agent JSON output summary (spec §3 — canonical Agent output) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 6px" }}>
        <span className="cs-mono" style={{ fontSize: 11, color: "var(--pencil)", letterSpacing: 1 }}>§ 04</span>
        <span className="cs-stamp-font" style={{ fontSize: 15, color: "var(--ink)", letterSpacing: 0.5 }}>災情情報 · 通報單摘要</span>
        <AgentBadge agentState={t.agentState} />
      </div>
      <div className="cs-card" style={{ padding: "12px 14px", position: "relative" }}>
        <Tape color="yellow" style={{ right: 18, top: -10, transform: "rotate(8deg)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 10, fontSize: 13 }}>
          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>EVENT</div>
          <div style={{ fontWeight: 600 }}>
            {EVENT_TYPE_ZH[eventType] || eventType}
            <span className="cs-hand" style={{ color: "var(--marker-red)", fontSize: 16, marginLeft: 4 }}>{eventType}</span>
          </div>

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>HAZARDS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {hazards.length === 0
              ? <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>
              : hazards.map(h => <Chip key={h} mono>{h}</Chip>)}
          </div>

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>SEVERITY</div>
          {severity != null
            ? <Meter value={severity} max={5} color="var(--marker-red)" suffix={severity + "/5"} />
            : <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>}

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>URGENCY</div>
          {urgency != null
            ? <Meter value={urgency} max={5} color="var(--marker-red)" suffix={urgency + "/5"} />
            : <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>}

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>PANIC</div>
          {panic != null
            ? <Meter value={panic} color="var(--marker-red)" suffix={panic.toFixed(2)} />
            : <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>}

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>PRIORITY</div>
          {priority != null
            ? <Meter value={priority} color="var(--marker-red)" suffix={priority.toFixed(2)} />
            : <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>}

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>CONFID.</div>
          {confidence != null
            ? <Meter value={confidence} color="var(--ok)" suffix={confidence.toFixed(2)} />
            : <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>}

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>NEEDS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {needs.length === 0
              ? <span style={{ color: "var(--pencil)", fontSize: 11 }}>—</span>
              : needs.map(n => <Chip key={n}>{NEED_ZH[n] || n}</Chip>)}
          </div>

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>REPORTER</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
            <Sticker kind={reporterSt === "safe" ? "ok" : reporterSt === "injured" || reporterSt === "trapped" ? "err" : "warn"}>
              {reporterSt}
            </Sticker>
            {(people.count != null || flagSummary.length > 0) && (
              <span className="cs-mono" style={{ color: "var(--pencil)", fontSize: 10 }}>
                {people.count != null ? "· " + people.count + " 人" : ""}
                {flagSummary.length > 0 ? " · 含 " + flagSummary.join("、") : ""}
              </span>
            )}
          </div>
        </div>
        <div className="cs-dashed" style={{ margin: "10px 0 8px" }} />
        <button onClick={onOpenJson} style={{
          width: "100%", background: "transparent",
          border: "1.5px dashed var(--ink)", padding: "8px 0",
          fontFamily: "var(--f-stamp)", fontSize: 12, letterSpacing: 1, cursor: "pointer",
        }}>
          展開完整 JSON 通報單 →
        </button>
      </div>
    </React.Fragment>
  );
}

function Meter({ value, max = 1, color = "var(--ok)", suffix }) {
  const pct = Math.min(1, value / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 10, background: "var(--paper-2)", border: "1px solid var(--line-strong)", position: "relative", overflow: "hidden" }}>
        <div style={{
          width: pct + "%", height: "100%", background: color,
          backgroundImage: "repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.18) 4px 8px)",
        }} />
      </div>
      <span className="cs-mono" style={{ fontSize: 11, color: "var(--pencil)", minWidth: 30, textAlign: "right" }}>{suffix}</span>
    </div>
  );
}

function Chip({ children, mono }) {
  return (
    <span style={{
      display: "inline-flex", padding: "2px 7px",
      border: "1px solid var(--line-strong)",
      background: "var(--paper-2)",
      fontFamily: mono ? "var(--f-mono)" : "var(--f-body)",
      fontSize: mono ? 11 : 12, fontWeight: mono ? 400 : 600,
      color: "var(--ink-soft)",
    }}>{children}</span>
  );
}

function SignalCard({ name, status, note }) {
  return (
    <div className="cs-card" style={{ padding: "8px 10px", position: "relative" }}>
      <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", letterSpacing: 1 }}>SIGNAL</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
        <Sticker kind={status} style={{ transform: "rotate(0deg)", fontSize: 9, padding: "1px 5px" }}>
          {status === "ok" ? "收集中" : status === "sent" ? "已送出" : status === "read" ? "已讀" : status}
        </Sticker>
      </div>
      <div className="cs-hand" style={{ fontSize: 15, color: "var(--marker-red)", marginTop: 4 }}>{note}</div>
    </div>
  );
}

// ----- tab 2: full JSON -----
function BoardJson({ t, onOpenJson }) {
  // sub-menu: 簡約 / 折衷 / RAW — each version is independent
  const [view, setView] = React.useState("slip");
  const views = [
    { k: "slip", l: "簡約",  sub: "SLIP" },
    { k: "md",   l: "折衷",  sub: "MD" },
    { k: "raw",  l: "原始",  sub: "RAW" },
  ];

  return (
    <React.Fragment>
      <SectionTitle num="—" sub={(views.find(v => v.k === view) || {}).sub}>
        通報單 / {view === "slip" ? "FIELD-FORMATTED" : view === "md" ? "MARKDOWN-FORMATTED" : "RAW JSON"}
      </SectionTitle>

      {/* sub-menu — segmented control on a tab-rail */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 10,
        border: "1.5px solid var(--ink)", background: "var(--paper-2)",
      }}>
        {views.map(({ k, l, sub }, i) => (
          <button key={k} onClick={() => setView(k)} style={{
            flex: 1, padding: "6px 4px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            background: view === k ? "var(--paper)" : "transparent",
            color: view === k ? "var(--ink)" : "var(--pencil)",
            borderRight: i < views.length - 1 ? "1px dashed var(--line-strong)" : "none",
            borderTop: view === k ? "3px solid var(--marker-red)" : "3px solid transparent",
            border: "none",
            borderLeft: "none",
            cursor: "pointer",
          }}>
            <span className="cs-stamp-font" style={{ fontSize: 13, letterSpacing: 1 }}>{l}</span>
            <span className="cs-mono" style={{ fontSize: 9, letterSpacing: 1 }}>{sub}</span>
          </button>
        ))}
      </div>

      {view === "slip" && <SlipView t={t} />}
      {view === "md"   && <MdView   t={t} />}
      {view === "raw"  && <RawView  t={t} />}

      {/* signoff — shared footer */}
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", letterSpacing: 1 }}>SIGNED</div>
          <div className="cs-hand" style={{ fontSize: 22, color: "var(--ink)", borderBottom: "1px solid var(--ink)", paddingBottom: 2 }}>
            Yelp / panic-signal-interpreter
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", letterSpacing: 1 }}>TIME</div>
          <div className="cs-mono" style={{ fontSize: 12 }}>{t.timeStr}</div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ----- sub-view 1/3: SLIP (簡約 form-formatted) -----
function SlipView({ t }) {
  return (
    <React.Fragment>
      {/* form-style intake header */}
      <div style={{
        border: "1.5px solid var(--ink)", background: "var(--paper-2)",
        padding: "0", position: "relative",
      }}>
        {/* punched holes column */}
        <div style={{ position: "absolute", left: 6, top: 8, bottom: 8, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 8 }}>
          <div className="cs-hole" /><div className="cs-hole" /><div className="cs-hole" />
        </div>

        <div style={{ padding: "10px 14px 8px 24px", borderBottom: "1.5px solid var(--ink)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="cs-stamp-font" style={{ fontSize: 14, letterSpacing: 1 }}>YELP REPORT SLIP</div>
            <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)" }}>NO. {t.eventId.toUpperCase()}</div>
          </div>
          <Stamp color="var(--ok)" rotate={4} style={{ fontSize: 10 }}>已送出</Stamp>
        </div>

        {/* check rows */}
        <div style={{ padding: "10px 14px 4px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 6, columnGap: 8 }}>
          <CheckRow checked>淹水 / flood</CheckRow>
          <CheckRow>地震</CheckRow>
          <CheckRow>火災</CheckRow>
          <CheckRow>受困</CheckRow>
          <CheckRow checked>有人行動不便</CheckRow>
          <CheckRow checked>需要救援</CheckRow>
        </div>

        <div className="cs-dashed" style={{ margin: "6px 14px 6px 24px" }} />

        {/* hand-written eyewitness */}
        <div style={{ padding: "4px 14px 10px 24px" }}>
          <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", letterSpacing: 1 }}>SOURCE EVIDENCE / 依據</div>
          <div className="cs-hand" style={{ fontSize: 19, color: "var(--ink)", lineHeight: 1.25, marginTop: 2 }}>
            「水一直進來，我爸不能走，拜託快點」
          </div>
          <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil-faint)", marginTop: 4 }}>
            → 重複「快點」×3 · 語速↑ · 提及行動不便者
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// ----- sub-view 2/3: MD (折衷 — markdown-styled, full coverage, themed tables) -----
function MdView({ t }) {
  // visible "markdown" syntax: ##, |---|, -, etc. monospace face + paper.
  // every JSON field is represented somewhere.
  return (
    <div style={{
      border: "1.5px solid var(--ink)", background: "var(--paper)",
      padding: "14px 14px 16px",
      fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 1.55,
      color: "var(--ink)", position: "relative",
      backgroundImage: "linear-gradient(transparent 0 23px, rgba(100,140,180,0.12) 23px 24px)",
      backgroundSize: "100% 24px",
    }}>
      <Stamp color="#1b4a82" rotate={-6} style={{ position: "absolute", right: 8, top: -8, fontSize: 9 }}>
        report.md
      </Stamp>

      {/* H1 */}
      <MdLine syntax="#" indent={0}>
        <span className="cs-stamp-font" style={{ fontSize: 18, letterSpacing: 0.5 }}>
          災情通報單 · {t.eventId}
        </span>
      </MdLine>
      <MdQuote>
        > 對應 yelp-agent-spec.md §3 · 每一段對應 Agent 輸出 JSON 的同名欄位。
      </MdQuote>

      {/* §1 標頭資訊 — source identity + raw input */}
      <MdH2>標頭資訊 <MdTag>source</MdTag></MdH2>
      <MdTable
        headers={["欄位", "值", "說明"]}
        rows={[
          ["event_id",    <code>{t.eventId}</code>,                          "本次通報唯一識別碼"],
          ["timestamp",   <code>2026-05-17T06:42:11+08:00</code>,             "事件建立時間 (ISO-8601)"],
          ["source_type", <MdBadge color="ok">voice_transcript</MdBadge>,    "資料來源類型"],
          ["raw_input",   <span className="cs-hand" style={{ fontSize: 16, color: "var(--marker-red)" }}>救命水一直進來我媽走不了快點快點</span>, "原始輸入，不可改寫"],
        ]}
      />

      {/* §2 位置 (spec.location) */}
      <MdH2>位置 <MdTag>location</MdTag></MdH2>
      <MdTable
        headers={["欄位", "值", "備註"]}
        rows={[
          ["lat",      <code>23.4012</code>,            ""],
          ["lng",      <code>121.3104</code>,           ""],
          ["raw_text", <span className="cs-hand" style={{ fontSize: 16, color: "var(--marker-red)" }}>low-lying riverside</span>, "現場描述 (低窪地帶 · 河邊)"],
        ]}
      />

      {/* §3 事件類型 + 危害 */}
      <MdH2>事件類型 <MdTag>event_type · hazards</MdTag></MdH2>
      <MdTable
        headers={["欄位", "值", "中文"]}
        rows={[
          ["event_type", <MdBadge color="red">flood</MdBadge>,                            "淹水"],
          ["hazards[0]", <code>rising_water</code>,                                       "水位上升"],
          ["hazards[1]", <code>blocked_exit</code>,                                       "出口受阻"],
        ]}
      />

      {/* §4 風險評估 */}
      <MdH2>風險評估 <MdTag>severity · urgency · panic · confidence · priority</MdTag></MdH2>
      <MdTable
        headers={["欄位", "值", "意義"]}
        rows={[
          ["severity_level", <span><b>4</b> / 5</span>,                  "嚴重程度 (1-5)"],
          ["urgency_level",  <span><b>5</b> / 5</span>,                  "急迫度 (1-5)"],
          ["panic_level",    <MdBadge color="red">0.86</MdBadge>,         "報案者慌張程度 (0-1)"],
          ["confidence",     <MdBadge color="warn">0.72</MdBadge>,        "系統判讀信心 (0-1)"],
          ["priority_score", <MdBadge color="red">0.94</MdBadge>,         "派遣優先分數 (0-1)"],
        ]}
      />

      {/* §5 通報者狀態 + 人員 */}
      <MdH2>通報者與人員 <MdTag>reporter_status · people</MdTag></MdH2>
      <MdTable
        headers={["欄位", "值", "說明"]}
        rows={[
          ["reporter_status",    <MdBadge color="warn">unknown</MdBadge>, "通報者本人狀態不明"],
          ["people.count",       <code>2</code>,                          "現場人數估計"],
        ]}
      />
      <MdSub>↳ people.vulnerable_flags</MdSub>
      <MdTable
        headers={["旗標", "值", "意義"]}
        rows={[
          ["elderly",        <MdBadge color="off">false</MdBadge>, "現場有長者"],
          ["child",          <MdBadge color="off">false</MdBadge>, "現場有孩童"],
          ["mobility_issue", <MdBadge color="ok">true</MdBadge>,    "行動不便者在場 (「我媽走不了」)"],
          ["injured",        <MdBadge color="off">false</MdBadge>, "已知受傷"],
          ["alone",          <MdBadge color="off">false</MdBadge>, "單獨一人"],
        ]}
      />

      {/* §6 需求 */}
      <MdH2>需求 <MdTag>needs</MdTag></MdH2>
      <MdList items={[
        ["rescue",     "救援"],
        ["evacuation", "撤離"],
      ]} />

      {/* §7 判讀依據 (spec.evidence — object 對應推論欄位) */}
      <MdH2>判讀依據 <MdTag>evidence</MdTag></MdH2>
      <MdTable
        headers={["推論欄位", "依據原文", "說明"]}
        rows={[
          ["event_type",     <span className="cs-hand" style={{ fontSize: 14, color: "var(--marker-red)" }}>水一直進來</span>,         "為何判斷是淹水"],
          ["severity_level", <span className="cs-hand" style={{ fontSize: 14, color: "var(--marker-red)" }}>水一直進來、快點快點</span>, "為何 4/5"],
          ["panic_level",    <span className="cs-hand" style={{ fontSize: 14, color: "var(--marker-red)" }}>救命、快點快點、語句急促</span>, "為何 0.86"],
          ["needs",          <span className="cs-hand" style={{ fontSize: 14, color: "var(--marker-red)" }}>我媽走不了</span>,         "為何需要 rescue + evacuation"],
        ]}
      />

      {/* §8 缺漏資訊 */}
      <MdH2>缺漏資訊 <MdTag>missing_information</MdTag></MdH2>
      <MdList items={[
        ["exact_location",       "精確地址"],
        ["injury_status",        "傷勢狀況"],
        ["reporter_self_status", "通報者本人是否安全"],
      ]} />

      {/* §9 建議下一步 */}
      <MdH2>建議下一步 <MdTag>recommended_next_action</MdTag></MdH2>
      <MdLine syntax="→" indent={0}>
        <span className="cs-hand" style={{ fontSize: 16, color: "var(--marker-red)" }}>
          優先確認定位並派送撤離支援
        </span>
      </MdLine>

      {/* end marker — replaces old status section (not in new schema) */}
      <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginTop: 14, paddingTop: 8, borderTop: "1px dashed var(--line-strong)" }}>
        ---<br/>
        // 完整對應 yelp-agent-spec.md §3 schema
      </div>
    </div>
  );
}

// ---- markdown-look atoms ----
function MdH2({ children }) {
  return (
    <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
      <span style={{ color: "var(--marker-red)", fontWeight: 700 }}>##</span>
      <span className="cs-stamp-font" style={{ fontSize: 14, letterSpacing: 0.5, color: "var(--ink)" }}>{children}</span>
    </div>
  );
}
function MdSub({ children }) {
  return (
    <div style={{ margin: "8px 0 2px", color: "var(--pencil)", fontSize: 11 }}>
      <span style={{ color: "var(--marker-red)" }}>###</span> {children}
    </div>
  );
}
function MdTag({ children }) {
  return (
    <code style={{
      fontSize: 10, color: "var(--pencil)",
      background: "var(--paper-2)", padding: "1px 5px",
      border: "1px solid var(--line-strong)",
    }}>`{children}`</code>
  );
}
function MdQuote({ children }) {
  return (
    <div style={{
      margin: "4px 0 8px", padding: "4px 8px",
      borderLeft: "3px solid var(--pencil)",
      color: "var(--ink-soft)", fontSize: 11,
      background: "var(--paper-2)",
    }}>{children}</div>
  );
}
function MdLine({ syntax = "-", indent = 0, children }) {
  return (
    <div style={{ display: "flex", gap: 6, paddingLeft: indent * 12, margin: "2px 0" }}>
      <span style={{ color: "var(--marker-red)", flex: "0 0 auto" }}>{syntax}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}
function MdBadge({ color = "ok", children }) {
  const map = {
    ok:   { bg: "rgba(74,124,69,0.18)",  bd: "var(--ok)",          fg: "var(--ok)" },
    warn: { bg: "rgba(176,123,31,0.18)", bd: "var(--warn)",        fg: "var(--warn)" },
    red:  { bg: "rgba(200,51,44,0.15)",  bd: "var(--marker-red)",  fg: "var(--marker-red)" },
    off:  { bg: "var(--paper-2)",        bd: "var(--line-strong)", fg: "var(--pencil)" },
  };
  const c = map[color] || map.ok;
  return (
    <span style={{
      display: "inline-block", padding: "0 6px",
      background: c.bg, border: "1px solid " + c.bd, color: c.fg,
      fontFamily: "var(--f-mono)", fontSize: 11, fontWeight: 700,
    }}>{children}</span>
  );
}
function MdList({ items, ordered }) {
  return (
    <div style={{ margin: "2px 0 4px" }}>
      {items.map(([k, zh], i) => (
        <div key={k} style={{ display: "flex", gap: 6, margin: "2px 0", paddingLeft: 4 }}>
          <span style={{ color: "var(--marker-red)", flex: "0 0 auto", minWidth: 14 }}>
            {ordered ? (i + 1) + "." : "-"}
          </span>
          <span style={{ flex: 1 }}>
            <code>{k}</code>
            <span style={{ color: "var(--pencil)", marginLeft: 8 }}>— {zh}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
function MdTable({ headers, rows }) {
  // visible "| --- |" markdown-style table, rendered properly as a grid
  const cols = headers.length;
  const gridCols = cols === 3
    ? "minmax(110px,auto) minmax(110px,auto) 1fr"
    : `repeat(${cols}, 1fr)`;
  return (
    <div style={{
      margin: "4px 0 6px",
      border: "1px solid var(--line-strong)",
      background: "var(--paper-2)",
      overflow: "hidden",
    }}>
      {/* header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: gridCols,
        background: "var(--paper-3)",
        borderBottom: "1px solid var(--ink)",
      }}>
        {headers.map((h, i) => (
          <div key={i} style={{
            padding: "5px 8px",
            borderRight: i < cols - 1 ? "1px dashed var(--line-strong)" : "none",
            fontWeight: 700, fontSize: 11, color: "var(--ink)",
            letterSpacing: 0.5,
          }}>
            <span style={{ color: "var(--pencil)" }}>| </span>{h}
          </div>
        ))}
      </div>
      {/* md-style separator line, decorative */}
      <div style={{
        padding: "1px 8px", fontSize: 10, color: "var(--pencil)",
        borderBottom: "1px dashed var(--line-strong)", background: "var(--paper-2)",
      }}>
        {Array.from({ length: cols }, (_, i) => "|---" ).join("")}|
      </div>
      {/* data rows */}
      {rows.map((r, ri) => (
        <div key={ri} style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          borderBottom: ri < rows.length - 1 ? "1px dashed var(--line-strong)" : "none",
          background: ri % 2 ? "rgba(255,255,255,0.25)" : "transparent",
        }}>
          {r.map((cell, ci) => (
            <div key={ci} style={{
              padding: "4px 8px",
              borderRight: ci < cols - 1 ? "1px dashed var(--line-strong)" : "none",
              fontSize: 12, color: "var(--ink)", wordBreak: "break-word",
            }}>
              <span style={{ color: "var(--pencil)" }}>| </span>{cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ----- sub-view 3/3: RAW (原始 JSON) -----
function RawView({ t }) {
  const j = t.jsonStr;
  return (
    <div style={{ position: "relative" }}>
      <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", letterSpacing: 1, marginBottom: 4 }}>
        ▸ RAW · disaster_event.json
      </div>
      <pre className="cs-mono" style={{
        margin: 0, padding: "14px 14px 14px 16px",
        background: "var(--paper)",
        border: "1.5px solid var(--ink)",
        fontSize: 11, lineHeight: 1.55,
        color: "var(--ink)",
        whiteSpace: "pre-wrap", wordBreak: "break-all",
        position: "relative",
        backgroundImage: "linear-gradient(transparent 0 21px, rgba(100,140,180,0.18) 21px 22px)",
        backgroundSize: "100% 22px",
      }}>{j}</pre>
      <Stamp color="#1b4a82" rotate={-8} style={{ position: "absolute", right: 8, top: -4, fontSize: 9 }}>
        ready · v1
      </Stamp>
    </div>
  );
}

function CheckRow({ children, checked }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className={"cs-check" + (checked ? " checked" : "")} />
      <span style={{ fontSize: 13, color: checked ? "var(--ink)" : "var(--pencil)" }}>{children}</span>
    </div>
  );
}

// ----- tab 3: modules / placeholders -----
function BoardModules({ showPlaceholders }) {
  return (
    <React.Fragment>
      <SectionTitle num="—" sub="ROADMAP">尚未啟用模組</SectionTitle>
      <div className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginBottom: 10, lineHeight: 1.5 }}>
        // 第一版先以 placeholder 呈現；
        // 待事件穩定後可在進階輸入頁開啟。
      </div>

      <ModuleCard num="04.1" title="手勢語意輸入" tag="gesture board" disabled>
        <div style={{
          height: 100, border: "1.5px dashed var(--line-strong)", background: "var(--paper)",
          position: "relative", marginTop: 6,
          backgroundImage: "linear-gradient(rgba(26,24,20,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(26,24,20,0.05) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}>
          <svg width="100%" height="100%" viewBox="0 0 220 100" preserveAspectRatio="none">
            <path d="M20 40 L40 60 L60 30 L80 60 L100 25 L120 55 L140 35"
              stroke="var(--ink)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          </svg>
          <span className="cs-mono" style={{ position: "absolute", right: 8, bottom: 4, fontSize: 9, color: "var(--pencil)" }}>
            鋸齒線 → 可能為地震線索
          </span>
        </div>
      </ModuleCard>

      <ModuleCard num="04.2" title="積木式正式回報" tag="blocks intake" disabled>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {["現在","因為","淹水","受困","行動不便","救援"].map((b, i) => (
            <span key={i} style={{
              padding: "4px 10px", background: "var(--highlight)",
              border: "1.5px solid var(--ink)", fontFamily: "var(--f-body)", fontWeight: 700, fontSize: 12,
              boxShadow: "2px 2px 0 var(--ink)",
              transform: `rotate(${(i % 3 - 1) * 1.5}deg)`,
            }}>{b}</span>
          ))}
        </div>
        <div className="cs-mono" style={{ fontSize: 9, color: "var(--pencil)", marginTop: 6 }}>
          drag 任意順序 → 系統整理為災情 JSON
        </div>
      </ModuleCard>

      <ModuleCard num="04.3" title="LLM 判讀摘要" tag="reasoning trace" disabled>
        <div style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.55, marginTop: 4 }}>
          推測事件：<b style={{ color: "var(--ink)" }}>淹水</b><br/>
          主要依據：文字多次提到「水進來」<br/>
          需要複核：是否有人受困、是否需醫療<br/>
          建議下一步：標記高優先 → 救援派遣
        </div>
      </ModuleCard>

      {/* roadmap arrow */}
      <div style={{ textAlign: "center", marginTop: 14 }}>
        <span className="cs-hand" style={{ fontSize: 18, color: "var(--marker-red)" }}>
          ↑ 都是可堆疊的下一階段 ↑
        </span>
      </div>
    </React.Fragment>
  );
}

function ModuleCard({ num, title, tag, children, disabled }) {
  return (
    <div className="cs-card" style={{
      padding: "10px 12px", marginBottom: 10, position: "relative",
      opacity: disabled ? 0.92 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)" }}>{num}</span>
        <span className="cs-stamp-font" style={{ fontSize: 13, color: "var(--ink)", letterSpacing: 0.5 }}>{title}</span>
        <span className="cs-mono" style={{ fontSize: 10, color: "var(--pencil)", marginLeft: "auto" }}>{tag}</span>
      </div>
      {disabled && (
        <Stamp color="var(--pencil)" rotate={8} style={{
          position: "absolute", right: 10, top: -8, fontSize: 9, background: "var(--paper)",
        }}>
          尚未啟用
        </Stamp>
      )}
      {children}
    </div>
  );
}

Object.assign(window, {
  MainScreen, CommandBoard,
});
