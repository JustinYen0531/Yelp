// yelp-app.jsx — main app: state + tweaks + frame

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "paper_intensity": 0.55,
  "auto_open_board": true,
  "skip_intro": false,
  "show_operator_pane": false,
  "low_load": false,
  "accent": "#c8332c",
  "speech_enabled": true,
  "speech_muted": false,
  "speech_dry_run": false
}/*EDITMODE-END*/;

// Conforms to yelp-agent-spec.md §3. This is the canonical Agent OUTPUT.
const JSON_BLOB = `{
  "event_id": "evt_06420f",
  "timestamp": "2026-05-17T06:42:11+08:00",
  "source_type": "voice_transcript",
  "raw_input": "救命水一直進來我媽走不了快點快點",
  "location": {
    "lat": 23.4012,
    "lng": 121.3104,
    "raw_text": "low-lying riverside"
  },
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
}`;

const SPEECH_LINES = [
  "\u5df2\u6536\u5230\u4f60\u7684\u8a0a\u865f\u3002",
  "\u6b63\u5728\u50b3\u9001\u4f4d\u7f6e\u3002",
  "\u6b63\u5728\u5206\u6790\u707d\u60c5\u3002",
  "\u5df2\u5efa\u7acb\u707d\u60c5\u4e8b\u4ef6\u3002",
  "\u5df2\u9001\u51fa\u6c42\u52a9\u8acb\u6c42\u3002",
  "\u8acb\u4fdd\u6301\u5b89\u5168\uff0c\u7b49\u5f85\u56de\u61c9\u3002",
];

function useSpeechGuide({ enabled, muted, dryRun }) {
  const supported = typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance !== "undefined";
  const spokenStepsRef = React.useRef({});
  const [speechState, setSpeechState] = React.useState({
    supported,
    enabled,
    muted,
    dryRun,
    speaking: false,
    voiceName: "",
    lastText: "",
    lastStep: null,
    lastMode: null,
    error: "",
    history: [],
  });

  React.useEffect(() => {
    setSpeechState((s) => ({ ...s, supported, enabled, muted, dryRun }));
  }, [supported, enabled, muted, dryRun]);

  React.useEffect(() => {
    if (!supported) return;
    const syncVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => /^zh[-_]TW$/i.test(v.lang))
        || voices.find((v) => /^zh/i.test(v.lang))
        || voices[0]
        || null;
      setSpeechState((s) => ({ ...s, voiceName: preferred ? preferred.name : s.voiceName }));
    };
    syncVoice();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", syncVoice);
  }, [supported]);

  const remember = React.useCallback((index, text, mode, error) => {
    setSpeechState((s) => ({
      ...s,
      lastText: text,
      lastStep: index,
      lastMode: mode,
      error: error || "",
      history: [{ index, text, mode, at: new Date().toTimeString().slice(0, 8) }].concat(s.history).slice(0, 6),
    }));
  }, []);

  const reset = React.useCallback(() => {
    spokenStepsRef.current = {};
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setSpeechState((s) => ({
      ...s,
      speaking: false,
      lastText: "",
      lastStep: null,
      lastMode: null,
      error: "",
      history: [],
    }));
  }, [supported]);

  const speakStep = React.useCallback((index) => {
    const text = SPEECH_LINES[index] || "";
    if (!text || spokenStepsRef.current[index]) return;
    spokenStepsRef.current[index] = true;

    if (!enabled) return remember(index, text, "disabled");
    if (muted) return remember(index, text, "muted");
    if (dryRun) return remember(index, text, "dry-run");
    if (!supported) return remember(index, text, "unsupported", "SpeechSynthesis unavailable");

    try { window.speechSynthesis.cancel(); } catch (e) {}
    const utter = new window.SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) => /^zh[-_]TW$/i.test(v.lang))
      || voices.find((v) => /^zh/i.test(v.lang))
      || null;
    if (preferred) utter.voice = preferred;
    utter.lang = preferred && preferred.lang ? preferred.lang : "zh-TW";
    utter.rate = 0.92;
    utter.pitch = 1;
    utter.volume = 1;
    utter.onstart = () => {
      setSpeechState((s) => ({ ...s, speaking: true, error: "", voiceName: preferred ? preferred.name : s.voiceName }));
      remember(index, text, "spoken");
    };
    utter.onend = () => setSpeechState((s) => ({ ...s, speaking: false }));
    utter.onerror = (ev) => {
      setSpeechState((s) => ({ ...s, speaking: false, error: ev && ev.error ? ev.error : "speech error" }));
      remember(index, text, "error", ev && ev.error ? ev.error : "speech error");
    };
    window.speechSynthesis.speak(utter);
  }, [dryRun, enabled, muted, remember, supported]);

  return { speechState, speakStep, reset };
}

