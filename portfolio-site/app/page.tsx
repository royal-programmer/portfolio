"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PERSONA_ORDER, usePersona, type Persona } from "./persona-provider";
import type { AssistantQueueItem, ChatMessage, LeadDraft } from "./components/chat-types";
import { BubbleDock } from "./components/bubble-dock";
import { HomeHeader } from "./components/home-header";
import { PersonaBackdrop } from "./components/persona-backdrop";
import {
  PersonaHomeBody,
  type PersonaMotionOrchestratorHandle,
} from "./components/persona-home-body";
import { PersonaTransitionWash } from "./components/persona-transition-wash";
import { usePersonaTransitionPrefs } from "./hooks/use-persona-transition-prefs";
import { usePersonaTransitionRunner } from "./hooks/use-persona-transition-runner";
import {
  CHAT_GAP_AFTER_USER_MS,
  CHAT_MIN_THINKING_MS,
  CHAT_TYPING_MIN_BUFFER_MS,
  KONAMI,
  PERSONA_CONTENT,
  QUICK_STACK_EXIT_MS,
  SOCIAL_LINKS,
  type UiTheme,
} from "./components/site-content";

export default function Home() {
  const { persona, setPersona } = usePersona();
  const {
    transitionsEnabled,
    setTransitionsEnabled,
    effectiveTransitions,
    hydrated: prefsHydrated,
  } = usePersonaTransitionPrefs();
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>("system");
  const [openBubble, setOpenBubble] = useState<"none" | "prefs" | "agent">("none");
  const [pendingBubble, setPendingBubble] = useState<"none" | "prefs" | "agent">("none");
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [leadInput, setLeadInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [leadStep, setLeadStep] = useState<0 | 1 | 2 | 3>(0);
  const [leadDraft, setLeadDraft] = useState<LeadDraft>({ name: "", email: "", reason: "" });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [assistantBuffering, setAssistantBuffering] = useState(false);
  const konamiSequenceRef = useRef<string[]>([]);
  const holdTimer = useRef<number | null>(null);
  const bubbleDockRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInnerRef = useRef<HTMLDivElement | null>(null);
  const leadInlineFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const personaOrchestratorRef = useRef<PersonaMotionOrchestratorHandle | null>(null);
  const content = useMemo(() => PERSONA_CONTENT[persona], [persona]);
  const effectiveTransitionsRef = useRef(effectiveTransitions);
  effectiveTransitionsRef.current = effectiveTransitions;

  /** How long to hold the logo before the chained persona switch fires */
  const HOLD_MS = 1300;
  /**
   * Max milliseconds between consecutive pointer-downs on the logo to chain
   * 1× Engineer → 2× Trader → 3× Photographer. Increase if taps feel too fast.
   */
  const PERSONA_CHAIN_WINDOW_MOUSE_MS = 520;
  const PERSONA_CHAIN_WINDOW_TOUCH_MS = 680;
  const lastDownRef = useRef<number>(0);
  const downStreakRef = useRef<number>(0);
  const holdTargetPersonaRef = useRef<Persona>("engineer");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const msgIdRef = useRef(0);
  const assistantQueueRef = useRef<AssistantQueueItem[]>([]);
  const assistantTypingRef = useRef(false);
  const assistantBufferTimerRef = useRef<number | null>(null);
  const assistantPreDotsTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ui-theme");
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      queueMicrotask(() => setUiTheme(savedTheme));
    }
    const savedSound = window.localStorage.getItem("sound-enabled") === "true";
    queueMicrotask(() => setSoundEnabled(savedSound));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ui-theme", uiTheme);
    if (uiTheme === "system") {
      document.documentElement.removeAttribute("data-ui-theme");
      return;
    }
    document.documentElement.setAttribute("data-ui-theme", uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    window.localStorage.setItem("sound-enabled", soundEnabled ? "true" : "false");
  }, [soundEnabled]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!bubbleDockRef.current) return;
      const target = event.target as Node | null;
      if (target && !bubbleDockRef.current.contains(target)) {
        setOpenBubble("none");
        setPendingBubble("none");
        setLauncherOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, []);

  const playPersonaStinger = useCallback((next: Persona) => {
    if (!soundEnabled) return;
    if (!effectiveTransitionsRef.current) return;
    if (typeof window === "undefined") return;

    try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = audioCtxRef.current ?? new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") void ctx.resume();

        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        master.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(420, now + 0.26);

        const base = next === "engineer" ? 440 : next === "trader" ? 220 : 330;
        const end = next === "engineer" ? 740 : next === "trader" ? 520 : 660;

        osc.type = next === "trader" ? "sawtooth" : "triangle";
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(end, now + 0.18);

        osc.connect(filter);
        filter.connect(master);

        osc.start(now);
        osc.stop(now + 0.3);
    } catch {
      // ignore audio errors (autoplay policies, missing support)
    }
  }, [soundEnabled]);

  const { washOpen, runTransition } = usePersonaTransitionRunner({
    persona,
    setPersona,
    effectiveTransitions,
    playPersonaStinger,
    orchestratorRef: personaOrchestratorRef,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event) return;
      const key = event.key;
      if (key === undefined || key === null) return;
      let lower: string;
      try {
        lower =
          typeof key === "string"
            ? key.toLowerCase()
            : typeof key === "number" && Number.isFinite(key)
              ? String(key).toLowerCase()
              : "";
      } catch {
        return;
      }
      if (!lower) return;

      const prev = konamiSequenceRef.current;
      const base = Array.isArray(prev) ? prev : [];
      konamiSequenceRef.current = [...base, lower].slice(-10);
      if (KONAMI.every((k, i) => konamiSequenceRef.current[i] === k)) {
        const idx = PERSONA_ORDER.indexOf(persona);
        void runTransition(PERSONA_ORDER[(idx + 1) % PERSONA_ORDER.length]);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persona, runTransition]);

  const startHold = () => {
    holdTimer.current = window.setTimeout(() => {
      void runTransition(holdTargetPersonaRef.current);
      downStreakRef.current = 0;
    }, HOLD_MS);
  };

  const stopHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onLogoPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const windowMs =
      event.pointerType === "touch" ? PERSONA_CHAIN_WINDOW_TOUCH_MS : PERSONA_CHAIN_WINDOW_MOUSE_MS;
    const now = Date.now();
    if (now - lastDownRef.current < windowMs) downStreakRef.current += 1;
    else downStreakRef.current = 1;
    lastDownRef.current = now;

    const streak = Math.min(downStreakRef.current, 3);
    holdTargetPersonaRef.current =
      streak === 1 ? "engineer" : streak === 2 ? "trader" : "photographer";
    startHold();
  };

  const openPanelFromLauncher = (target: "agent" | "prefs") => {
    setPendingBubble(target);
    setLauncherOpen(false);
    window.setTimeout(() => {
      setOpenBubble(target);
      setPendingBubble("none");
    }, QUICK_STACK_EXIT_MS);
  };

  const maybeStartNextAssistantTyping = useCallback(() => {
    if (assistantTypingRef.current) return;
    const item = assistantQueueRef.current.shift();
    if (!item) return;
    assistantTypingRef.current = true;

    const runDotsThenBubble = () => {
      setAssistantBuffering(true);
      assistantBufferTimerRef.current = window.setTimeout(() => {
        const id = ++msgIdRef.current;
        setAssistantBuffering(false);
        setChatMessages((prev) => [
          ...prev,
          { id, role: "assistant", content: item.content, animate: true },
        ]);
        assistantBufferTimerRef.current = null;
      }, CHAT_TYPING_MIN_BUFFER_MS);
    };

    const pause = item.pauseBeforeDotsMs;
    if (pause <= 0) {
      runDotsThenBubble();
      return;
    }
    assistantPreDotsTimerRef.current = window.setTimeout(() => {
      assistantPreDotsTimerRef.current = null;
      runDotsThenBubble();
    }, pause);
  }, []);

  const appendAssistantMessage = useCallback(
    (content: string, opts?: { pauseBeforeDotsMs?: number }) => {
      assistantQueueRef.current.push({
        content,
        pauseBeforeDotsMs: opts?.pauseBeforeDotsMs ?? 0,
      });
      queueMicrotask(() => maybeStartNextAssistantTyping());
    },
    [maybeStartNextAssistantTyping],
  );

  const askLeadQuestion = (step: 2 | 3) => {
    const pause = CHAT_GAP_AFTER_USER_MS;
    if (step === 2) appendAssistantMessage("Thanks. What is your email?", { pauseBeforeDotsMs: pause });
    if (step === 3) appendAssistantMessage("Perfect. Why do you want to connect?", { pauseBeforeDotsMs: pause });
  };

  const submitLead = async (payload: LeadDraft) => {
    setChatLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Lead submission failed");
      appendAssistantMessage("Done. I have saved your request and Ratul will get back to you soon.", {
        pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS,
      });
    } catch {
      appendAssistantMessage(
        "I could not submit right now. Please email ratul.arya.roy@gmail.com directly.",
        { pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS },
      );
    } finally {
      setChatLoading(false);
      setLeadStep(0);
      setLeadDraft({ name: "", email: "", reason: "" });
      setLeadInput("");
    }
  };

  const handleChatSubmit = async () => {
    const fromLead = leadStep > 0;
    const text = (fromLead ? leadInput : chatInput).trim();
    if (!text || chatLoading) return;
    if (fromLead) setLeadInput("");
    else setChatInput("");
    const id = ++msgIdRef.current;
    setChatMessages((prev) => [...prev, { id, role: "user", content: text }]);

    if (fromLead) {
      if (leadStep === 1) {
        setLeadDraft((p) => ({ ...p, name: text }));
        setLeadStep(2);
        askLeadQuestion(2);
      } else if (leadStep === 2) {
        setLeadDraft((p) => ({ ...p, email: text }));
        setLeadStep(3);
        askLeadQuestion(3);
      } else {
        const finalLead = { ...leadDraft, reason: text };
        setLeadDraft(finalLead);
        await submitLead(finalLead);
      }
      return;
    }

    setChatLoading(true);
    const thinkingStarted = performance.now();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, message: text }),
      });
      if (!res.ok) throw new Error("Chat failed");
      const data = (await res.json()) as { reply: string; startLeadFlow?: boolean };
      const elapsed = performance.now() - thinkingStarted;
      if (elapsed < CHAT_MIN_THINKING_MS) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, CHAT_MIN_THINKING_MS - elapsed);
        });
      }
      let combined = data.reply.trimEnd();
      if (data.startLeadFlow) {
        setLeadInput("");
        setLeadStep(1);
        combined = `${combined}\n\nGreat. What is your name?`;
      }
      appendAssistantMessage(combined, { pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS });
    } catch {
      const elapsed = performance.now() - thinkingStarted;
      if (elapsed < CHAT_MIN_THINKING_MS) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, CHAT_MIN_THINKING_MS - elapsed);
        });
      }
      appendAssistantMessage(
        "I had trouble responding. Ask again, or use socials in Preferences for now.",
        { pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS },
      );
    } finally {
      setChatLoading(false);
    }
  };

  const handleQuickAction = (kind: "socials" | "about" | "connect") => {
    const quickLabel =
      kind === "about" ? "About Ratul" : kind === "socials" ? "Socials" : "Connect";
    const id = ++msgIdRef.current;
    setChatMessages((prev) => [...prev, { id, role: "user", content: quickLabel }]);

    if (kind === "socials") {
      const socials = SOCIAL_LINKS.map((s) => `${s.label}: ${s.value}`).join("\n");
      appendAssistantMessage(`Here are Ratul's links:\n${socials}`, {
        pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS,
      });
      return;
    }
    if (kind === "about") {
      appendAssistantMessage(
        persona === "engineer"
          ? "Ratul is a software engineer focused on product UX, scalable frontend architecture, and backend integrations."
          : persona === "trader"
            ? "Ratul approaches markets with a process-first mindset: risk management, journaling, and disciplined execution."
            : "Ratul is also a photographer focused on composition, portrait lighting, and visual storytelling.",
        { pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS },
      );
      return;
    }
    setLeadInput("");
    setLeadStep(1);
    appendAssistantMessage(
      "Awesome. I can take your contact details in chat.\n\nGreat. What is your name?",
      { pauseBeforeDotsMs: CHAT_GAP_AFTER_USER_MS },
    );
  };

  const finishTyping = (id: number) => {
    setChatMessages((prev) => prev.map((m) => (m.id === id ? { ...m, animate: false } : m)));
    assistantTypingRef.current = false;
    maybeStartNextAssistantTyping();
  };

  useEffect(() => {
    return () => {
      if (assistantBufferTimerRef.current) {
        window.clearTimeout(assistantBufferTimerRef.current);
        assistantBufferTimerRef.current = null;
      }
      if (assistantPreDotsTimerRef.current) {
        window.clearTimeout(assistantPreDotsTimerRef.current);
        assistantPreDotsTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (openBubble !== "agent") return;
    if (chatMessages.length > 0) return;
    appendAssistantMessage(
      "Hi, I am Ratul's AI assistant. I can share socials, explain his work, and help you connect quickly.",
    );
  }, [appendAssistantMessage, chatMessages.length, openBubble]);

  const lastChatMessage = chatMessages.at(-1);
  const leadAwaitingReply = leadStep > 0 && lastChatMessage?.role === "assistant";

  const assistantActivelyTyping = useMemo(
    () => chatMessages.some((m) => m.role === "assistant" && m.animate),
    [chatMessages],
  );

  const agentComposerLocked =
    leadStep > 0 || assistantBuffering || chatLoading || assistantActivelyTyping;

  const leadFieldPlaceholder =
    leadStep === 1 ? "Your name…" : leadStep === 2 ? "you@example.com" : "A sentence or two is perfect";

  const leadFieldInteractable =
    leadAwaitingReply && !lastChatMessage?.animate && !assistantBuffering && !chatLoading;

  useEffect(() => {
    if (openBubble !== "agent" || !leadFieldInteractable) return;
    queueMicrotask(() => leadInlineFieldRef.current?.focus());
  }, [openBubble, leadFieldInteractable, lastChatMessage?.id, leadStep]);

  const scrollChatToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  useLayoutEffect(() => {
    if (openBubble !== "agent") return;
    scrollChatToBottom();
  }, [openBubble, assistantBuffering, chatLoading, chatMessages, scrollChatToBottom]);

  useEffect(() => {
    if (openBubble !== "agent") return;
    const scrollEl = chatScrollRef.current;
    const inner = chatInnerRef.current;
    if (!scrollEl || !inner) return;

    const ro = new ResizeObserver(() => {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [openBubble, assistantBuffering, chatLoading, chatMessages.length]);

  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--page-bg)] text-[var(--fg)] transition-colors duration-700">
      <PersonaBackdrop persona={persona} showFlash={false} />

      <HomeHeader onLogoPointerDown={onLogoPointerDown} onLogoPointerUp={stopHold} />

      <PersonaTransitionWash open={washOpen} />

      <div
        className="relative z-10 min-h-0 overflow-x-clip overflow-y-clip"
        aria-busy={washOpen}
        aria-live="polite"
      >
        <PersonaHomeBody ref={personaOrchestratorRef} persona={persona} content={content} />
      </div>

      <BubbleDock
        bubbleDockRef={bubbleDockRef}
        openBubble={openBubble}
        launcherOpen={launcherOpen}
        setLauncherOpen={setLauncherOpen}
        pendingBubble={pendingBubble}
        setPendingBubble={setPendingBubble}
        setOpenBubble={setOpenBubble}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled((v) => !v)}
        transitionsEnabled={transitionsEnabled}
        onTransitionsToggle={() => setTransitionsEnabled((v) => !v)}
        prefsHydrated={prefsHydrated}
        uiTheme={uiTheme}
        onUiThemeChange={setUiTheme}
        openPanelFromLauncher={openPanelFromLauncher}
        agentChat={{
          personaModeLabel: content.label,
          chatScrollRef,
          chatInnerRef,
          leadFieldRef: leadInlineFieldRef,
          messages: chatMessages,
          leadAwaitingReply,
          lastMessage: lastChatMessage,
          leadStep,
          leadInput,
          onLeadInputChange: setLeadInput,
          leadPlaceholder: leadFieldPlaceholder,
          leadFieldInteractable,
          chatInput,
          onChatInputChange: setChatInput,
          assistantBuffering,
          chatLoading,
          agentComposerLocked,
          onChatSubmit: handleChatSubmit,
          onQuickAction: handleQuickAction,
          scrollChatToBottom,
          finishTyping,
        }}
      />
    </main>
  );
}
