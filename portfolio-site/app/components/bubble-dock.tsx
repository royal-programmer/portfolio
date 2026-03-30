"use client";

import type { RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Settings2, Sparkles, X } from "lucide-react";
import { AgentChatPanel, type AgentChatPanelProps } from "./agent-chat-panel";
import { THEME_OPTIONS, type UiTheme } from "./site-content";

export type BubbleDockProps = {
  bubbleDockRef: RefObject<HTMLDivElement | null>;
  openBubble: "none" | "prefs" | "agent";
  launcherOpen: boolean;
  setLauncherOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  pendingBubble: "none" | "prefs" | "agent";
  setPendingBubble: (v: "none" | "prefs" | "agent") => void;
  setOpenBubble: (v: "none" | "prefs" | "agent") => void;
  soundEnabled: boolean;
  onSoundToggle: () => void;
  transitionsEnabled: boolean;
  onTransitionsToggle: () => void;
  prefsHydrated: boolean;
  uiTheme: UiTheme;
  onUiThemeChange: (t: UiTheme) => void;
  openPanelFromLauncher: (target: "agent" | "prefs") => void;
  agentChat: AgentChatPanelProps;
};

export function BubbleDock({
  bubbleDockRef,
  openBubble,
  launcherOpen,
  setLauncherOpen,
  pendingBubble,
  setPendingBubble,
  setOpenBubble,
  soundEnabled,
  onSoundToggle,
  transitionsEnabled,
  onTransitionsToggle,
  prefsHydrated,
  uiTheme,
  onUiThemeChange,
  openPanelFromLauncher,
  agentChat,
}: BubbleDockProps) {
  return (
    <div ref={bubbleDockRef} className="fixed bottom-5 right-5 z-[60]">
      <AnimatePresence>
        {openBubble === "prefs" && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-16 right-0 w-[min(100vw-2rem,320px)] rounded-2xl border p-4 backdrop-blur-2xl"
            style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
          >
            <p className="mb-3 text-sm font-medium">Preferences</p>
            <div className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-[var(--fg)]">Sound effects</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  aria-label={soundEnabled ? "Disable sound effects" : "Enable sound effects"}
                  onClick={onSoundToggle}
                  className="relative h-8 w-14 shrink-0 rounded-full transition-[background-color] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  style={{
                    backgroundColor: soundEnabled ? "var(--accent)" : "color-mix(in srgb, var(--muted) 22%, var(--surface-bg))",
                    boxShadow: soundEnabled
                      ? "inset 0 1px 0 rgba(255,255,255,0.22)"
                      : "inset 0 1px 2px rgba(0,0,0,0.08)",
                  }}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      soundEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-[var(--fg)]">Persona transitions</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefsHydrated ? transitionsEnabled : false}
                  aria-label={
                    transitionsEnabled ? "Disable persona transition animations" : "Enable persona transition animations"
                  }
                  disabled={!prefsHydrated}
                  onClick={onTransitionsToggle}
                  className="relative h-8 w-14 shrink-0 rounded-full transition-[background-color] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
                  style={{
                    backgroundColor: transitionsEnabled
                      ? "var(--accent)"
                      : "color-mix(in srgb, var(--muted) 22%, var(--surface-bg))",
                    boxShadow: transitionsEnabled
                      ? "inset 0 1px 0 rgba(255,255,255,0.22)"
                      : "inset 0 1px 2px rgba(0,0,0,0.08)",
                  }}
                >
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      transitionsEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="shrink-0 text-[var(--fg)]">Theme</span>
                <div
                  className="inline-flex shrink-0 rounded-full border p-0.5"
                  style={{
                    borderColor: "var(--control-border)",
                    backgroundColor: "color-mix(in srgb, var(--control-bg) 90%, transparent)",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  role="group"
                  aria-label="Theme"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = uiTheme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUiThemeChange(opt.value)}
                        aria-pressed={active}
                        title={opt.label}
                        className={`flex h-8 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                          active
                            ? "bg-[var(--surface-bg)] text-[var(--accent)] shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0_0_1px_color-mix(in_srgb,var(--control-border)_80%,transparent)]"
                            : "text-[var(--muted)] hover:bg-[var(--control-hover)] hover:text-[var(--fg)]"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="sr-only">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openBubble === "agent" && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-16 right-0 flex h-[420px] w-[340px] flex-col overflow-hidden rounded-2xl border backdrop-blur-2xl"
            style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
          >
            <AgentChatPanel {...agentChat} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-end gap-2">
        <AnimatePresence>
          {launcherOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex flex-col items-end gap-2"
            >
              <button
                type="button"
                onClick={() => openPanelFromLauncher("agent")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl"
                style={{ backgroundColor: "var(--control-bg)", borderColor: "var(--control-border)" }}
                aria-label="Open AI agent bubble"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openPanelFromLauncher("prefs")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-xl"
                style={{ backgroundColor: "var(--control-bg)", borderColor: "var(--control-border)" }}
                aria-label="Open preferences bubble"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => {
            setPendingBubble("none");
            if (openBubble !== "none") setOpenBubble("none");
            setLauncherOpen((v) => !v);
          }}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-xl"
          style={{ backgroundColor: "var(--control-bg)", borderColor: "var(--control-border)" }}
          aria-label="Open quick action bubbles"
        >
          {launcherOpen ? (
            <X className="h-5 w-5" />
          ) : pendingBubble === "agent" || openBubble === "agent" ? (
            <MessageCircle className="h-5 w-5" />
          ) : pendingBubble === "prefs" || openBubble === "prefs" ? (
            <Settings2 className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
