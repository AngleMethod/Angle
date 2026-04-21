'use client'

import { useState, useEffect, useRef, RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const ADMIN_EMAIL = 'josh@notecreativestudios.com'

// ── Utility: scroll-reveal hook ───────────────────────────────────────────────
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

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({
  isStartingTraining,
  onStartTraining,
  isLoggedIn,
  authReady,
}: {
  isStartingTraining: boolean
  onStartTraining: () => void
  isLoggedIn: boolean
  authReady: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const mobileLinks = [
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#pricing',      label: 'Pricing' },
  ]

  const handleMobileCTA = () => {
    setMenuOpen(false)
    onStartTraining()
  }

  const UserIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-28 py-3 md:py-4 border-b border-[#222] transition-all duration-300 ${scrolled ? 'bg-black/95 backdrop-blur-md' : 'bg-transparent'}`}>
        <a href="#hero" className="flex-shrink-0">
          <Image src="/angle-logo-white.svg" alt="Angle" width={75} height={22} priority className="w-[43px] md:w-[68px] h-auto" />
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">How It Works</a>
          <a href="#pricing" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Pricing</a>
          <a href="#signin" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Sign In</a>
        </div>
        <div className="hidden md:flex items-center gap-5">
          {authReady && (
            isLoggedIn ? (
              <Link href="/dashboard" aria-label="Dashboard" className="text-[#999] hover:text-white transition-colors">
                {UserIcon}
              </Link>
            ) : (
              <a href="#signin" aria-label="Sign in" className="text-[#999] hover:text-white transition-colors">
                {UserIcon}
              </a>
            )
          )}
          <button
            onClick={onStartTraining}
            className="rounded-[4px] bg-white text-black text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:bg-[#e0e0e0] transition-colors"
          >
            {isStartingTraining ? 'Starting...' : 'Start Training'}
          </button>
        </div>

        {/* Mobile: user icon + hamburger */}
        <div className="md:hidden flex items-center gap-4">
          {authReady && (
            isLoggedIn ? (
              <Link href="/dashboard" aria-label="Dashboard" className="text-[#999] hover:text-white transition-colors p-1 -m-1">
                {UserIcon}
              </Link>
            ) : (
              <a href="#signin" aria-label="Sign in" className="text-[#999] hover:text-white transition-colors p-1 -m-1">
                {UserIcon}
              </a>
            )
          )}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col gap-[5px] p-2 -mr-2"
            aria-label="Open menu"
          >
            <span className="block w-6 h-px bg-white" />
            <span className="block w-6 h-px bg-white" />
            <span className="block w-6 h-px bg-white" />
          </button>
        </div>
      </nav>

      {/* Mobile overlay menu */}
      <div
        className={`md:hidden fixed inset-0 z-[60] bg-[#0a0a0a] transition-all duration-300 ${menuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <a href="#hero" onClick={() => setMenuOpen(false)} className="flex-shrink-0">
            <Image src="/angle-logo-white.svg" alt="Angle" width={75} height={22} className="w-[43px] h-auto" />
          </a>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 -mr-2"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col justify-between h-[calc(100%-64px)] px-6 pt-8 pb-10">
          <nav className="flex flex-col gap-8">
            {mobileLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-white uppercase tracking-wide leading-none hover:text-[#aaa] transition-colors"
                style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(40px, 11vw, 64px)' }}
              >
                {link.label}
              </a>
            ))}
            {authReady && (
              isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="text-white uppercase tracking-wide leading-none hover:text-[#aaa] transition-colors"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(40px, 11vw, 64px)' }}
                >
                  Dashboard
                </Link>
              ) : (
                <a
                  href="#signin"
                  onClick={() => setMenuOpen(false)}
                  className="text-white uppercase tracking-wide leading-none hover:text-[#aaa] transition-colors"
                  style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(40px, 11vw, 64px)' }}
                >
                  Sign In
                </a>
              )
            )}
          </nav>

          <button
            onClick={handleMobileCTA}
            className="w-full rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase py-4 hover:bg-[#e0e0e0] transition-colors"
          >
            {isStartingTraining ? 'Starting...' : 'Start Training'}
          </button>
        </div>
      </div>
    </>
  )
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
    const interval = setInterval(() => setActivePill(prev => (prev + 1) % heroPills.length), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section id="hero" className="relative bg-[#0a0a0a] flex flex-col md:flex-row md:h-screen md:px-12 overflow-hidden">
      {/* Left: content */}
      <div className="relative z-10 flex flex-col justify-center px-6 pt-28 pb-8 md:pt-0 md:pb-0 md:pl-16 md:pr-8 md:w-[50%]">

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
          <em className="text-[#c0c0c0] italic">With Real Structure</em>
        </h1>

        <p className="text-[#aaa] text-base md:text-lg leading-relaxed max-w-md mb-8 md:mb-10">
          A personalized handstand training system built for your level.
        </p>

        <div>
          <button
            onClick={onStartTraining}
            className="inline-block rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase px-8 py-4 md:px-10 hover:bg-[#e0e0e0] transition-colors"
          >
            {isStartingTraining ? 'Starting...' : 'Start Training'}
          </button>
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
        <div className="relative aspect-square w-[calc(100%-3rem)] mx-6 md:mx-0 md:w-[70%] overflow-hidden rounded-lg border border-[#222]" style={{ background: '#111110' }}>
          <Image
            src="/hero.png"
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
              Train With A Proven System.<br />
              <em className="text-[#aaa] italic">Progress With More Intent.</em>
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
              Start with an assessment, then train with a custom playlist built for your level, goals, and next progression.
            </p>
            <button onClick={onStartTraining} className="self-start inline-block rounded-[4px] border border-white text-white text-xs font-bold tracking-widest uppercase px-8 py-3 hover:bg-white hover:text-black transition-colors">
              {isStartingTraining ? 'Starting...' : 'Start Training'}
            </button>
          </div>

          {/* Right: image grid — desktop */}
          <div className="hidden md:grid grid-cols-2 gap-2 min-h-[480px] pt-12 pr-12 pb-12" style={{ background: '#0a0a0a' }}>
            <div className="relative col-span-1 row-span-2 rounded-lg overflow-hidden" style={{ backgroundColor: '#111110' }}>
              <Image src="/angle-2.png" alt="Athlete" fill className="object-cover" sizes="25vw" />
            </div>
            <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: '#111110' }}>
              <Image src="/angle-1.png" alt="Athlete" fill className="object-cover" sizes="25vw" />
            </div>
            <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: '#111110' }}>
              <Image src="/angle-3.png" alt="Athlete" fill className="object-cover" sizes="25vw" />
            </div>
          </div>

          {/* Right: single image — mobile */}
          <div className="block md:hidden relative w-full aspect-[4/3] rounded-lg overflow-hidden" style={{ backgroundColor: '#111110' }}>
            <Image src="/angle-2.png" alt="Athlete" fill className="object-cover" sizes="100vw" />
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
          A Clear Path To Your First —<br />Or Next — Handstand.
        </h2>
        <p className="text-[#777] max-w-xl mb-10 md:mb-14">
          Angle gives you structured training built around your current level, so you can stop guessing and start progressing.
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
    { img: '/angle-2.png', eyebrow: 'Assessment',   eyebrowBorder: 'border border-purple-900', eyebrowBg: 'oklch(0.18 0.06 290)', eyebrowText: 'oklch(0.65 0.14 290)', title: 'Start At Your Exact Level',          body: 'Begin with a 30-minute assessment to identify where you are right now. Your training plan is built specifically for you — so you always know what to do next.',                              reverse: false },
    { img: '/angle-1.png', eyebrow: 'Progressions',  eyebrowBorder: 'border border-orange-900', eyebrowBg: 'oklch(0.18 0.06 50)',  eyebrowText: 'oklch(0.72 0.14 50)',  title: 'Build Control, Step By Step',          body: "Follow structured progressions that develop strength, balance, and alignment over time. Each phase builds on the last — so you're always improving with purpose.",                         reverse: true  },
    { img: '/angle-3.png', eyebrow: 'Coach-led',     eyebrowBorder: 'border border-blue-900',   eyebrowBg: 'oklch(0.18 0.06 240)', eyebrowText: 'oklch(0.65 0.14 240)', title: 'Train With Guidance, Not Guesswork',   body: "Get clear instruction, demonstrations, and direction at every stage. You're not figuring it out alone — the system guides you forward.",                                               reverse: false },
  ]

  return (
    <section id="journey" ref={ref as RefObject<HTMLElement>} className={`bg-[#0e0e0d] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— The Journey</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 64px)' }}
        >
          A System That Grows With You.
        </h2>
        <p className="text-[#777] max-w-xl mb-10 md:mb-14">
          Start where you are, build real control, and progress toward advanced handstand training — all within one system.
        </p>

        <div className="divide-y divide-[#1a1a1a]">
          {rows.map(row => (
            <div key={row.eyebrow} className={`flex flex-col gap-6 py-10 md:py-16 md:gap-12 md:items-center ${row.reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
              <div className="relative w-full md:w-1/2 aspect-[4/3] overflow-hidden flex-shrink-0" style={{ background: '#111110' }}>
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

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
  const [ref, visible] = useReveal()
  const quotes = [
    { quote: "After years of kicking up and hoping for the best, I finally have a real system. Eight weeks in and I'm holding a 5-second freestanding handstand for the first time.", name: 'Sarah M.', tag: '6 months in' },
    { quote: "The assessment alone changed everything. I thought my wrists were the problem — turns out it was shoulder mobility. The program addressed it immediately.", name: 'James T.', tag: 'Intermediate, 3 months in' },
    { quote: "I've tried three other programs. Angle is the only one that felt like it was actually designed for me. The progressions are exactly right — not too easy, not impossible.", name: 'Mia R.', tag: 'Yoga teacher, 2 months in' },
  ]

  return (
    <section ref={ref as RefObject<HTMLElement>} className={`bg-[#0e0e0d] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— What People Say</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-10 md:mb-14"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          Built For People Serious<br />About Their Practice.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {quotes.map(q => (
            <div key={q.name} className="rounded-lg bg-[#111] border border-[#1e1e1e] p-6 md:p-8">
              <p className="text-[#ccc] leading-relaxed mb-6 italic">&ldquo;{q.quote}&rdquo;</p>
              <div>
                <p className="text-white font-semibold text-sm">{q.name}</p>
                <p className="text-[#555] text-xs mt-1">{q.tag}</p>
              </div>
            </div>
          ))}
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
    'A plan built for your exact level',
    'A 30-minute assessment to identify what\'s holding you back',
    'Step-by-step progressions so you always know what to do next',
    'A complete video library so you can train with confidence',
  ]

  return (
    <section id="pricing" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto text-center mb-10 md:mb-14">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Pricing</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          One Plan. Everything Included.
        </h2>
        <p className="text-[#777]">Built for your level. Designed to take you from your current ability to your next handstand.</p>
      </div>
      <div className="max-w-xl mx-auto rounded-lg bg-[#111] border border-[#1e1e1e] p-6 md:p-10 text-center">
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
        <button
          onClick={onStartTraining}
          className="block w-full rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase py-4 hover:bg-[#e0e0e0] transition-colors"
        >
          {isStartingTraining ? 'Starting...' : 'Start Training'}
        </button>
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
          Common Questions.
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
        <div className="rounded-lg border border-[#1e1e1e] p-8 md:p-12" style={{ background: '#111110' }}>
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
              className="w-full rounded-lg bg-[#111] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555]"
            />
            <button
              onClick={onLogin}
              className="w-full rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase py-4 hover:bg-[#e0e0e0] transition-colors"
            >
              Email me a sign-in link
            </button>
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

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })

    if (error) {
      setMessage('Something went wrong. Please try again.')
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
        setIsStartingTraining(false)
        document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' })
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
      <Testimonials />
      <Pricing isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <FAQ />
      <SignIn
        authReady={authReady}
        userEmail={userEmail}
        email={email}
        message={message}
        isAdmin={userEmail === ADMIN_EMAIL}
        onEmailChange={setEmail}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <Footer />
    </main>
  )
}
