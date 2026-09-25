"use client";

import { useSyncExternalStore } from "react";

/** Compare list persisted in localStorage and shared across tabs. */
const KEY = "dw-compare";
export const COMPARE_MAX = 4;
const EMPTY: string[] = [];
let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };
const listeners = new Set<() => void>();

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.value;
  let value: string[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, COMPARE_MAX)
      : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const cur = read();
      if (cur.includes(id)) write(cur.filter((x) => x !== id));
      else if (cur.length < COMPARE_MAX) write([...cur, id]);
      else write([...cur.slice(1), id]);
    },
    remove: (id: string) => write(read().filter((x) => x !== id)),
    clear: () => write([]),
  };
}
