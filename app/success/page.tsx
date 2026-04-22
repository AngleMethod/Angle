'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

type Stage = 'loading' | 'sending' | 'sent' | 'error'

function SuccessInner() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [stage, setStage] = useState<Stage>('loading')
  const [email, setEmail] = useState<string | null>(null)

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
          setStage('error')
          return
        }
        setStage('sent')
      } catch {
        if (!cancelled) setStage('error')
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
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
          <div className="mx-auto max-w-xl text-center">
            {stage === 'loading' && (
              <>
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Processing</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
                >
                  One Moment
                </h1>
                <p className="text-[#777]">Confirming your payment...</p>
              </>
            )}

            {stage === 'sending' && (
              <>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
                >
                  Payment Confirmed
                </h1>
                <p className="text-[#777]">We&apos;re sending your sign-in link...</p>
              </>
            )}

            {stage === 'sent' && (
              <>
                <div className="flex justify-center mb-4 md:mb-6">
                  <div
                    className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-medium rounded-full px-3 py-1 border border-green-900"
                    style={{ backgroundColor: 'oklch(0.18 0.06 155)', color: 'oklch(0.68 0.14 155)' }}
                  >
                    ✔ Payment Confirmed
                  </div>
                </div>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
                >
                  Check Your Email
                </h1>
                <p className="text-[#777]">
                  We sent a sign-in link to {email}. Open it to enter Angle.
                </p>
              </>
            )}

            {stage === 'error' && (
              <>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
                >
                  Something Went Wrong
                </h1>
                <p className="text-[#777] mb-10 md:mb-14">
                  Head back to the homepage and sign in with your email to access your account.
                </p>
                <Link
                  href="/"
                  className="inline-block rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase px-8 py-4 hover:bg-[#e0e0e0] transition-colors"
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
