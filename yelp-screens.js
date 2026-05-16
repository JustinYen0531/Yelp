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

function MainScreen({ phase, onPress, onOpenBoard, t, lowLoad }) {
  // phase: 'idle' | 'pressing' | 'active' | 'calling' | 'connected'
  const active    = phase === "active" || phase === "calling" || phase === "connected";
  const calling   = phase === "calling";
  const connected = phase === "connected";
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [extras, setExtras] = React.useState({ screen: false, camera: false, mic: true });
  const moreRef = React.useRef(null);

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
          className={"cs-sos" + (active ? " active" : "")}
          onClick={onPress}
          aria-label="發出求助">
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24, flexWrap: "wrap" }}>
          {active ? (
            <React.Fragment>
              <Sticker kind="ok">已建立</Sticker>
              <Sticker kind="sent">已送出位置</Sticker>
              <span className="cs-hand" style={{ fontSize: 16, color: "var(--ink)" }}>整理求助資訊中</span>
              <span className="cs-dots" style={{ marginLeft: "auto" }}><span/><span/><span/></span>
            </React.Fragment>
          ) : (
            <span className="cs-hand" style={{ fontSize: 18, color: "var(--ink-soft)" }}>
              準備好建立求助事件
            </span>
          )}
        </div>

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
              onClick={() => toggleExtra("screen")} />
            <MoreOptionRow
              label="啟用相機"
              sub="camera feed"
              on={extras.camera}
              onClick={() => toggleExtra("camera")} />
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
          <button className="cs-btn" onClick={onOpenBoard} style={{ animation: "cs-fadeup 0.5s both" }}>
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
      position: "absolute", top: 58, left: 0, right: 0, bottom: 0, overflowY: "auto",
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

// ----- tab 1: status -----
function BoardStatus({ t, onOpenJson }) {
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

      {/* Section: location */}
      <SectionTitle num="02" sub="LOCATION">位置狀態</SectionTitle>
      <div className="cs-card" style={{ padding: "12px 14px" }}>
        <FieldLine label="STATUS" value={<span>已取得 GPS 位置</span>}
          status={<Sticker kind="sent">已送出</Sticker>} time={"06:42:14"} />
        <FieldLine label="LAT"  value={<span className="cs-mono">23.4012</span>} />
        <FieldLine label="LNG"  value={<span className="cs-mono">121.3104</span>} />
        <FieldLine label="ACC"  value="±18 m" />
        <FieldLine label="NOTE" value={<span className="cs-hand" style={{ fontSize: 18, color: "var(--marker-red)" }}>低窪地帶 · 河邊</span>} />
      </div>

      {/* Section: signals */}
      <SectionTitle num="03" sub="SIGNALS">訊號來源</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SignalCard name="文字訊息"   status="ok"   note="片段 ×3" />
        <SignalCard name="語音轉錄"   status="ok"   note="14.2s" />
        <SignalCard name="語音特徵"   status="sent" note="語速↑ 顫抖↑" />
        <SignalCard name="位置"      status="read" note="GPS 已讀" />
      </div>

      {/* Section: JSON summary */}
      <SectionTitle num="04" sub="JSON">災情情報 · 通報單摘要</SectionTitle>
      <div className="cs-card" style={{ padding: "12px 14px", position: "relative" }}>
        <Tape color="yellow" style={{ right: 18, top: -10, transform: "rotate(8deg)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 10, fontSize: 13 }}>
          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>EVENT</div>
          <div style={{ fontWeight: 600 }}>淹水 <span className="cs-hand" style={{ color: "var(--marker-red)", fontSize: 16, marginLeft: 4 }}>flood</span></div>

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>SEVERITY</div>
          <Meter value={4} max={5} color="var(--marker-red)" suffix="/5" />

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>PANIC</div>
          <Meter value={0.86} color="var(--marker-red)" suffix="0.86" />

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>CONFID.</div>
          <Meter value={0.72} color="var(--ok)" suffix="0.72" />

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>NEEDS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Chip>救援</Chip><Chip>行動協助</Chip><Chip>醫療</Chip>
          </div>

          <div className="cs-mono" style={{ color: "var(--pencil)", fontSize: 11 }}>TARGETS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <Chip mono>rescue_dispatch</Chip><Chip mono>medical_support</Chip><Chip mono>flood_hotspot_map</Chip>
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
  const j = t.jsonStr;
  return (
    <React.Fragment>
      <SectionTitle num="—" sub="REPORT-SLIP">通報單 / FIELD-FORMATTED</SectionTitle>

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

      {/* the raw JSON, typed up */}
      <div style={{ marginTop: 14, position: "relative" }}>
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

      {/* signoff */}
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
