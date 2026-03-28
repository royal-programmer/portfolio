export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: number; role: ChatRole; content: string; animate?: boolean };
export type AssistantQueueItem = { content: string; pauseBeforeDotsMs: number };
export type LeadDraft = { name: string; email: string; reason: string };
