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
}: {
  isStartingTraining: boolean
  onStartTraining: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-10 py-4 transition-all duration-300 ${scrolled ? 'bg-black/95 backdrop-blur-md' : 'bg-transparent'}`}>
      <a href="#hero" className="flex-shrink-0">
        <Image src="/angle-logo-white.svg" alt="Angle" width={75} height={22} priority className="w-[56px] md:w-[75px] h-auto" />
      </a>
      <div className="hidden md:flex items-center gap-8">
        <a href="#how-it-works" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">How It Works</a>
        <a href="#pricing" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Pricing</a>
        <a href="#signin" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Sign In</a>
      </div>
      <button
        onClick={onStartTraining}
        className="rounded-[4px] bg-white text-black text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:bg-[#e0e0e0] transition-colors"
      >
        {isStartingTraining ? 'Starting...' : 'Start Training'}
      </button>
    </nav>
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
  return (
    <section id="hero" className="bg-[#0a0a0a] flex flex-col md:flex-row md:h-screen overflow-hidden">
      {/* Left: content */}
      <div className="relative z-10 flex flex-col justify-center px-6 pt-28 pb-8 md:pt-0 md:pb-0 md:pl-16 md:pr-8 md:w-[62%]">
        {/* Accent line — desktop only */}
        <div className="hidden md:block absolute left-10 top-1/2 -translate-y-1/2 w-[3px] h-36 bg-white" />

        <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
          <span className="text-xs px-3 py-1 rounded-full font-medium border border-green-900" style={{ backgroundColor: 'oklch(0.18 0.06 155)', color: 'oklch(0.68 0.14 155)' }}>Structured</span>
          <span className="text-xs px-3 py-1 rounded-full font-medium border border-orange-900" style={{ backgroundColor: 'oklch(0.18 0.06 50)', color: 'oklch(0.72 0.14 50)' }}>Progressive</span>
          <span className="text-xs px-3 py-1 rounded-full font-medium border border-blue-900" style={{ backgroundColor: 'oklch(0.18 0.06 240)', color: 'oklch(0.65 0.14 240)' }}>Coach-Led</span>
        </div>

        <h1
          className="text-white uppercase leading-[0.9] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 8vw, 100px)' }}
        >
          Master<br />
          Handstands<br />
          <em className="text-[#c0c0c0] italic">With A Real System</em>
        </h1>

        <p className="text-[#aaa] text-base md:text-lg leading-relaxed max-w-md mb-8 md:mb-10">
          Start with a 30-minute assessment. Then follow a custom plan built specifically for you.
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
        <p className="hidden md:flex absolute bottom-8 left-16 text-[#444] text-xs tracking-widest uppercase items-center gap-2">
          <span className="w-6 h-px bg-[#444]" /> Scroll
        </p>
      </div>

      {/* Right: athlete photo — below content on mobile, right column on desktop */}
      <div className="relative w-full aspect-[3/4] md:aspect-auto md:w-[38%] md:h-full overflow-hidden">
        <Image
          src="/hero.png"
          alt="Handstand athlete"
          fill
          className="object-contain object-center md:object-right scale-[1.15] md:scale-[1.45] origin-center md:origin-right transition-transform"
          priority
          sizes="(max-width: 768px) 100vw, 38vw"
        />
      </div>
    </section>
  )
}

// ── Feature Block ─────────────────────────────────────────────────────────────
function FeatureBlock({ isStartingTraining, onStartTraining }: { isStartingTraining: boolean; onStartTraining: () => void }) {
  const [ref, visible] = useReveal()
  return (
    <section ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-7xl mx-auto overflow-hidden rounded-2xl border border-[#222] bg-[#0a0a0a]">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">

          {/* Left: text */}
          <div className="flex flex-col justify-center p-8 md:p-12">
            <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Start Now</p>
            <h2
              className="text-white uppercase leading-[0.95] tracking-wide mb-6"
              style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(40px, 5vw, 72px)' }}
            >
              Train With More Structure.<br />
              <em className="text-[#aaa] italic">Progress With More Intent.</em>
            </h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { label: 'Assessment first', border: 'border border-purple-900', bg: 'oklch(0.18 0.06 290)', text: 'oklch(0.65 0.14 290)' },
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
    { num: '01', border: 'border border-purple-950', bg: 'oklch(0.18 0.06 290)', text: 'oklch(0.65 0.14 290)', title: 'Assessment', body: 'We identify your current level, limitations, and next progression so your training starts exactly where it should.' },
    { num: '02', border: 'border border-green-950',  bg: 'oklch(0.18 0.06 155)', text: 'oklch(0.68 0.14 155)', title: 'Custom Playlist', body: 'Get a training plan built for your level, goals, and what you need next — no guesswork, no wasted time.' },
    { num: '03', border: 'border border-orange-950', bg: 'oklch(0.18 0.06 50)',  text: 'oklch(0.72 0.14 50)',  title: 'Progress With Intent', body: 'As you improve, your training evolves with you so you keep progressing without ever losing direction.' },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
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
    { img: '/angle-2.png', title: 'Start Where You Are', body: "Whether you're still using the wall or starting to find your first freestanding holds, Angle meets you at your current level with a clear starting point and structured path forward.", reverse: false, num: '01' },
    { img: '/angle-1.png', title: 'Build Control and Consistency', body: 'As your balance and alignment improve, your training evolves with you. Each session builds toward stronger lines, better control, and more consistent freestanding handstands.', reverse: true, num: '02' },
    { img: '/angle-3.png', title: 'Progress With Intent', body: 'Move into deeper balance work, stronger shapes, and advanced handstand control — all without losing structure. The system continues to guide you as you level up.', reverse: false, num: '03' },
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
            <div key={row.num} className={`flex flex-col gap-6 py-10 md:py-16 md:gap-12 md:items-center ${row.reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
              <div className="relative w-full md:w-1/2 aspect-[4/3] overflow-hidden flex-shrink-0" style={{ background: '#111110' }}>
                <Image src={row.img} alt={row.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <div className="w-full md:w-1/2">
                <span className="text-[#444] text-xs font-bold tracking-widest">{row.num}</span>
                <h3 className="text-white uppercase text-4xl tracking-wide mt-2 mb-3 md:mb-4" style={{ fontFamily: 'var(--font-bebas)' }}>{row.title}</h3>
                <p className="text-[#777] leading-relaxed">{row.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Inside Angle ──────────────────────────────────────────────────────────────
function InsideAngle() {
  const [ref, visible] = useReveal()
  const features = [
    { title: 'Custom Playlists', body: 'Custom playlists built for you after assessment, based on your level, goals, and next progression.' },
    { title: 'Structured Sessions', body: 'Clear training flow so you always know what to do next.' },
    { title: 'Progressions That Build', body: 'Train with purpose as your balance, strength, and control improve.' },
    { title: 'Coach-Led System', body: 'Built around real coaching experience, not random drills.' },
  ]

  return (
    <section id="inside-angle" ref={ref as RefObject<HTMLElement>} className={`bg-[#0a0a0a] py-16 md:py-28 px-6 md:px-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-6xl mx-auto text-left mb-10 md:mb-14">
        <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Inside Angle</p>
        <h2
          className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
          style={{ fontFamily: 'var(--font-bebas)', fontSize: 'clamp(36px, 5vw, 60px)' }}
        >
          Everything You Need To Train With Clarity.
        </h2>
        <p className="text-[#777] max-w-xl">
          Start with an assessment, then train through playlists built specifically for your level, goals, and next progression.
        </p>
      </div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        {features.map(f => (
          <div key={f.title} className="rounded-lg border border-[#1e1e1e] p-6 hover:border-[#333] transition-colors" style={{ background: '#111110' }}>
            <h3 className="text-white font-semibold mb-3">{f.title}</h3>
            <p className="text-[#666] text-sm leading-relaxed">{f.body}</p>
          </div>
        ))}
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
          {isStartingTraining ? 'Starting...' : 'Start Your Assessment'}
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
      <Nav isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <Hero isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <FeatureBlock isStartingTraining={isStartingTraining} onStartTraining={handleStartTraining} />
      <ClearPath />
      <Journey />
      <InsideAngle />
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
