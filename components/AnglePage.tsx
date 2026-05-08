'use client'

import { useState, useEffect, useRef, RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import Button from './ui/Button'
import VideoPlayer from './VideoPlayer'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
]

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

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({
  isStartingTraining,
  onStartTraining,
}: {
  isStartingTraining: boolean
  onStartTraining: () => void
}) {
  const [scrollVisible, setScrollVisible] = useState(true)
  useEffect(() => {
    const fn = () => setScrollVisible(window.scrollY < 60)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const heroPills = [
    { label: 'Assessment',    border: 'border border-purple-900', bg: 'oklch(0.18 0.06 290)', text: 'oklch(0.65 0.14 290)' },
    { label: 'Built for you', border: 'border border-green-900',  bg: 'oklch(0.18 0.06 155)', text: 'oklch(0.68 0.14 155)' },
    { label: 'Progressions',  border: 'border border-orange-900', bg: 'oklch(0.18 0.06 50)',  text: 'oklch(0.72 0.14 50)'  },
    { label: 'Coach-led',     border: 'border border-blue-900',   bg: 'oklch(0.18 0.06 240)', text: 'oklch(0.65 0.14 240)' },
  ]
  const [activePill, setActivePill] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setActivePill(prev => (prev + 1) % heroPills.length), 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="hero" className="relative bg-[#0a0a0a] flex flex-col md:flex-row md:h-screen md:px-12 overflow-hidden">
      {/* Left: content */}
      <div className="relative z-10 flex flex-col justify-center px-6 pt-28 pb-8 md:pt-24 md:pb-0 md:pl-16 md:pr-8 md:w-[50%]">

        <div className="relative h-7 mb-4 md:mb-6">
          {heroPills.map((pill, i) => (
            <span
              key={pill.label}
              className={`absolute text-xs px-3 py-1 rounded-full font-medium transition-opacity duration-500 ${pill.border} ${i === activePill ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundColor: pill.bg, color: pill.text }}
            >
              {pill.label}
            </span>
          ))}
        </div>

        <h1
          className="text-white uppercase leading-[0.9] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(45px, 8vw, 100px)' }}
        >
          Master Handstands<br />
          <em className="text-[#c0c0c0] italic">With A Proven System</em>
        </h1>

        <p className="text-[#aaa] text-base md:text-lg leading-relaxed max-w-md mb-8 md:mb-10">
          A personalized handstand training plan built for you.
        </p>

        <div>
          <Button onClick={onStartTraining} className="md:px-10">
            {isStartingTraining ? 'Starting...' : 'Start Training'}
          </Button>
          <p className="mt-4 text-sm text-[#555]">
            Already a member?{' '}
            <a href="#signin" className="text-[#888] underline hover:text-white transition-colors">Sign in</a>
          </p>
        </div>

        {/* Scroll indicator — desktop only */}
        <button
          onClick={() => document.getElementById('start-now')?.scrollIntoView({ behavior: 'smooth' })}
          className={`hidden md:flex absolute bottom-8 left-16 text-[#444] text-xs tracking-widest uppercase items-center gap-2 hover:text-[#666] transition-all duration-500 ${scrollVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <span className="w-6 h-px bg-current" />
          Scroll
          <svg className="w-3 h-3 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Right: athlete photo — below content on mobile, right column on desktop */}
      <div className="md:w-[50%] md:flex md:items-center md:justify-center md:flex-shrink-0">
        <div className="relative aspect-square w-[calc(100%-3rem)] mx-6 md:mx-0 md:w-[70%] overflow-hidden rounded-lg border border-[#222] bg-[#111110]">
          <Image
            src="/angle-5.jpeg"
            alt="Handstand athlete"
            fill
            className="object-contain object-center origin-center"
            priority
            sizes="(max-width: 768px) 100vw, 35vw"
          />
        </div>
      </div>
    </section>
  )
}

// ── Feature Block ─────────────────────────────────────────────────────────────
function FeatureBlock({ isStartingTraining, onStartTraining }: { isStartingTraining: boolean; onStartTraining: () => void }) {
  const [ref, visible] = useReveal()
  return (
    <section id="start-now" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-7xl mx-auto overflow-hidden rounded-2xl border border-[#222] bg-[#0a0a0a]">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">

          {/* Left: text */}
          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Start Now</p>
            <h2
              className="text-white uppercase leading-[0.95] tracking-wide mb-6"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(40px, 5vw, 72px)' }}
            >
              Personalized Handstand Training<br />
              <em className="text-[#aaa] italic">Built Around You</em>
            </h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { label: 'Assessment', border: 'border border-purple-900', bg: 'oklch(0.18 0.06 290)', text: 'oklch(0.65 0.14 290)' },
                { label: 'Built for you',    border: 'border border-green-900',  bg: 'oklch(0.18 0.06 155)', text: 'oklch(0.68 0.14 155)' },
                { label: 'Progressions',     border: 'border border-orange-900', bg: 'oklch(0.18 0.06 50)',  text: 'oklch(0.72 0.14 50)'  },
                { label: 'Coach-led',        border: 'border border-blue-900',   bg: 'oklch(0.18 0.06 240)', text: 'oklch(0.65 0.14 240)' },
              ].map(tag => (
                <span key={tag.label} className={`text-xs px-3 py-1 rounded-full font-medium ${tag.border}`} style={{ backgroundColor: tag.bg, color: tag.text }}>{tag.label}</span>
              ))}
            </div>
            <p className="text-[#888] leading-relaxed mb-8 max-w-md">
              Start with an assessment, then train with a custom program built for your body, level, and goals.
            </p>
            <button onClick={onStartTraining} className="self-start inline-block rounded-[4px] border border-white text-white text-xs font-bold tracking-widest uppercase px-8 py-3 hover:bg-white hover:text-black transition-colors">
              {isStartingTraining ? 'Starting...' : 'Start Training'}
            </button>
          </div>

          {/* Right: image grid — desktop */}
          <div className="hidden md:grid grid-cols-2 gap-2 min-h-[480px] pt-12 pr-12 pb-12" style={{ background: '#0a0a0a' }}>
            <div className="relative col-span-1 row-span-2 rounded-lg overflow-hidden bg-[#111110]">
              <Image src="/angle-8.jpeg" alt="Athlete" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" quality={100} />
            </div>
            <div className="relative rounded-lg overflow-hidden bg-[#111110]">
              <Image src="/angle-1.jpeg" alt="Athlete" fill className="object-cover" sizes="(max-width: 768px) 100vw, 20vw" quality={100} />
            </div>
            <div className="relative rounded-lg overflow-hidden bg-[#111110]">
              <Image src="/angle-3.jpeg" alt="Athlete" fill className="object-cover" style={{ objectFit: 'cover', objectPosition: 'center top' }} sizes="(max-width: 768px) 100vw, 20vw" quality={100} />
            </div>
          </div>

          {/* Right: single image — mobile */}
          <div className="block md:hidden relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-[#111110]">
            <Image src="/angle-1.jpeg" alt="Athlete" fill className="object-cover" sizes="100vw" />
          </div>

        </div>
      </div>
    </section>
  )
}

// ── Clear Path (How It Works) ─────────────────────────────────────────────────
function ClearPath() {
  const [ref, visible] = useReveal()
  const steps = [
    { num: '01', border: 'border border-purple-950', bg: 'oklch(0.18 0.06 290)', text: 'oklch(0.65 0.14 290)', title: 'Assessment', body: 'We identify your level and what to work on next, so you start in the right place.' },
    { num: '02', border: 'border border-green-950',  bg: 'oklch(0.18 0.06 155)', text: 'oklch(0.68 0.14 155)', title: 'Built For You', body: 'Get a plan built for your level, no guesswork, no wasted time.' },
    { num: '03', border: 'border border-orange-950', bg: 'oklch(0.18 0.06 50)',  text: 'oklch(0.72 0.14 50)',  title: 'Progress With Intent', body: 'As you improve, your training evolves with you, so you keep progressing.' },
    { num: '04', border: 'border border-blue-900',   bg: 'oklch(0.18 0.06 240)', text: 'oklch(0.65 0.14 240)', title: 'Coach-Led', body: 'Train with real coaching and clear instruction at every stage.' },
  ]

  return (
    <section id="how-it-works" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— How It Works</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          A Clear Path To Your First —<br />Or Next — Handstand
        </h2>
        <p className="text-[#777] max-w-xl mb-10 md:mb-14">
          The Angle Method gives you structured training built around your current level, so you can stop guessing and start progressing.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {steps.map(s => (
            <div key={s.num} className="rounded-lg border border-[#222] p-6 md:p-8 hover:border-[#333] transition-colors">
              <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold mb-5 md:mb-6 ${s.border}`} style={{ backgroundColor: s.bg, color: s.text }}>{s.num}</span>
              <h3 className="text-white text-2xl uppercase tracking-wide mb-3" style={{ fontFamily: 'var(--font-bebas)' }}>{s.title}</h3>
              <p className="text-[#777] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Journey ───────────────────────────────────────────────────────────────────
function Journey() {
  const [ref, visible] = useReveal()
  const rows = [
    { img: '/angle-4.jpeg', eyebrow: 'Assessment',   eyebrowBorder: 'border border-purple-900', eyebrowBg: 'oklch(0.18 0.06 290)', eyebrowText: 'oklch(0.65 0.14 290)', title: 'Start At Your Exact Level',          body: 'Begin with a 30-minute assessment to identify where you are right now. Your training plan is built specifically for you — so you always know what to do next.',                              reverse: false },
    { img: '/angle-6.jpeg', eyebrow: 'Built for you', eyebrowBorder: 'border border-green-900',  eyebrowBg: 'oklch(0.18 0.06 155)', eyebrowText: 'oklch(0.68 0.14 155)', title: 'A Plan Built Specifically For You',     body: "Get a custom program designed specifically for your body's unique strengths.",                                                                                                          reverse: true  },
    { img: '/angle-2.jpeg', eyebrow: 'Progressions',  eyebrowBorder: 'border border-orange-900', eyebrowBg: 'oklch(0.18 0.06 50)',  eyebrowText: 'oklch(0.72 0.14 50)',  title: 'Build Control, Step By Step',          body: "Follow structured progressions that develop strength, balance, and guide you towards your goals. Each phase builds on the last — so you're always improving.",                         reverse: false },
    { img: '/angle-3.jpeg', eyebrow: 'Coach-led',     eyebrowBorder: 'border border-blue-900',   eyebrowBg: 'oklch(0.18 0.06 240)', eyebrowText: 'oklch(0.65 0.14 240)', title: 'Train With Guidance, Not Guesswork',   body: "Get your questions answered with clear instruction, demonstrations, and direction at every stage. You're not training alone — the system guides you forward.",                                               reverse: true  },
  ]

  return (
    <section id="journey" ref={ref as RefObject<HTMLElement>} className={`bg-[#0e0e0d] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— The Journey</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          A System That Grows With You
        </h2>
        <p className="text-[#777] max-w-xl mb-10 md:mb-14">
          Start where you are, build real control, and progress toward advanced handstand training — all within one system.
        </p>

        <div className="divide-y divide-[#1a1a1a]">
          {rows.map(row => (
            <div key={row.eyebrow} className={`flex flex-col gap-6 py-10 md:py-16 md:gap-12 md:items-center ${row.reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
              <div className="relative w-full md:w-1/2 aspect-[4/3] overflow-hidden flex-shrink-0 rounded-lg bg-[#111110]">
                <Image src={row.img} alt={row.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <div className="w-full md:w-1/2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium mb-4 md:mb-6 inline-block ${row.eyebrowBorder}`} style={{ backgroundColor: row.eyebrowBg, color: row.eyebrowText }}>{row.eyebrow}</span>
                <h3 className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6" style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(28px, 3.5vw, 48px)' }}>{row.title}</h3>
                <p className="text-[#777] leading-relaxed">{row.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Proof ─────────────────────────────────────────────────────────────────────
type ProofItem = {
  name: string
  instagram?: string
  timeframe: string
  outcome: string
  quote?: string
  playbackId: string
  imagePosition?: string
  thumbTime?: number
}

function Proof() {
  const [ref, visible] = useReveal()
  const [activeId, setActiveId] = useState<string | null>(null)

  // Paste real Mux playbackIds into the `playbackId` fields below.
  const proofItems: ProofItem[] = [
    { name: 'Sam Alvarez', instagram: '', timeframe: '3 months in', outcome: 'First 5-second one arm handstand', playbackId: 'TrxyBlYe2UYUAFE2K4021lVrI2Q7BzV5jd6wlOrKnDrY', imagePosition: '50% 75%' },
    { name: 'Piero Battelli', instagram: '', timeframe: '8 months in', outcome: 'Learning one arm saves', playbackId: 'w4Ee6Ee00W1v00NNRmJo02mPHW74ja1yoNSANr8dQGq01gs', thumbTime: 7, imagePosition: '50% 0%' },
    { name: 'Jordan R.', instagram: '', timeframe: '8 months in', outcome: 'Locked-in 5 finger support hold', playbackId: 'cqwJA01YDRzRGP1PuSICbrLw4LKgEPY00lv98YvlirCiE' },
  ]

  return (
    <section ref={ref as RefObject<HTMLElement>} className={`bg-[#0e0e0d] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Real Progress</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          Proof You Can See
        </h2>
        <p className="text-[#777] max-w-xl mb-10 md:mb-14">
          Real students. Real training. Visible progress from following a structured handstand system.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {proofItems.map(item => {
            const cardKey = `${item.name}-${item.timeframe}`
            const isActive = !!item.playbackId && activeId === cardKey
            const thumbUrl = item.playbackId ? `https://image.mux.com/${item.playbackId}/thumbnail.png?width=720&time=${item.thumbTime ?? 0}` : null

            return (
              <div key={cardKey} className="rounded-lg bg-[#111110] border border-[#1e1e1e] overflow-hidden">
                <div className="relative aspect-[4/5] w-full bg-[#0a0a0a]">
                  {isActive ? (
                    <VideoPlayer playbackId={item.playbackId} aspect="4/5" autoPlay poster={thumbUrl ?? undefined} objectFit="cover" />
                  ) : thumbUrl ? (
                    <button
                      type="button"
                      onClick={() => setActiveId(cardKey)}
                      className="group absolute inset-0 w-full h-full"
                      aria-label={`Play ${item.name}'s progress video`}
                    >
                      <Image
                        src={thumbUrl}
                        alt={`${item.name} — ${item.outcome}`}
                        fill
                        className="object-cover"
                        style={{ objectPosition: item.imagePosition ?? '50% 50%' }}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                      <span aria-hidden className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                      <span aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/95 group-hover:bg-white transition-colors">
                        <span className="block ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-black" />
                      </span>
                    </button>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[#555] text-xs tracking-widest uppercase">Video coming soon</p>
                    </div>
                  )}
                </div>
                <div className="p-6 md:p-8">
                  {item.quote ? (
                    <p className="text-[#ccc] text-sm leading-relaxed mb-4 italic">&ldquo;{item.quote}&rdquo;</p>
                  ) : null}
                  <p className="text-white font-semibold text-sm">{item.name}</p>
                  {item.instagram ? (
                    <a
                      href={`https://instagram.com/${item.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[#666] text-xs mt-0.5 hover:text-[#aaa] transition-colors"
                    >
                      @{item.instagram}
                    </a>
                  ) : null}
                  <p className="text-[#777] text-xs mt-1">{item.timeframe}</p>
                  <p className="text-[#aaa] text-sm mt-3 leading-relaxed">{item.outcome}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing({
  isStartingTraining,
  onStartTraining,
}: {
  isStartingTraining: boolean
  onStartTraining: () => void
}) {
  const [ref, visible] = useReveal()
  const features = [
    'A personalized plan built for your exact level',
    'Step-by-step progressions so you always know what to do next',
    'Full access to the complete Angle video library',
    'Coach-guided structure designed for long-term progress',
    'Personalized onboarding and assessment process',
    'New programming as your level evolves',
    'Train with a proven system instead of random drills',
  ]

  return (
    <section id="pricing" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto text-center mb-10 md:mb-14">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Pricing</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          One Plan<br />Everything Included
        </h2>
        <p className="text-[#777]">Built for your level. Designed to take you from your current ability to your next handstand.</p>
      </div>
      <div className="max-w-xl mx-auto rounded-lg bg-[#111110] border border-[#1e1e1e] p-6 md:p-10 text-center">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">Angle Member</p>
        <p className="text-[#777] text-sm mb-4">Most members see progress within 4–6 weeks.</p>
        <div className="mb-8">
          <span className="text-white" style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(60px, 8vw, 96px)' }}>$95</span>
          <span className="text-[#666] text-lg">/mo</span>
        </div>
        <ul className="space-y-3 mb-4 text-left">
          {features.map(f => (
            <li key={f} className="flex items-center gap-3 text-[#ccc] text-sm">
              <span className="text-green-500">✓</span> {f}
            </li>
          ))}
        </ul>
        <p className="text-[#777] text-sm text-left mb-10">No guesswork. No wasted time.</p>
        <Button onClick={onStartTraining} fullWidth>
          {isStartingTraining ? 'Starting...' : 'Start Training'}
        </Button>
        <p className="text-[#444] text-xs mt-4">Pause or cancel anytime. No commitment.</p>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [ref, visible] = useReveal()
  const [open, setOpen] = useState<number | null>(null)
  const items = [
    { q: "What if I've never done a handstand before?", a: "That's exactly where most people start. You'll begin at your current level and follow a clear progression from the wall to your first freestanding hold." },
    { q: "What if I'm already training but not progressing?", a: "Most people stall because they're guessing. Angle removes that guesswork and gives you a structured path so you always know what to do next." },
    { q: 'What happens in the 30-minute assessment?', a: 'We evaluate your current level, identify your limiting factors, and map out the exact next steps for your training so you can start progressing immediately.' },
    { q: 'How much time do I need to train?', a: 'Most members train 3–5 times per week. Sessions are designed to be focused and efficient so you can make consistent progress without wasting time.' },
    { q: 'Do I need any equipment?', a: "You can get started with just a wall. Optional tools like parallettes can help, but aren't required." },
    { q: "Is this safe if I've had wrist or shoulder issues?", a: 'We start with an assessment that accounts for any limitations. Most members with wrist or shoulder history train successfully — we adjust your starting point and progressions accordingly.' },
    { q: 'How is this different from YouTube tutorials?', a: "YouTube gives you exercises. Angle gives you a system — what to do, when to do it, and how to progress — so you don't waste months figuring it out yourself." },
    { q: 'Is the program actually personalized?', a: "Yes. Your training is based on your current level and evolves as you improve, so you're always working on the right things at the right time." },
    { q: 'How long until I see results?', a: 'Most members notice real improvements within 4–6 weeks of consistent training.' },
    { q: 'Can I pause or cancel anytime?', a: 'Yes. You can pause or cancel whenever you want.' },
  ]

  return (
    <section id="faq" ref={ref as RefObject<HTMLElement>} className={`bg-[#0e0e0d] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-3xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— FAQ</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-10 md:mb-14"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          Common Questions
        </h2>
        <div className="divide-y divide-[#1a1a1a] border-t border-b border-[#1a1a1a]">
          {items.map((item, i) => (
            <div key={i} className="py-6 md:py-7">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-white font-medium text-sm md:text-base">{item.q}</span>
                <span className="text-white text-xl ml-4 flex-shrink-0">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <p className="mt-4 text-[#777] leading-relaxed text-sm">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
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
          Access Your Training Dashboard
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
              type="email"
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

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-white border-t border-[#e5e5e5] py-8 md:py-10 px-6 md:px-12">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
        <Image src="/angle-logo-footer-black.svg" alt="Angle" width={800} height={240} style={{ width: '100%', height: 'auto' }} />
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-[#777] text-xs tracking-widest uppercase">
          <a href="#how-it-works" className="hover:text-[#444] transition-colors">How It Works</a>
          <a href="#pricing" className="hover:text-[#444] transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-[#444] transition-colors">FAQ</a>
          <a href="#signin" className="hover:text-[#444] transition-colors">Sign In</a>
        </div>
        <p className="text-[#777] text-xs">© 2026 Angle. All rights reserved.</p>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnglePage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isStartingTraining, setIsStartingTraining] = useState(false)

  useEffect(() => {
    const savedEmail = localStorage.getItem('lastSignInEmail')
    if (savedEmail) setEmail(savedEmail)

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserEmail(session?.user?.email ?? null)
      setAuthReady(true)
      setIsStartingTraining(false)
    }

    syncSession()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
      setAuthReady(true)
      setIsStartingTraining(false)
    })

    return () => { sub.subscription.unsubscribe() }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserEmail(null)
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

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()

      if (subscription?.status === 'active') {
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

  return (
    <main className="bg-[#0a0a0a] text-white overflow-x-hidden">
      <Nav isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} isLoggedIn={!!userEmail} authReady={authReady} />
      <Hero isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <FeatureBlock isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <ClearPath />
      <Journey />
      <Proof />
      <Pricing isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <FAQ />
      <SignIn
        authReady={authReady}
        userEmail={userEmail}
        email={email}
        message={message}
        isAdmin={!!userEmail && ADMIN_EMAILS.includes(userEmail)}
        onEmailChange={setEmail}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <Footer />
    </main>
  )
}
