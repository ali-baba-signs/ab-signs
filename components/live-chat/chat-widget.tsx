"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Minimize2, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CHAT_ACTIONS,
  type ChatReply,
  type SupportIntent,
} from "@/lib/support/rules";

interface Message {
  id: string;
  text: string;
  sender: "user" | "support";
}

const policyLinks = [
  { label: "Policies Overview", path: "/policies" },
  { label: "Privacy Policy", path: "/privacy-policy" },
  { label: "Terms of Service", path: "/terms-of-service" },
  { label: "Refunds & Returns", path: "/refund-returns-policy" },
  { label: "Warranty & Disclaimer", path: "/warranty-disclaimer" },
];

const STORAGE_KEY = "support_chat_session_id";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sessionId = useRef<string>("");
  const inFlight = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Hide the widget completely on any admin page
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/staff-portal")) {
    return null;
  }

  // Initialize or restore session ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      let stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        stored = crypto.randomUUID();
        sessionStorage.setItem(STORAGE_KEY, stored);
      }
      sessionId.current = stored;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy, scrollToBottom]);

  // Auto-resize textarea to fit content up to maximum threshold
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Set to scrollHeight, letting CSS max-height limit growth
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Polling for live agent responses
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const poll = async () => {
      if (!sessionId.current) return;
      try {
        const response = await fetch(
          `/api/live-chat?sessionId=${sessionId.current}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;

        const payload = await response.json();
        const incoming: Message[] = (payload.data?.messages || []).map(
          (row: { id: string; message: string; isAdminMessage: boolean }) => ({
            id: row.id,
            text: row.message,
            sender: row.isAdminMessage ? "support" : "user",
          })
        );

        if (!controller.signal.aborted && incoming.length > 0) {
          setMessages((current) => {
            const currentIds = new Set(current.map((m) => m.id));
            const newRows = incoming.filter((item) => !currentIds.has(item.id));
            return newRows.length > 0 ? [...current, ...newRows] : current;
          });
        }
      } catch {
        /* Retry on next poll */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 8000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isOpen]);

  async function send(action?: SupportIntent) {
    if (inFlight.current || (!action && !input.trim())) return;

    inFlight.current = true;
    setBusy(true);
    setError("");

    const message = action ? "" : input.trim();
    const selected =
      action ||
      (reply?.collectOrderId
        ? "track_order"
        : reply?.requiresHuman && reply.intent !== "custom_quote"
          ? reply.intent
          : undefined);

    try {
      if (!sessionId.current) {
        sessionId.current = crypto.randomUUID();
        sessionStorage.setItem(STORAGE_KEY, sessionId.current);
      }

      const response = await fetch("/api/live-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: selected,
          message,
          orderNumber: !action && reply?.collectOrderId ? message : undefined,
          sessionId: sessionId.current,
          pageUrl: window.location.origin + window.location.pathname,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Support is unavailable.");
      }

      const next = payload.data as ChatReply;
      setReply(next);

      const saved = payload.data.messages as
        | { id: string; message: string; isAdminMessage: boolean }[]
        | undefined;

      const additions: Message[] = saved
        ? saved.map((row) => ({
            id: row.id,
            text: row.message,
            sender: row.isAdminMessage ? "support" : "user",
          }))
        : [
            {
              id: crypto.randomUUID(),
              text: action
                ? CHAT_ACTIONS.find((item) => item.action === action)?.label || action
                : message,
              sender: "user",
            },
            { id: crypto.randomUUID(), text: next.response, sender: "support" },
          ];

      setMessages((current) => {
        const currentIds = new Set(current.map((m) => m.id));
        const newRows = additions.filter((item) => !currentIds.has(item.id));
        return [...current, ...newRows];
      });

      setInput("");
      // Reset textarea height back to compact baseline
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Support is unavailable."
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter inserts a newline normally
    // Ctrl + Enter or Cmd + Enter sends immediately
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  if (!isOpen) {
    return (
      <button
        aria-label="Open support chat"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section
      aria-label="Support chat"
      className="fixed bottom-3 right-3 z-40 flex h-[min(640px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-96 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl sm:bottom-6 sm:right-6"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Alibaba Signs Support</h2>
          <p className="text-xs text-muted-foreground">
            Instant FAQs · Live staff monitoring
          </p>
        </div>
        <button
          aria-label="Minimize support chat"
          onClick={() => setIsOpen(false)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </header>

      {/* Message Area */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            👋 Welcome! Ask any question below or choose an instant topic to get started.
          </div>
        )}

        {/* Quick Action Chips */}
        <div className="flex flex-wrap gap-1.5 pb-2">
          {CHAT_ACTIONS.map((item) => (
            <Button
              key={item.action}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => void send(item.action)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Message Thread */}
        <div role="log" aria-live="polite" className="space-y-3">
          {messages.map((message) => {
            const isUser = message.sender === "user";
            return (
              <div
                key={message.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] wrap-break-word whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-xs [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-muted text-foreground rounded-bl-xs [&_a]:text-primary [&_a]:font-semibold [&_a]:underline [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1"
                  }`}
                >
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {busy && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Checking response...</span>
            </div>
          )}
        </div>

        {/* Dynamic Contextual Recommendations */}
        {reply?.intent === "privacy" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {policyLinks.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className="inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {reply?.intent === "products" && (
          <Link
            className="mt-2 inline-block text-xs font-medium text-primary underline"
            href="/products"
          >
            Browse Product Catalog →
          </Link>
        )}

        {reply?.requiresHuman && (
          <Link
            className="mt-2 inline-block text-xs font-medium text-primary underline"
            href="/contact"
          >
            {reply.intent === "custom_quote"
              ? "Submit quote specifications & artwork →"
              : "Contact our support team directly →"}
          </Link>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer with Auto-Growing Multi-line Textarea */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="space-y-2 border-t bg-card p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="support-chat-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            maxLength={reply?.collectOrderId ? 80 : 2000}
            placeholder={
              reply?.collectOrderId
                ? "Enter your order ID (e.g. ABS-1024)..."
                : "Type a message... (Press Enter for new line)"
            }
            className="flex min-h-[40px] max-h-32 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />

          <Button
            type="submit"
            size="sm"
            className="h-10 px-3 shrink-0"
            aria-label="Send support message"
            disabled={busy || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}{" "}
            <Link href="/sign-in" className="underline font-medium">
              Sign in
            </Link>
          </p>
        )}

        <p className="text-[10px] text-muted-foreground leading-tight">
          Press <strong>Enter</strong> for a new line. Click Send or press <strong>Ctrl+Enter</strong> to send.
        </p>
      </form>
    </section>
  );
}