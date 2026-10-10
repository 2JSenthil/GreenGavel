"use client";

import { FileText, Folder, Leaf, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BootScreen from "./BootScreen";
import PreviewApp from "./PreviewApp";
import RecordsApp from "./RecordsApp";
import TalkApp, { TalkOrb } from "./TalkApp";
import { PreviewProvider, type PreviewDoc } from "./preview";

type WindowMode = "open" | "min" | "max";
type TalkMode = "closed" | "open" | "min";
type RecordsMode = "closed" | "open" | "min" | "max";
type PreviewMode = "closed" | "open" | "min";
type Frame = { x: number; y: number; w: number; h: number };
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const TASKBAR = 60;

export default function Desktop({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState<WindowMode>("open");
  const [talkMode, setTalkMode] = useState<TalkMode>("closed");
  const [recordsMode, setRecordsMode] = useState<RecordsMode>("closed");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("closed");
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [startQuery, setStartQuery] = useState("");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [talkFrame, setTalkFrame] = useState<Frame | null>(null);
  const [recordsFrame, setRecordsFrame] = useState<Frame | null>(null);
  const [previewFrame, setPreviewFrame] = useState<Frame | null>(null);
  const [ready, setReady] = useState(false);
  const screenRef = useRef<HTMLElement>(null);
  const talkRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const startMenuRef = useRef<HTMLDivElement>(null);
  const startSearchRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    kind: "move" | "resize";
    target: "gavel" | "talk" | "records" | "preview";
    edge: Edge | "";
    startX: number;
    startY: number;
    orig: Frame;
  } | null>(null);

  useEffect(() => {
    setReady(true);
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setDate(now.toLocaleDateString([], { month: "short", day: "numeric" }));
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!startOpen) return;
    startSearchRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setStartOpen(false);
      startBtnRef.current?.focus();
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (startMenuRef.current?.contains(target)) return;
      if (startBtnRef.current?.contains(target)) return;
      setStartOpen(false);
      startBtnRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [startOpen]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (drag.kind === "move") {
        const moved = { ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy };
        const next = drag.target === "gavel" ? clampFrame(moved) : clampMove(moved);
        if (drag.target === "talk") setTalkFrame(next);
        else if (drag.target === "records") setRecordsFrame(next);
        else if (drag.target === "preview") setPreviewFrame(next);
        else setFrame(next);
        return;
      }
      const next = clampFrame(resized(drag.edge, drag.orig, dx, dy));
      if (drag.target === "records") setRecordsFrame(next);
      else if (drag.target === "preview") setPreviewFrame(next);
      else setFrame(next);
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function openAnd(run?: () => void) {
    setNote("");
    setMode("open");
    if (!run) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
  }

  function focusAsk() {
    document.querySelector<HTMLInputElement>(".ask-input")?.focus();
  }

  function runStart(open: () => void) {
    setStartOpen(false);
    open();
  }

  const startApps = [
    { name: "Chat", icon: <ChatOrb />, open: () => openAnd(focusAsk) },
    { name: "Talk", icon: <TalkOrb />, open: () => setTalkMode("open") },
    { name: "Records", icon: <RecordsOrb />, open: () => setRecordsMode("open") },
    { name: "Preview", icon: <PreviewOrb />, open: () => setPreviewMode("open") },
  ];
  const startNeedle = startQuery.trim().toLowerCase();
  const startMatches = startApps.filter((app) => app.name.toLowerCase().includes(startNeedle));

  function submitStart(event: FormEvent) {
    event.preventDefault();
    if (startMatches.length === 0) {
      runStart(() => openAnd(focusAsk));
      return;
    }
    runStart(startMatches[0].open);
  }

  const startMenu = (
    <div ref={startMenuRef} id="start-menu" className="start-menu" role="dialog" aria-label="Start">
      <div className="start-main">
        <div className="start-head">
          <span className="gavel-orb start-portrait">
            <Leaf className="gavel-mark" aria-hidden="true" color="#ffffff" strokeWidth={2.4} />
          </span>
          <div>
            <p className="start-name">Green Gavel</p>
            <p className="start-tag">Chapel Hill records</p>
          </div>
        </div>
        <form onSubmit={submitStart}>
          <input
            ref={startSearchRef}
            className="ask-input start-search"
            value={startQuery}
            onChange={(event) => setStartQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search apps"
          />
        </form>
        <ul className="start-apps">
          {startMatches.map((app) => (
            <li key={app.name}>
              <button type="button" className="start-app" onClick={() => runStart(app.open)}>
                {app.icon}
                {app.name}
              </button>
            </li>
          ))}
          {startMatches.length === 0 ? (
            <li>
              <button type="button" className="start-app" onClick={() => runStart(() => openAnd(focusAsk))}>
                <ChatOrb />
                Ask in Chat
              </button>
            </li>
          ) : null}
        </ul>
      </div>
      <aside className="start-side">
        <h2 className="start-side-title">Meetings</h2>
        <p className="start-side-copy">Town council meetings and agenda links will appear here.</p>
        <button
          type="button"
          className="gel-btn"
          onClick={() =>
            runStart(() => openAnd(() => document.getElementById("meetings")?.scrollIntoView({ block: "nearest" })))
          }
        >
          <span className="gel-label">Open meetings</span>
        </button>
      </aside>
    </div>
  );

  function readFrame(): Frame {
    const rect = screenRef.current?.getBoundingClientRect();
    if (!rect) return { x: 80, y: 24, w: 960, h: 640 };
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  function beginMove(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const orig = mode === "max" ? restoredFrame(event.clientX, event.clientY) : (frame ?? readFrame());
    if (mode === "max") setMode("open");
    setFrame(orig);
    dragRef.current = { kind: "move", target: "gavel", edge: "", startX: event.clientX, startY: event.clientY, orig };
  }

  function readTalkFrame(): Frame {
    const rect = talkRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 40) {
      const w = Math.min(640, window.innerWidth - 150);
      const h = Math.min(680, window.innerHeight - 120);
      return { x: Math.max(16, window.innerWidth - w - 24), y: 72, w, h };
    }
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  function beginTalkMove(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const orig = talkFrame ?? readTalkFrame();
    setTalkFrame(orig);
    dragRef.current = { kind: "move", target: "talk", edge: "", startX: event.clientX, startY: event.clientY, orig };
  }

  function readRecordsFrame(): Frame {
    const rect = recordsRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 40 || recordsMode === "max") {
      const w = Math.min(1080, window.innerWidth - 150);
      const h = Math.min(760, window.innerHeight - 100);
      return { x: 120, y: 24, w, h };
    }
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  function beginRecordsMove(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const orig = recordsMode === "max" ? readRecordsFrame() : (recordsFrame ?? readRecordsFrame());
    if (recordsMode === "max") setRecordsMode("open");
    setRecordsFrame(orig);
    dragRef.current = { kind: "move", target: "records", edge: "", startX: event.clientX, startY: event.clientY, orig };
  }

  function beginRecordsResize(edge: Edge, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (recordsMode === "max") return;
    const orig = recordsFrame ?? readRecordsFrame();
    setRecordsFrame(orig);
    dragRef.current = { kind: "resize", target: "records", edge, startX: event.clientX, startY: event.clientY, orig };
  }

  function openPreview(doc: PreviewDoc) {
    setPreviewDoc(doc);
    setPreviewMode("open");
  }

  function readPreviewFrame(): Frame {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 40) {
      const w = Math.min(780, window.innerWidth - 160);
      const h = Math.min(640, window.innerHeight - 120);
      return { x: 160, y: 48, w, h };
    }
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }

  function beginPreviewMove(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const orig = previewFrame ?? readPreviewFrame();
    setPreviewFrame(orig);
    dragRef.current = { kind: "move", target: "preview", edge: "", startX: event.clientX, startY: event.clientY, orig };
  }

  function beginPreviewResize(edge: Edge, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const orig = previewFrame ?? readPreviewFrame();
    setPreviewFrame(orig);
    dragRef.current = { kind: "resize", target: "preview", edge, startX: event.clientX, startY: event.clientY, orig };
  }

  function beginResize(edge: Edge, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "max") return;
    const orig = frame ?? readFrame();
    setFrame(orig);
    dragRef.current = { kind: "resize", target: "gavel", edge, startX: event.clientX, startY: event.clientY, orig };
  }

  const taskbar = (
    <footer className="taskbar">
      <button
        ref={startBtnRef}
        type="button"
        className="start-btn"
        aria-label="Start"
        aria-expanded={startOpen}
        aria-controls="start-menu"
        onClick={() => setStartOpen((open) => !open)}
      >
        <span className="logo-orb logo-orb-sm">
          <UncMark />
        </span>
      </button>
      <div className="task-apps">
        <button
          type="button"
          className={mode === "min" ? "task-app" : "task-app task-app-on"}
          aria-label="Chat"
          onClick={() => setMode(mode === "min" ? "open" : "min")}
        >
          <ChatOrb />
        </button>
        <button
          type="button"
          className={talkMode === "open" ? "task-app task-app-on" : "task-app"}
          aria-label="Talk"
          onClick={() => setTalkMode(talkMode === "open" ? "min" : "open")}
        >
          <TalkOrb />
        </button>
        <button
          type="button"
          className={recordsMode === "closed" || recordsMode === "min" ? "task-app" : "task-app task-app-on"}
          aria-label="Records"
          onClick={() => setRecordsMode(recordsMode === "open" || recordsMode === "max" ? "min" : "open")}
        >
          <RecordsOrb />
        </button>
        <button
          type="button"
          className={previewMode === "open" ? "task-app task-app-on" : "task-app"}
          aria-label="Preview"
          onClick={() => setPreviewMode(previewMode === "open" ? "min" : "open")}
        >
          <PreviewOrb />
        </button>
      </div>
      <div className="task-tray">
        <p className="task-credit">
          {note || (
            <>
              Wallpaper by KnightAnNi, CC0. AeroMedia icons © 2026 by{" "}
              <a href="https://onnoff.itch.io/aero-media">On N Off</a>,{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
            </>
          )}
        </p>
        <time className="task-clock">
          <span>{clock}</span>
          <span className="task-date">{date}</span>
        </time>
      </div>
    </footer>
  );

  return (
    <PreviewProvider open={openPreview}>
    <div className="desktop">
      <nav className="desktop-icons" aria-label="Desktop">
        <button
          type="button"
          className="desktop-icon"
          onClick={() => openAnd(() => document.querySelector<HTMLInputElement>(".ask-input")?.focus())}
        >
          <ChatOrb />
          Chat
        </button>
        <button type="button" className="desktop-icon" onClick={() => setTalkMode("open")}>
          <TalkOrb />
          Talk
        </button>
        <button type="button" className="desktop-icon" onClick={() => setRecordsMode("open")}>
          <RecordsOrb />
          Records
        </button>
        <button type="button" className="desktop-icon" onDoubleClick={() => setPreviewMode("open")}>
          <PreviewOrb />
          Preview
        </button>
        <button type="button" className="desktop-icon" onClick={() => openAnd()}>
          <img src="/aero/icons/gallery.png" alt="" width={48} height={48} />
          Meetings
        </button>
        <button
          type="button"
          className="desktop-icon"
          onClick={() => {
            setMode("min");
            setNote("The bin is empty.");
          }}
        >
          <img src="/aero/icons/bin.png" alt="" width={48} height={48} />
          Recycle Bin
        </button>
      </nav>

      {mode !== "min" && (
        <main
          ref={screenRef}
          className={mode === "max" ? "screen screen-max" : frame ? "screen screen-placed" : "screen"}
          style={
            frame && mode !== "max"
              ? { left: frame.x, top: frame.y, width: frame.w, height: frame.h }
              : undefined
          }
        >
          <section className="desktop-window glass-panel">
            {mode !== "max" &&
              EDGES.map((edge) => (
                <button
                  key={edge}
                  type="button"
                  className={`resize-handle resize-${edge}`}
                  aria-label={`Resize ${edge}`}
                  onPointerDown={(event) => beginResize(edge, event)}
                />
              ))}
            <div
              className="window-bar window-green"
              onPointerDown={beginMove}
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                setMode(mode === "max" ? "open" : "max");
              }}
            >
              <ChatOrb small />
              <h1 className="brand-title">Chat</h1>
              <div className="chrome">
                <button type="button" className="chrome-btn" aria-label="Minimize" onClick={() => setMode("min")}>
                  –
                </button>
                <button
                  type="button"
                  className="chrome-btn"
                  aria-label={mode === "max" ? "Restore" : "Maximize"}
                  onClick={() => setMode(mode === "max" ? "open" : "max")}
                >
                  □
                </button>
                <button type="button" className="chrome-btn chrome-close" aria-label="Close" onClick={() => setMode("min")}>
                  ×
                </button>
              </div>
            </div>
            <div className="window-content">
              {children}
            </div>
          </section>
        </main>
      )}

      {recordsMode !== "closed" ? (
        <section
          ref={recordsRef}
          className={
            recordsMode === "max"
              ? "records-window records-max glass-panel"
              : recordsFrame
                ? "records-window records-placed glass-panel"
                : "records-window glass-panel"
          }
          hidden={recordsMode === "min"}
          style={
            recordsFrame && recordsMode !== "max"
              ? { left: recordsFrame.x, top: recordsFrame.y, width: recordsFrame.w, height: recordsFrame.h }
              : undefined
          }
        >
          {recordsMode !== "max" &&
            EDGES.map((edge) => (
              <button
                key={edge}
                type="button"
                className={`resize-handle resize-${edge}`}
                aria-label={`Resize ${edge}`}
                onPointerDown={(event) => beginRecordsResize(edge, event)}
              />
            ))}
          <div
            className="window-bar"
            onPointerDown={beginRecordsMove}
            onDoubleClick={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              setRecordsMode(recordsMode === "max" ? "open" : "max");
            }}
          >
            <RecordsOrb small />
            <h2 className="brand-title">Records</h2>
            <div className="chrome">
              <button type="button" className="chrome-btn" aria-label="Minimize" onClick={() => setRecordsMode("min")}>
                –
              </button>
              <button
                type="button"
                className="chrome-btn"
                aria-label={recordsMode === "max" ? "Restore" : "Maximize"}
                onClick={() => setRecordsMode(recordsMode === "max" ? "open" : "max")}
              >
                □
              </button>
              <button type="button" className="chrome-btn chrome-close" aria-label="Close" onClick={() => setRecordsMode("closed")}>
                ×
              </button>
            </div>
          </div>
          <RecordsApp />
        </section>
      ) : null}

      {talkMode !== "closed" ? (
        <section
          ref={talkRef}
          className={talkFrame ? "talk-window talk-placed glass-panel" : "talk-window glass-panel"}
          hidden={talkMode === "min"}
          style={
            talkFrame
              ? { left: talkFrame.x, top: talkFrame.y, width: talkFrame.w, height: talkFrame.h }
              : undefined
          }
        >
          <div className="window-bar" onPointerDown={beginTalkMove}>
            <TalkOrb small />
            <h2 className="brand-title">Talk</h2>
            <div className="chrome">
              <button type="button" className="chrome-btn" aria-label="Minimize" onClick={() => setTalkMode("min")}>
                –
              </button>
              <button type="button" className="chrome-btn chrome-close" aria-label="Close" onClick={() => setTalkMode("closed")}>
                ×
              </button>
            </div>
          </div>
          <TalkApp />
        </section>
      ) : null}

      {previewMode !== "closed" ? (
        <section
          ref={previewRef}
          className={previewFrame ? "preview-window preview-placed glass-panel" : "preview-window glass-panel"}
          hidden={previewMode === "min"}
          style={
            previewFrame
              ? { left: previewFrame.x, top: previewFrame.y, width: previewFrame.w, height: previewFrame.h }
              : undefined
          }
        >
          {EDGES.map((edge) => (
            <button
              key={edge}
              type="button"
              className={`resize-handle resize-${edge}`}
              aria-label={`Resize ${edge}`}
              onPointerDown={(event) => beginPreviewResize(edge, event)}
            />
          ))}
          <div className="window-bar" onPointerDown={beginPreviewMove}>
            <PreviewOrb small />
            <h2 className="brand-title">Preview</h2>
            {previewDoc?.draft ? <span className="draft-badge">Draft</span> : null}
            <div className="chrome">
              <button type="button" className="chrome-btn" aria-label="Minimize" onClick={() => setPreviewMode("min")}>
                –
              </button>
              <button type="button" className="chrome-btn chrome-close" aria-label="Close" onClick={() => setPreviewMode("closed")}>
                ×
              </button>
            </div>
          </div>
          <PreviewApp doc={previewDoc} />
        </section>
      ) : null}

      {ready ? createPortal(<>{startOpen ? startMenu : null}{taskbar}</>, document.body) : <>{startOpen ? startMenu : null}{taskbar}</>}
      {booted ? null : <BootScreen onDone={() => setBooted(true)} />}
    </div>
    </PreviewProvider>
  );
}

