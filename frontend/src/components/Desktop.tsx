"use client";

import { Folder, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import BootScreen from "./BootScreen";
import RecordsApp from "./RecordsApp";
import TalkApp, { TalkOrb } from "./TalkApp";

type WindowMode = "open" | "min" | "max";
type TalkMode = "closed" | "open" | "min";
type RecordsMode = "closed" | "open" | "min" | "max";
type Frame = { x: number; y: number; w: number; h: number };
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
const TASKBAR = 60;

export default function Desktop({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState<WindowMode>("open");
  const [talkMode, setTalkMode] = useState<TalkMode>("closed");
  const [recordsMode, setRecordsMode] = useState<RecordsMode>("closed");
  const [clock, setClock] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [frame, setFrame] = useState<Frame | null>(null);
  const [talkFrame, setTalkFrame] = useState<Frame | null>(null);
  const [recordsFrame, setRecordsFrame] = useState<Frame | null>(null);
  const [ready, setReady] = useState(false);
  const screenRef = useRef<HTMLElement>(null);
  const talkRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    kind: "move" | "resize";
    target: "gavel" | "talk" | "records";
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
        else setFrame(next);
        return;
      }
      const next = clampFrame(resized(drag.edge, drag.orig, dx, dy));
      if (drag.target === "records") setRecordsFrame(next);
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
      <button type="button" className="start-btn" aria-label="Start" onClick={() => openAnd()}>
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

      {ready ? createPortal(taskbar, document.body) : taskbar}
      {booted ? null : <BootScreen onDone={() => setBooted(true)} />}
    </div>
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
