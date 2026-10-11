"use client";

import { useEffect } from "react";

const FRAMES = 15;
const FRAME_MS = 233;

let depth = 0;
let frame = 0;
let timer = 0;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function paint() {
  const root = document.documentElement;
  for (let index = 0; index < FRAMES; index += 1) root.classList.remove(`busy-${index}`);
  if (depth > 0) {
    root.classList.add("is-busy", `busy-${frame}`);
  } else {
    root.classList.remove("is-busy");
  }
}

export function beginBusy() {
  depth += 1;
  if (depth === 1) {
    frame = 0;
    paint();
    if (!reducedMotion()) {
      timer = window.setInterval(() => {
        frame = (frame + 1) % FRAMES;
        paint();
      }, FRAME_MS);
    }
  }
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      window.clearInterval(timer);
      timer = 0;
      paint();
    }
  };
}

export function useBusy(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return beginBusy();
  }, [active]);
}