function YelpApp() {
  const [t, setTweak] = useTweaks(DEFAULT_TWEAKS);
  const [phase, setPhase] = React.useState(t.skip_intro ? "active" : "idle");
  const [board, setBoard] = React.useState(t.skip_intro && t.auto_open_board ? "open" : "closed");
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const lastTapRef = React.useRef(0);

  // ── Agent state ──
  // jsonStr: live JSON shown by all views. Starts as mock JSON_BLOB;
  // replaced by real Agent output once OpenRouter returns successfully.
  // agentState: { status: "idle" | "skipped" | "running" | "success" | "error",
  //               reason?, error?, model?, elapsedMs?, usage? }
  const [jsonStr,    setJsonStr]    = React.useState(JSON_BLOB);
  const [agentState, setAgentState] = React.useState({ status: "idle" });
  const agentAbortRef = React.useRef(null);
  const speech = useSpeechGuide({
    enabled: !!t.speech_enabled,
    muted: !!t.speech_muted,
    dryRun: !!t.speech_dry_run,
  });

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
    jsonStr,
    agentState,
    speechState: speech.speechState,
  };

  // Fire Agent once when phase transitions to "active".
  // Uses raw_input + source_type + location from the mock JSON_BLOB as input
  // (in a real deployment these come from the captured audio/text/GPS).
  React.useEffect(() => {
    if (phase !== "active") return;
    if (agentState.status !== "idle") return;
    if (!window.YelpAgent) {
      setAgentState({ status: "skipped", reason: "agent-not-loaded" });
      return;
    }
    if (!window.YelpAgent.hasKey()) {
      setAgentState({ status: "skipped", reason: "no-key" });
      return;
    }

    let initial;
    try { initial = JSON.parse(JSON_BLOB); }
    catch (e) { setAgentState({ status: "error", error: "mock JSON_BLOB parse failed" }); return; }

    const abort = new AbortController();
    agentAbortRef.current = abort;
    setAgentState({ status: "running" });

    window.YelpAgent.runAgent({
      rawInput:   initial.raw_input,
      sourceType: initial.source_type,
      eventId:    initial.event_id,
      location:   initial.location,
      signal:     abort.signal,
    }).then(({ parsed, usage, model, elapsedMs }) => {
      setJsonStr(JSON.stringify(parsed, null, 2));
      setAgentState({ status: "success", usage, model, elapsedMs });
    }).catch((err) => {
      // AbortError happens on reset() — silent
      if (err && err.name === "AbortError") return;
      console.warn("[yelp-agent]", err);
      setAgentState({ status: "error", error: err.message || String(err) });
    });
  }, [phase, agentState.status]);

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
    // abort any in-flight Agent call
    if (agentAbortRef.current) { try { agentAbortRef.current.abort(); } catch (e) {} agentAbortRef.current = null; }
    speech.reset();
    setBoard("closed");
    setJsonOpen(false);
    setPhase("idle");
    setJsonStr(JSON_BLOB);
    setAgentState({ status: "idle" });
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
      minWidth: t.show_operator_pane ? 1300 : 520,
      width: "max-content", margin: "0 auto",
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 22, padding: "32px 24px 60px",
      position: "relative",
    }}>
      {!t.show_operator_pane && <StationBackdrop />}
      <RoleSwitcher
        role={t.show_operator_pane ? "responder" : "victim"}
        setRole={(r) => setTweak("show_operator_pane", r === "responder")}
        lowLoad={t.low_load}
        setLowLoad={(v) => setTweak("low_load", v)}
      />

      {t.show_operator_pane ? (
        <ResponderConsole ctx={ctx} phase={phase} reset={reset} jsonStr={jsonStr}>
          <IOSDevice width={340} height={740}>
            <div style={{ height: "100%", position: "relative", background: "var(--paper)" }}>
              <MainScreen
                phase={phase}
                onPress={press}
                onOpenBoard={() => setBoard("open")}
                t={ctx}
                lowLoad={t.low_load}
                readOnly
                speechState={speech.speechState}
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
        </ResponderConsole>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <IOSDevice width={402} height={874}>
            <div style={{ height: "100%", position: "relative", background: "var(--paper)" }}>
              <MainScreen
                phase={phase}
                onPress={press}
                onOpenBoard={() => setBoard("open")}
                t={ctx}
                lowLoad={t.low_load}
                speechState={speech.speechState}
                onLifecycleSpeak={speech.speakStep}
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
        </div>
      )}
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
        <TweakSection label="Speech">
          <TweakToggle label="Speech feedback" value={t.speech_enabled} onChange={(v) => setTweak("speech_enabled", v)} />
          <TweakToggle label="Mute speech" value={t.speech_muted} onChange={(v) => setTweak("speech_muted", v)} />
          <TweakToggle label="Dry-run only" value={t.speech_dry_run} onChange={(v) => setTweak("speech_dry_run", v)} />
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

// fade-up keyframes available globally
const styleNode = document.createElement("style");
styleNode.textContent = `
  @keyframes cs-fadeup { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes cs-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;
document.head.appendChild(styleNode);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<YelpApp />);
