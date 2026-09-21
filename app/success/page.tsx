'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import styles from '@/components/WorkspaceTheme.module.css'

type Stage = 'loading' | 'sending' | 'sent' | 'error'

function formatAuthError(error: { message?: string; status?: number; code?: string } | null) {
  if (!error) return 'Unknown auth error'

  const details = [error.message || 'Unknown auth error']
  if (error.code) details.push(`code: ${error.code}`)
  if (typeof error.status === 'number') details.push(`status: ${error.status}`)

  return details.join(' | ')
}

function SuccessInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [stage, setStage] = useState<Stage>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!sessionId) {
        if (!cancelled) setStage('error')
        return
      }

      try {
        const res = await fetch(`/api/checkout-session?session_id=${encodeURIComponent(sessionId)}`)
        if (!res.ok) {
          if (!cancelled) setStage('error')
          return
        }

        const data = await res.json()
        const resolvedEmail: string | undefined = data?.email
        if (!resolvedEmail) {
          if (!cancelled) setStage('error')
          return
        }

        if (cancelled) return
        setEmail(resolvedEmail)
        setStage('sending')

        localStorage.setItem('lastSignInEmail', resolvedEmail)

        const { error } = await supabase.auth.signInWithOtp({
          email: resolvedEmail,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        })

        if (cancelled) return
        if (error) {
          console.error('[success] Failed to send magic link:', error)
          setErrorMessage(`Sign-in link failed: ${formatAuthError(error)}`)
          setStage('error')
          return
        }
        setStage('sent')
      } catch (err) {
        console.error('[success] Magic link flow failed:', err)
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err))
          setStage('error')
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <>
      <Nav variant="minimal" isLoggedIn={false} authReady={true} />
      <main className="min-h-screen bg-[#111310] text-white">
        <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
          <div className={styles.statePanel} role="status" aria-live="polite">
            {stage === 'loading' && (
              <>
                <p className="text-[#adb5a0] text-xs tracking-widest uppercase mb-4">— Processing</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                >
                  One <em>moment.</em>
                </h1>
                <p className="text-[#b6beaa]">Confirming your payment...</p>
              </>
            )}

            {stage === 'sending' && (
              <>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                >
                  Payment <em>confirmed.</em>
                </h1>
                <p className="text-[#b6beaa]">We&apos;re sending your sign-in link...</p>
              </>
            )}

            {stage === 'sent' && (
              <>
                <div className="flex justify-center mb-4 md:mb-6">
                  <div
                    className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-medium rounded-none px-3 py-1 border border-[#4b543c]"
                    style={{ backgroundColor: '#293321', color: '#d6ed9b' }}
                  >
                    ✔ Payment Confirmed
                  </div>
                </div>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                >
                  Check your <em>email.</em>
                </h1>
                <p className="text-[#b6beaa]">
                  We sent a sign-in link to {email}. Open it to enter Angle.
                </p>
              </>
            )}

            {stage === 'error' && (
              <>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                >
                  Let&apos;s get you <em>back.</em>
                </h1>
                <p className="text-[#b6beaa] mb-10 md:mb-14">
                  Head back to the homepage and sign in with your email to access your account.
                </p>
                {errorMessage ? (
                  <p className="mb-8 text-sm text-[#dc2626]">{errorMessage}</p>
                ) : null}
                <Link
                  href="/"
                  className="inline-block rounded-none bg-white text-black font-bold text-sm tracking-widest uppercase px-8 py-4 hover:bg-[#e0e0e0] transition-colors"
                >
                  Back to Home
                </Link>
              </>
            )}
          </div>
        </section>
      </main>
    </>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  )
}
