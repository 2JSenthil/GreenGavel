"use client";

import { Gavel } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { play, stopStartup } from "./sounds";

type Phase = "boot" | "leaving";

const LOGO_MS = 700;
const BAR_PASS_MS = 1600;
const BOOT_MS = LOGO_MS + BAR_PASS_MS * 2;
const LEAVE_MS = 700;

export default function BootScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("boot");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDoneRef.current();
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    play("startup");
    return () => stopStartup();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function finish() {
      onDoneRef.current();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter") finish();
    }
    window.addEventListener("keydown", onKey);
    const timers = [
      window.setTimeout(() => setPhase("leaving"), BOOT_MS),
      window.setTimeout(finish, BOOT_MS + LEAVE_MS),
    ];
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const className = ["boot-screen", phase === "leaving" ? "is-leaving" : ""].filter(Boolean).join(" ");

  return (
    <button type="button" className={className} aria-label="Skip startup" onClick={() => onDoneRef.current()}>
      <span className="boot-stage">
        <span className="boot-lockup">
          <span className="gavel-orb">
            <Gavel className="gavel-mark" aria-hidden="true" color="#ffffff" strokeWidth={2.4} />
          </span>
          <span className="boot-word">
            <span className="boot-brand">Green</span>
            <span className="boot-name">Gavel OS</span>
          </span>
        </span>
        <span className="boot-track" aria-hidden="true">
          <span className="boot-glow">
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        </span>
      </span>
    </button>
  );
}
