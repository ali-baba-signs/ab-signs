'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { adminPath } from '@/lib/auth/admin-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  ArrowLeft, 
  Send, 
  Search, 
  RefreshCw, 
  MessageSquare, 
  User, 
  ShieldCheck, 
  Clock, 
  Mail, 
  AlertCircle 
} from 'lucide-react'

type Session = {
  sessionId: string
  userName: string | null
  userEmail: string | null
  message: string
  createdAt: string
}

type Message = {
  id: string
  message: string
  isAdminMessage: boolean
  createdAt: string
}

export default function AdminLiveChatPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadSessions(silent = false) {
    if (!silent) setIsRefreshing(true)
    try {
      const response = await fetch('/api/admin/live-chat', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error?.message || 'Unable to load support chat.')
        return
      }
      const fetched: Session[] = payload.data?.sessions || []
      setSessions(fetched)
      setError('')
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch conversations')
    } finally {
      if (!silent) setIsRefreshing(false)
    }
  }

  async function open(session: Session) {
    setSelected(session)
    setIsLoadingMessages(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/live-chat?sessionId=${session.sessionId}`, {
        credentials: 'include',
        cache: 'no-store'
      })
      const payload = await response.json()
      if (response.ok) {
        setMessages(payload.data?.messages || [])
      } else {
        setError(payload.error?.message || 'Unable to load conversation messages.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversation')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/api/admin/live-chat', {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Unable to load support chat.')
        setSessions(payload.data?.sessions || [])
      } catch (err: any) {
        if (!controller.signal.aborted) setError(err.message)
      }
    })()
    return () => controller.abort()
  }, [])

  // Filter sessions by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredSessions(
      sessions.filter((s) => 
        (s.userName?.toLowerCase().includes(q)) ||
        (s.userEmail?.toLowerCase().includes(q)) ||
        (s.message?.toLowerCase().includes(q))
      )
    )
  }, [searchQuery, sessions])

  async function send() {
    if (!selected || !reply.trim() || isSending) return
    setIsSending(true)
    try {
      const response = await fetch('/api/admin/live-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: selected.sessionId, message: reply })
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error?.message || 'Reply could not be sent.')
        return
      }
      setReply('')
      await open(selected)
      await loadSessions(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.slice(0, 2).toUpperCase()
    if (email) return email.slice(0, 2).toUpperCase()
    return 'CU'
  }

  return (
    <main className="flex h-screen flex-col bg-slate-50 dark:bg-background">
      {/* Header bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
        <div className="flex items-center gap-4">
          <Link
            href={adminPath()}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            Support Chat 
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {sessions.length}
            </span>
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadSessions()}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-6 py-2.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Sessions List */}
        <aside className="flex w-80 lg:w-96 flex-col border-r bg-card">
          {/* Search box */}
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Conversations scroll area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 stroke-1 text-muted-foreground/60" />
                No conversations found.
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isCurrent = selected?.sessionId === session.sessionId
                const customerName = session.userName || session.userEmail || 'Guest Customer'

                return (
                  <button
                    key={session.sessionId}
                    onClick={() => void open(session)}
                    className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/50 ${
                      isCurrent ? 'bg-accent/80 border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {getInitials(session.userName, session.userEmail)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="truncate text-xs font-bold text-foreground">
                          {customerName}
                        </p>
                        <time className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                      {session.userEmail && session.userName && (
                        <p className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {session.userEmail}
                        </p>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-snug">
                        {session.message}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Right Column: Chat Box */}
        <section className="flex flex-1 flex-col bg-background">
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
                    {getInitials(selected.userName, selected.userEmail)}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold leading-tight text-foreground">
                      {selected.userName || 'Guest Customer'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selected.userEmail || `Session: ${selected.sessionId.slice(0, 8)}...`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border px-2.5 py-1 rounded-full">
                  <Clock className="h-3.5 w-3.5" />
                  Started {new Date(selected.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Message Bubble Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {isLoadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    No messages yet in this session.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.isAdminMessage
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                          {isAdmin ? (
                            <>
                              <ShieldCheck className="h-3 w-3 text-primary" />
                              <span className="font-semibold text-primary">Support Agent</span>
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" />
                              <span className="font-medium">{selected.userName || 'Customer'}</span>
                            </>
                          )}
                          <span>•</span>
                          <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                        </div>

                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap ${
                            isAdmin
                              ? 'bg-primary text-primary-foreground rounded-tr-xs'
                              : 'bg-card border text-card-foreground rounded-tl-xs'
                          }`}
                        >
                          {message.message}
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t bg-card p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void send()
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={reply}
                    maxLength={2000}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply... (Press Enter to send)"
                    disabled={isSending}
                    className="flex-1 bg-background"
                  />
                  <Button type="submit" disabled={!reply.trim() || isSending} className="gap-2 shrink-0">
                    <Send className="h-4 w-4" />
                    {isSending ? 'Sending...' : 'Send'}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
                <MessageSquare className="h-8 w-8 opacity-60" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No conversation selected</h3>
              <p className="mt-1 text-xs max-w-xs">
                Select a support inquiry from the list on the left to start responding to customers.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}