function UncMark() {
  return (
    <svg className="unc-mark" viewBox="0 0 96 66" aria-hidden="true">
      <path fill="#ffffff" d="M38 4h52v14H56v30h34v14H38V4z" />
      <path fill="#ffffff" d="M2 4h16l28 36V4h16v58H46L18 26v36H2V4z" />
      <path fill="#ffffff" d="M46 4h16v14H46zM46 48h16v14H46z" />
    </svg>
  );
}

function ChatOrb({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "chat-orb chat-orb-sm" : "chat-orb"}>
      <MessageCircle className="chat-mark" aria-hidden="true" color="#ffffff" strokeWidth={2.4} />
    </span>
  );
}

function RecordsOrb({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "records-orb records-orb-sm" : "records-orb"}>
      <Folder className="records-mark" aria-hidden="true" color="#ffffff" strokeWidth={2.4} />
    </span>
  );
}

function PreviewOrb({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "preview-orb preview-orb-sm" : "preview-orb"}>
      <FileText className="preview-mark" aria-hidden="true" color="#ffffff" strokeWidth={2.4} />
    </span>
  );
}

function restoredFrame(clientX: number, clientY: number): Frame {
  const w = Math.min(960, window.innerWidth - 32);
  const h = Math.min(640, window.innerHeight - TASKBAR - 32);
  return clampFrame({
    x: clientX - w / 2,
    y: Math.max(0, clientY - 24),
    w,
    h,
  });
}

