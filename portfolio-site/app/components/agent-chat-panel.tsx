"use client";

import type { RefObject } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "./chat-types";
import { TypewriterText } from "./typewriter-text";

export type AgentChatPanelProps = {
  personaModeLabel: string;
  chatScrollRef: RefObject<HTMLDivElement | null>;
  chatInnerRef: RefObject<HTMLDivElement | null>;
  leadFieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  messages: ChatMessage[];
  leadAwaitingReply: boolean;
  lastMessage: ChatMessage | undefined;
  leadStep: 0 | 1 | 2 | 3;
  leadInput: string;
  onLeadInputChange: (value: string) => void;
  leadPlaceholder: string;
  leadFieldInteractable: boolean;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  assistantBuffering: boolean;
  chatLoading: boolean;
  agentComposerLocked: boolean;
  onChatSubmit: () => void | Promise<void>;
  onQuickAction: (kind: "socials" | "about" | "connect") => void;
  scrollChatToBottom: () => void;
  finishTyping: (id: number) => void;
};

export function AgentChatPanel({
  personaModeLabel,
  chatScrollRef,
  chatInnerRef,
  leadFieldRef,
  messages,
  leadAwaitingReply,
  lastMessage,
  leadStep,
  leadInput,
  onLeadInputChange,
  leadPlaceholder,
  leadFieldInteractable,
  chatInput,
  onChatInputChange,
  assistantBuffering,
  chatLoading,
  agentComposerLocked,
  onChatSubmit,
  onQuickAction,
  scrollChatToBottom,
  finishTyping,
}: AgentChatPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <p className="text-xs font-medium">AI Agent</p>
        <span className="text-[11px] text-[var(--muted)]">{personaModeLabel}</span>
      </div>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-2.5 text-xs leading-relaxed">
        <div ref={chatInnerRef} className="flex flex-col gap-2">
          {messages.map((m) => {
            const isLeadPromptBubble =
              m.role === "assistant" && leadAwaitingReply && m.id === lastMessage?.id;

            if (isLeadPromptBubble) {
              return (
                <div
                  key={m.id}
                  className="self-start flex min-w-0 max-w-[90%] flex-col overflow-hidden rounded-2xl border text-xs leading-relaxed break-words text-[var(--fg)]"
                  style={{
                    backgroundColor: "var(--surface-bg)",
                    borderColor: "var(--surface-border)",
                    boxShadow: "var(--panel-shadow)",
                  }}
                >
                  <div className="px-2.5 py-1.5">
                    {m.animate ? (
                      <TypewriterText
                        text={m.content}
                        onProgress={scrollChatToBottom}
                        onDone={() => finishTyping(m.id)}
                      />
                    ) : (
                      <span className="whitespace-pre-line">{m.content}</span>
                    )}
                  </div>
                  {!m.animate ? (
                    <div
                      className="border-t px-2 py-1.5"
                      style={{
                        borderColor: "var(--surface-border)",
                        backgroundColor: "color-mix(in srgb, var(--surface-bg) 88%, var(--fg) 6%)",
                      }}
                    >
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Your reply
                      </p>
                      <div className="flex gap-1.5">
                        {leadStep === 3 ? (
                          <textarea
                            ref={leadFieldRef as RefObject<HTMLTextAreaElement>}
                            value={leadInput}
                            onChange={(e) => onLeadInputChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              if (e.shiftKey) return;
                              e.preventDefault();
                              void onChatSubmit();
                            }}
                            placeholder={leadPlaceholder}
                            disabled={!leadFieldInteractable}
                            rows={3}
                            className="min-h-[4rem] flex-1 resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none disabled:opacity-45"
                            style={{ borderColor: "var(--control-border)" }}
                            aria-label={leadPlaceholder}
                          />
                        ) : (
                          <input
                            ref={leadFieldRef as RefObject<HTMLInputElement>}
                            type={leadStep === 2 ? "email" : "text"}
                            value={leadInput}
                            onChange={(e) => onLeadInputChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void onChatSubmit();
                            }}
                            placeholder={leadPlaceholder}
                            disabled={!leadFieldInteractable}
                            autoComplete={leadStep === 2 ? "email" : "name"}
                            className="min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none disabled:opacity-45"
                            style={{ borderColor: "var(--control-border)" }}
                            aria-label={leadPlaceholder}
                          />
                        )}
                        <button
                          type="button"
                          disabled={!leadFieldInteractable || !leadInput.trim()}
                          onClick={() => void onChatSubmit()}
                          className="inline-flex h-9 shrink-0 self-end rounded-lg bg-[var(--accent)] px-2.5 text-[var(--cta-fg)] disabled:opacity-40"
                        >
                          <Send className="m-auto h-3.5 w-3.5" />
                        </button>
                      </div>
                      {!leadFieldInteractable ? (
                        <p className="mt-1 text-[10px] text-[var(--muted)]">One moment…</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`w-fit max-w-[90%] min-w-0 rounded-xl px-2.5 py-1.5 text-xs leading-relaxed break-words ${
                  m.role === "user"
                    ? "self-end bg-[var(--accent)] text-[var(--cta-fg)]"
                    : "self-start bg-black/10 text-[var(--fg)]"
                }`}
              >
                {m.role === "assistant" && m.animate ? (
                  <TypewriterText
                    text={m.content}
                    onProgress={scrollChatToBottom}
                    onDone={() => finishTyping(m.id)}
                  />
                ) : (
                  <span className="whitespace-pre-line">{m.content}</span>
                )}
              </div>
            );
          })}
          {assistantBuffering && (
            <div className="self-start w-fit max-w-[90%] rounded-xl bg-black/10 px-3 py-2">
              <div className="chat-typing-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          {chatLoading && (
            <div
              className="self-start w-fit max-w-[90%] rounded-xl bg-black/10 px-3 py-2"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">Thinking</span>
              <div className="chat-typing-dots chat-typing-dots--loop" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-2.5" style={{ borderColor: "var(--surface-border)" }}>
        <div className="mb-1.5 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={agentComposerLocked}
            onClick={() => onQuickAction("about")}
            className="min-w-0 rounded-full border px-1.5 py-1 text-center text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
            style={{ borderColor: "var(--control-border)" }}
          >
            About Ratul
          </button>
          <button
            type="button"
            disabled={agentComposerLocked}
            onClick={() => onQuickAction("socials")}
            className="min-w-0 rounded-full border px-1.5 py-1 text-center text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
            style={{ borderColor: "var(--control-border)" }}
          >
            Socials
          </button>
          <button
            type="button"
            disabled={agentComposerLocked}
            onClick={() => onQuickAction("connect")}
            className="min-w-0 rounded-full border px-1.5 py-1 text-center text-[10px] font-medium leading-tight disabled:cursor-not-allowed disabled:opacity-40 sm:text-[11px]"
            style={{ borderColor: "var(--control-border)" }}
          >
            Connect
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onChatSubmit();
            }}
            placeholder="Ask about work or type your reply..."
            className="w-full rounded-full border bg-transparent px-2.5 py-1.5 text-xs outline-none disabled:opacity-45"
            style={{ borderColor: "var(--control-border)" }}
            disabled={agentComposerLocked}
          />
          <button
            type="button"
            onClick={() => void onChatSubmit()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--cta-fg)] disabled:opacity-40"
            disabled={agentComposerLocked || !chatInput.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
