'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import s from './Chat.module.css'

type Message = { id: string; senderRole: 'admin' | 'user'; body: string; createdAt: string; unread?: boolean }
type Thread = { userId: string; userEmail: string; latestMessage: string; latestAt: string; unreadCount: number }
type Member = { userId: string; email: string }
async function request(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Please sign in again to use messages.')
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...init?.headers } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not connect. Please try again.')
  return result
}
export default function Chat({ admin = false, onThreadsChange }: { admin?: boolean; onThreadsChange?: (threads: Thread[]) => void }) {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<Thread[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [inboxError, setInboxError] = useState('')
  const [inboxLoaded, setInboxLoaded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState('')
  const [newBelow, setNewBelow] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const nearBottom = useRef(true)
  const sendLock = useRef(false)
  const generation = useRef(0)
  const sendRevision = useRef(0)
  const endpoint = admin ? '/api/admin/messages' : '/api/dashboard/messages'
  const key = admin ? selected?.userId || '' : 'coach'
  const draft = drafts[key] || ''
  const unread = admin ? threads.reduce((n, t) => n + t.unreadCount, 0) : messages.filter(m => m.unread).length
  useEffect(() => { onThreadsChange?.(threads) }, [threads, onThreadsChange])
  const bottom = useCallback(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
    nearBottom.current = true
    setNewBelow(false)
  }, [])
  useEffect(() => {
    if (!open) return
    const el = dialog.current
    const previous = document.activeElement as HTMLElement | null
    el?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { el?.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [open])
  useEffect(() => {
    let cancelled = false
    let busy = false
    const refresh = async () => {
      if (busy || document.hidden || sendLock.current) return
      busy = true
      try {
        if (admin) {
          const data = await request(endpoint)
          if (!cancelled) { setThreads(data.threads || []); setInboxLoaded(true); setInboxError('') }
        } else if (!open) {
          const data = await request(endpoint)
          if (!cancelled) setMessages(data.messages || [])
        }
      } catch (e) { if (!cancelled && admin) { setInboxLoaded(true); setInboxError(e instanceof Error ? e.message : 'Could not load your inbox.') } }
      finally { busy = false }
    }
    void refresh()
    const timer = setInterval(refresh, open ? 5000 : 20000)
    document.addEventListener('visibilitychange', refresh)
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [admin, endpoint, open])
  useEffect(() => {
    if (!open || !admin) return
    let cancelled = false
    request('/api/admin/active-users').then(data => { if (!cancelled) setMembers(data.users || []) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [open, admin])
  useEffect(() => {
    if (!open || (admin && !key)) return
    const current = ++generation.current
    let cancelled = false
    let busy = false
    let lastId = ''
    const refresh = async () => {
      if (busy || document.hidden || sendLock.current) return
      busy = true
      try {
        const revision = sendRevision.current
        const data = await request(endpoint + (admin ? `?userId=${encodeURIComponent(key)}` : ''))
        if (cancelled || current !== generation.current || revision !== sendRevision.current || sendLock.current) return
        const incoming: Message[] = data.messages || []
        setMessages(incoming)
        setLoaded(true)
        setError('')
        const latest = incoming.at(-1)?.id || ''
        if (latest !== lastId) {
          if (nearBottom.current) requestAnimationFrame(bottom)
          else setNewBelow(true)
          lastId = latest
        }
        // Only acknowledge the fetched messages while the visible conversation is at its latest message.
        const ids = incoming.filter(m => m.unread).map(m => m.id)
        if (ids.length && nearBottom.current && !document.hidden && dialog.current?.open) {
          await request(endpoint, { method: 'PATCH', body: JSON.stringify({ userId: key, ids }) })
          if (!cancelled) {
            setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, unread: false } : m))
            if (admin) setThreads(prev => prev.map(t => t.userId === key ? { ...t, unreadCount: Math.max(0, t.unreadCount - ids.length) } : t))
          }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not refresh messages.') }
      finally { busy = false }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    document.addEventListener('visibilitychange', refresh)
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [open, key, admin, endpoint, bottom])
  async function send() {
    const body = draft.trim()
    if (!body || sendLock.current || !key) return
    sendLock.current = true
    sendRevision.current += 1
    setSending(true); setPending(body); setSendError('')
    const currentKey = key
    try {
      const data = await request(endpoint, { method: 'POST', body: JSON.stringify({ userId: currentKey, body }) })
      setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message])
      setDrafts(prev => ({ ...prev, [currentKey]: '' }))
      if (input.current) input.current.style.height = 'auto'
      requestAnimationFrame(bottom)
    } catch (e) { setSendError((e instanceof Error ? e.message : 'Could not send.') + ' Your draft is saved here; check the conversation before trying again.') }
    finally { sendRevision.current += 1; sendLock.current = false; setSending(false); setPending(''); input.current?.focus() }
  }
  const contacts = [...threads.map(t => ({ ...t, email: t.userEmail })), ...members.filter(m => !threads.some(t => t.userId === m.userId)).map(m => ({ ...m, latestMessage: 'Start a conversation', latestAt: '', unreadCount: 0 }))].filter(m => m.email.toLowerCase().includes(search.toLowerCase()))
  return <>
    <button className={s.launcher} onClick={() => { setOpen(true); setLoaded(false); setNewBelow(false); setSendError(''); nearBottom.current = true }} aria-label={`${admin ? 'Open student inbox' : 'Message your coach'}${unread ? `, ${unread} unread` : ''}`}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3Z" /></svg>
      {admin ? 'Messages' : 'Message coach'}{unread > 0 && <span className={s.badge}>{unread}</span>}
    </button>
    {open && <dialog ref={dialog} className={s.dialog} onCancel={e => { e.preventDefault(); setOpen(false) }} aria-labelledby="chat-title">
      <header className={s.header}>{admin && selected && <button disabled={sending} onClick={() => { setSelected(null); setMessages([]); setError(''); setNewBelow(false) }} aria-label="Back to inbox">Back</button>}<div><h2 id="chat-title">{admin ? selected?.email || 'Your inbox' : 'Your coach'}</h2><p>{admin ? 'Student conversations' : 'Questions, updates, and your next breakthrough.'}</p></div><button onClick={() => setOpen(false)} aria-label="Close messages">Close</button></header>
      {admin && !selected ? <div className={s.inbox}><input type="search" aria-label="Search students" placeholder="Find a student…" value={search} onChange={e => setSearch(e.target.value)} />{contacts.map(t => <button className={s.contact} key={t.userId} onClick={() => { setSelected({ userId: t.userId, email: t.email }); setMessages([]); setLoaded(false); setError(''); setNewBelow(false); setSendError(''); nearBottom.current = true }}><span className={s.avatar}>{t.email[0].toUpperCase()}</span><span><strong>{t.email}</strong><small>{t.latestMessage}</small></span>{t.unreadCount > 0 && <span className={s.badge}>{t.unreadCount}</span>}</button>)}{!inboxLoaded && <p>Loading your inbox…</p>}{inboxLoaded && !contacts.length && !inboxError && <p>No conversations found.</p>}{inboxError && <p role="alert">{inboxError} We’ll retry automatically.</p>}{error && <p role="alert">{error}</p>}</div> : <>
        <div className={s.messages} ref={scroll} onScroll={() => { const el = scroll.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; if (nearBottom.current) setNewBelow(false) }} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
          {!loaded && <p className={s.empty}>Loading conversation…</p>}{loaded && !messages.length && <p className={s.empty}>Start with a hello. Your conversation lives here.</p>}
          {messages.map((m, i) => { const mine = m.senderRole === (admin ? 'admin' : 'user'); const day = new Date(m.createdAt).toLocaleDateString(); return <div key={m.id}>{(!i || day !== new Date(messages[i-1].createdAt).toLocaleDateString()) && <p className={s.day}>{day}</p>}<div className={`${s.row} ${mine ? s.mine : ''}`}><div className={s.bubble}><p>{m.body}</p><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div></div></div> })}
          {sending && <div className={`${s.row} ${s.mine}`}><div className={s.bubble}><p>{pending}</p><small>Sending…</small></div></div>}
        </div>
        {newBelow && <button className={s.newMessages} onClick={bottom}>New messages — jump to latest</button>}
        {(sendError || error) && <p className={s.error} role="alert">{sendError || error}</p>}
        <form className={s.composer} onSubmit={e => { e.preventDefault(); void send() }}><textarea ref={input} aria-label="Message" rows={1} maxLength={4000} placeholder="Message…" value={draft} disabled={sending} onChange={e => { setDrafts(prev => ({ ...prev, [key]: e.target.value })); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px` }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); void send() } }} /><button type="submit" disabled={sending || !draft.trim()} aria-label="Send message"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 11 16-7-7 16-2-7-7-2Zm7 2 9-9" /></svg></button></form>
      </>}
    </dialog>}
  </>
}