function resized(edge: string, orig: Frame, dx: number, dy: number): Frame {
  let { x, y, w, h } = orig;
  const minW = Math.min(480, window.innerWidth - 16);
  const minH = Math.min(320, window.innerHeight - TASKBAR - 16);
  if (edge.includes("e")) w = Math.max(minW, orig.w + dx);
  if (edge.includes("s")) h = Math.max(minH, orig.h + dy);
  if (edge.includes("w")) {
    w = Math.max(minW, orig.w - dx);
    x = orig.x + orig.w - w;
  }
  if (edge.includes("n")) {
    h = Math.max(minH, orig.h - dy);
    y = orig.y + orig.h - h;
  }
  return { x, y, w, h };
}

function clampMove(frame: Frame): Frame {
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - TASKBAR;
  const x = Math.min(Math.max(frame.x, 64 - frame.w), maxW - 64);
  const y = Math.min(Math.max(frame.y, 0), Math.max(0, maxH - 36));
  return { ...frame, x, y };
}

function clampFrame(frame: Frame): Frame {
  const minW = Math.min(480, window.innerWidth - 16);
  const minH = Math.min(320, window.innerHeight - TASKBAR - 16);
  const maxW = window.innerWidth;
  const maxH = window.innerHeight - TASKBAR;
  const w = Math.min(Math.max(frame.w, minW), maxW);
  const h = Math.min(Math.max(frame.h, minH), maxH);
  const x = Math.min(Math.max(frame.x, 64 - w), maxW - 64);
  const y = Math.min(Math.max(frame.y, 0), Math.max(0, maxH - 36));
  return { x, y, w, h };
}
