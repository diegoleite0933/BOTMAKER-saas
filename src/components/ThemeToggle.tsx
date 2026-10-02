"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

const themeChangeEvent = "odisseiabot-theme-change";

function subscribeTheme(callback: () => void) {
  window.addEventListener(themeChangeEvent, callback);
  return () => window.removeEventListener(themeChangeEvent, callback);
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  useEffect(() => {
    const isDark = localStorage.getItem("odisseiabot-theme") === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem("odisseiabot-theme", nextDark ? "dark" : "light");
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={dark}
      title={dark ? "Tema claro" : "Tema escuro"}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-blue-300 bg-white text-blue-950 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-950 dark:text-white dark:hover:bg-blue-900 ${className}`}
    >
      {dark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
    </button>
  );
}
