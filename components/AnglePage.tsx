'use client'

import { useState, useEffect, useRef, RefObject } from 'react'
import MarketingHomepage from './MarketingHomepage'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

import Button from './ui/Button'

import { hasSubscriptionAccess } from '@/lib/subscriptionStatus'

const ADMIN_EMAILS = [
  'josh@angle.coach',
  'morgan@anglemethod.com',
  'ninagrishchenko2003@gmail.com',
]

const isAdminEmail = (email?: string | null) => (
  !!email && ADMIN_EMAILS.includes(email.toLowerCase())
)

// ── Utility: scroll-reveal hook ───────────────────────────────────────────────
function formatAuthError(error: { message?: string; status?: number; code?: string } | null) {
  if (!error) return 'Unknown auth error'

  const details = [error.message || 'Unknown auth error']
  if (error.code) details.push(`code: ${error.code}`)
  if (typeof error.status === 'number') details.push(`status: ${error.status}`)

  return details.join(' | ')
}

function useReveal(): [RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, visible]
}

// ── Sign In ───────────────────────────────────────────────────────────────────
function SignIn({
  authReady,
  userEmail,
  email,
  message,
  isAdmin,
  onEmailChange,
  onLogin,
  onLogout,
}: {
  authReady: boolean
  userEmail: string | null
  email: string
  message: string
  isAdmin: boolean
  onEmailChange: (value: string) => void
  onLogin: () => void
  onLogout: () => void
}) {
  const [ref, visible] = useReveal()

  return (
    <section id="signin" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-xl mx-auto text-center">
        <div className="rounded-lg border border-[#1e1e1e] p-8 md:p-12 bg-[#111110]">
        <p className="text-left text-[#666] text-xs tracking-widest uppercase mb-4">— Sign In</p>
        <h2
          className="text-left text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(32px, 4vw, 52px)' }}
        >
          Access your training dashboard
        </h2>
        <p className="text-left text-[#777] mb-8 md:mb-10">
          Sign in with your email to open your dashboard and resume your program.
        </p>

        {!authReady ? (
          <div className="py-8">
            <p className="text-sm text-[#555]">Checking your sign-in status...</p>
          </div>
        ) : userEmail ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#777]">Signed in as</p>
              <p className="mt-1 font-medium text-white break-all">{userEmail}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/dashboard"
                className="inline-block bg-white text-black font-bold text-sm tracking-widest uppercase px-6 py-3 hover:bg-[#e0e0e0] transition-colors"
              >
                Go to Dashboard
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-block rounded-[4px] border border-white/20 text-white text-sm font-bold tracking-widest uppercase px-6 py-3 hover:bg-white/10 transition-colors"
                >
                  Go to Admin
                </Link>
              )}
            </div>
            <button
              onClick={onLogout}
              className="inline-block rounded-[4px] border border-[#333] text-[#777] text-sm px-4 py-2 hover:text-white hover:border-white/20 transition-colors"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="email" aria-label="Email address"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg bg-[#111110] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555]"
            />
            <Button onClick={onLogin} fullWidth>
              Email me a sign-in link
            </Button>
            <p className="text-[#444] text-xs">
              We&apos;ll remember your email on this browser so signing in is faster next time.
            </p>
          </div>
        )}

        {message && (
          <p className="mt-4 text-sm text-[#777]">{message}</p>
        )}
        </div>
      </div>
    </section>
  )
}

export default function AnglePage() {
  const [email, setEmail] = useState(() => (
    typeof window === 'undefined' ? '' : localStorage.getItem('lastSignInEmail') ?? ''
  ))
  const [message, setMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'unknown' | 'none' | 'active' | 'inactive'>('unknown')
  const [authReady, setAuthReady] = useState(false)
  const [isStartingTraining, setIsStartingTraining] = useState(false)

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const nextEmail = session?.user?.email ?? null
      setUserEmail(nextEmail)

      if (!session?.user) {
        setSubscriptionStatus('none')
        setAuthReady(true)
        setIsStartingTraining(false)
        return
      }

      if (isAdminEmail(nextEmail)) {
        setSubscriptionStatus('active')
        setAuthReady(true)
        setIsStartingTraining(false)
        return
      }

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('[homepage] Failed to load subscription state:', error)
      }

      setSubscriptionStatus(hasSubscriptionAccess(subscription?.status) ? 'active' : 'inactive')
      setAuthReady(true)
      setIsStartingTraining(false)
    }

    syncSession()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      syncSession()
    })

    return () => { sub.subscription.unsubscribe() }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserEmail(null)
    setSubscriptionStatus('none')
    setMessage('You have been logged out.')
  }

  const handleLogin = async () => {
    if (!email.trim()) {
      setMessage('Enter your email first.')
      return
    }
    const cleanEmail = email.trim()
    localStorage.setItem('lastSignInEmail', cleanEmail)
    setMessage('Sending sign-in link...')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      })

      if (error) {
        console.error('[signin] Failed to send magic link:', error)
        setMessage(`Sign-in link failed: ${formatAuthError(error)}`)
        return
      }
    } catch (err) {
      console.error('[signin] Magic link request failed:', err)
      setMessage(`Sign-in link failed: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    setMessage('Check your email for your sign-in link.')
  }

  const handleStartTraining = async () => {
    if (!authReady || isStartingTraining) return
    setIsStartingTraining(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setSubscriptionStatus('none')
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (data?.url) {
          window.location.href = data.url
        } else {
          setIsStartingTraining(false)
          setMessage('Unable to start checkout. Please try again.')
        }
        return
      }

      if (isAdminEmail(session.user.email)) {
        setSubscriptionStatus('active')
        window.location.href = '/dashboard'
        return
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()

      const hasAccess = hasSubscriptionAccess(subscription?.status)
      setSubscriptionStatus(hasAccess ? 'active' : 'inactive')

      if (hasAccess) {
        window.location.href = '/dashboard'
        return
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      })
      const data = await res.json()

      if (data?.url) {
        window.location.href = data.url
      } else {
        setIsStartingTraining(false)
        setMessage('Unable to start checkout. Please try again.')
      }
    } catch (err) {
      console.error(err)
      setIsStartingTraining(false)
      setMessage('Something went wrong. Please try again.')
    }
  }

  const isLoggedIn = !!userEmail
  const isActiveSubscriber = subscriptionStatus === 'active'
  const ctaLabel = isActiveSubscriber
    ? 'Continue Training'
    : isLoggedIn
    ? 'Complete Membership'
    : 'Start Training'
  const loadingLabel = isActiveSubscriber ? 'Opening...' : 'Starting...'

  return (
    <MarketingHomepage
      authReady={authReady}
      isLoggedIn={isLoggedIn}
      isStartingTraining={isStartingTraining}
      ctaLabel={ctaLabel}
      loadingLabel={loadingLabel}
      message={message}
      onStartTraining={handleStartTraining}
    >
      <SignIn
        authReady={authReady}
        userEmail={userEmail}
        email={email}
        message={message}
        isAdmin={isAdminEmail(userEmail)}
        onEmailChange={setEmail}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </MarketingHomepage>
  )
}
