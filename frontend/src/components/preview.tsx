"use client";

import { createContext, useContext, type ReactNode } from "react";

export type PreviewDoc = {
  url: string;
  title: string;
  draft?: boolean;
};

const PreviewContext = createContext<(doc: PreviewDoc) => void>(() => {});

export function PreviewProvider({
  open,
  children,
}: {
  open: (doc: PreviewDoc) => void;
  children: ReactNode;
}) {
  return <PreviewContext.Provider value={open}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  return useContext(PreviewContext);
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HOSTS = new Set(["chapelhill.legistar1.com", "chapelhill.legistar.com"]);

export function previewUrl(url: string) {
  if (url.startsWith("/")) return `${API}${url}`;
  try {
    const parsed = new URL(url);
    if (HOSTS.has(parsed.hostname)) {
      return `${API}/api/records/file?src=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}
