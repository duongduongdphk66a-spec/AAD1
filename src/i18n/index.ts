import { useSyncExternalStore } from 'react';
import { vi } from './vi';
import { en } from './en';

export type Key = keyof typeof vi;
export type Lang = 'vi' | 'en';

const dicts = { vi, en } satisfies Record<Lang, Record<Key, string>>;

function readInitialLang(): Lang {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lang');
      if (saved === 'vi' || saved === 'en') return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'vi';
}

let lang: Lang = readInitialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (lang === next) return;
  lang = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lang', next);
    }
  } catch {
    // Ignore storage write errors
  }
  for (const fn of listeners) fn();
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: Key, p: Record<string, string | number> = {}): string {
  return dicts[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ''));
}

export function useI18n() {
  const currentLang = useSyncExternalStore(subscribeLang, getLang, () => 'vi' as Lang);
  return {
    lang: currentLang,
    setLang,
    t,
  };
}
