"use client";

export type Sound =
  | "startup"
  | "start"
  | "menu"
  | "minimize"
  | "restore"
  | "recycle"
  | "ding"
  | "notify"
  | "exclamation"
  | "critical"
  | "error"
  | "default";

// Gains bring each file to a similar peak. The menu click and window whooshes
// are very quiet in the recordings. Startup and the error chords are already loud.
const CLIPS: Record<Sound, { file: string; gain: number }> = {
  startup: { file: "startup.mp3", gain: 0.55 },
  start: { file: "start.mp3", gain: 4 },
  menu: { file: "menu.mp3", gain: 3.6 },
  minimize: { file: "minimize.mp3", gain: 5.5 },
  restore: { file: "restore.mp3", gain: 5.5 },
  recycle: { file: "recycle.mp3", gain: 2.6 },
  ding: { file: "ding.mp3", gain: 1.6 },
  notify: { file: "notify.mp3", gain: 3.2 },
  exclamation: { file: "exclamation.mp3", gain: 2.4 },
  critical: { file: "critical.mp3", gain: 0.72 },
  error: { file: "error.mp3", gain: 0.85 },
  default: { file: "default.mp3", gain: 1.15 },
};

let ctx: AudioContext | null = null;
let installed = false;
const cache = new Map<Sound, AudioBuffer>();
const loading = new Map<Sound, Promise<AudioBuffer>>();
let startupNode: AudioBufferSourceNode | null = null;
let startupToken = 0;

function context() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function load(name: Sound) {
  const ready = cache.get(name);
  if (ready) return Promise.resolve(ready);
  let job = loading.get(name);
  if (!job) {
    const audio = context();
    job = fetch(`/sounds/${CLIPS[name].file}`)
      .then((response) => response.arrayBuffer())
      .then((bytes) => audio.decodeAudioData(bytes))
      .then((buffer) => {
        cache.set(name, buffer);
        return buffer;
      });
    loading.set(name, job);
  }
  return job;
}

function startNode(name: Sound, buffer: AudioBuffer) {
  const audio = context();
  void audio.resume();
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const gain = audio.createGain();
  gain.gain.value = CLIPS[name].gain;
  source.connect(gain);
  gain.connect(audio.destination);
  source.start();
  return source;
}

export function preloadSounds() {
  (Object.keys(CLIPS) as Sound[]).forEach((name) => {
    void load(name);
  });
}

export function play(name: Sound) {
  const audio = context();
  void audio.resume();
  if (name === "startup") {
    const token = ++startupToken;
    void load(name).then((buffer) => {
      if (token !== startupToken) return;
      startupNode?.stop();
      startupNode = startNode(name, buffer);
      startupNode.onended = () => {
        if (startupNode) startupNode = null;
      };
    });
    return;
  }
  const buffer = cache.get(name);
  if (buffer) {
    startNode(name, buffer);
    return;
  }
  void load(name).then((decoded) => startNode(name, decoded));
}

export function stopStartup() {
  startupToken += 1;
  startupNode?.stop();
  startupNode = null;
}

export function installSounds() {
  if (installed) return;
  installed = true;
  preloadSounds();
  const unlock = () => {
    if (ctx?.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".boot-screen, .resize-handle, .window-bar")) return;
    const field = target.closest("input, textarea, select, [contenteditable='true']");
    if (field) return;
    const control = target.closest("button, a[href]");
    if (control instanceof HTMLButtonElement && control.disabled) {
      play("menu");
      return;
    }
    if (!(control instanceof HTMLButtonElement || control instanceof HTMLAnchorElement)) {
      play("menu");
      return;
    }
    if (control.classList.contains("chrome-btn") || control.classList.contains("task-app") || control.classList.contains("start-btn")) return;
    const named = control.dataset.sound;
    if (named === "none") return;
    if (named) {
      play(named as Sound);
      return;
    }
    play("menu");
  });
}
