'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import s from './MarketingHomepage.module.css'
import Arrow from './ui/Arrow'
import MethodStory from './MethodStory'

const VideoPlayer = dynamic(() => import('./VideoPlayer'), { loading: () => <p className={s.videoLoading}>Loading student video…</p> })

const pathways = [
  { label: 'Find your balance', level: '01 / FOUNDATIONS', title: 'Your first hold starts here.', description: 'Build confidence upside down with a clear path from supported practice to your first freestanding handstand.', focus: ['Build your foundations', 'Develop body awareness', 'Explore freestanding balance'], image: '/photos-20260920/angle-new%209.jpg' },
  { label: 'Build consistency', level: '02 / CONTROL', title: 'Make the occasional hold repeatable.', description: 'Bring intention to your practice. Refine your line, understand your balance, and work toward more controlled entries and holds.', focus: ['Refine your alignment', 'Find repeatable entries', 'Develop balance control'], image: '/photos-20260920/angle-new%204.jpg' },
  { label: 'Go beyond', level: '03 / EXPRESSION', title: 'More control. More possibility.', description: 'Explore the next layer of your practice, from new shapes and transitions to the foundations of one-arm balance.', focus: ['Explore new shapes', 'Connect your transitions', 'Work toward one-arm balance'], image: '/photos-20260920/angle-new%207.jpg' },
]

const stories = [
  { name: 'Nina', time: '', outcome: '', id: 'M1VvfAhWNzjNtFLdUdzRASjYPhY6SLl3ooeRqsjkqm00', position: '50% 50%', thumb: 0 },
  { name: 'Sam Alvarez', time: '3 months in', outcome: 'First 5-second one arm handstand', id: 'TrxyBlYe2UYUAFE2K4021lVrI2Q7BzV5jd6wlOrKnDrY', position: '50% 75%', thumb: 0 },
  { name: 'Piero Battelli', time: '8 months in', outcome: 'Learning one arm saves', id: 'w4Ee6Ee00W1v00NNRmJo02mPHW74ja1yoNSANr8dQGq01gs', position: '50% 0%', thumb: 7 },
  { name: 'Jordan R.', time: '8 months in', outcome: 'Locked-in 5 finger support hold', id: 'cqwJA01YDRzRGP1PuSICbrLw4LKgEPY00lv98YvlirCiE', position: '50% 50%', thumb: 0 },
  { name: 'Meisam', time: '', outcome: 'Learning to connect shoulder and upper back', id: 'GF4Q22H02dQgTcy2bgdkeW581WsrDWqEIm7P58nqaxSo', position: '50% 50%', thumb: 0 },
  { name: 'Lucas', time: '', outcome: 'Mastering straddle one arm saves', id: 'MAOENEU17ah8VR9ErCsy6Cm02dNmNnjiUUHfZFUuP7ws', position: '50% 50%', thumb: 0 },
  { name: 'Melissa', time: '', outcome: 'Side-press to finger support hold', id: 'YiO01KihadZy5lMs488fmTt014aZr4zoono4GqEDjdA48', position: '50% 50%', thumb: 0 },
  { name: 'Marie-pier', time: '', outcome: '', id: 'Y200Y6wUpmpTIpWXaYE1aOv46jxoN2DT1SKTFQt53fn8', position: '50% 50%', thumb: 0 },
  { name: 'Tam', time: '', outcome: '', id: 'vqFTFRCRtzF7IEVcF7YWQlFxqGJRcjcq2i00Td6B7Eiw', position: '50% 50%', thumb: 0 },
]

const technique = [
  { title: 'A line with intention.', label: 'Alignment', text: 'Hand placement, shoulders, hips, and feet all contribute to your shape. Learn to recognize the details in your own practice.', x: '41%', y: '29%' },
  { title: 'Control is a skill.', label: 'Balance', text: 'A handstand is full of small adjustments. Structured progressions help you explore how those adjustments work together.', x: '48%', y: '63%' },
  { title: 'Every detail connects.', label: 'Awareness', text: 'Build an understanding of your whole position, so each practice has a purpose beyond simply staying upside down.', x: '46%', y: '91%' },
]

const questions = [
  { title: 'Where are you starting?', options: ['I’m working toward my first handstand', 'I can hold, but not consistently', 'I’m ready for advanced skills'] },
  { title: 'What would feel like progress?', options: ['Feeling confident upside down', 'More control and consistency', 'New shapes and one-arm work'] },
  { title: 'What gets in your way?', options: ['I don’t know what to practice', 'I’ve hit a plateau', 'I need structure and guidance'] },
]

const faqs = [
  ['Do I need to be able to handstand already?', 'No. Your assessment establishes your starting point, and your program is built around your current ability. Beginners and experienced handbalancers are welcome.'],
  ['What happens in the assessment?', 'The 30-minute assessment helps identify your current level, limiting factors, and next steps. It gives your personalized training plan a clear starting point.'],
  ['What does the membership include?', 'A personalized training plan, structured progressions, access to the Angle video library, and programming that evolves as your level changes.'],
  ['How often should I train?', 'Most members train 3–5 times per week. Your assessment is the place to discuss your schedule and how training can fit into it.'],
  ['Do I need special equipment?', 'You can get started with a wall. Optional equipment such as parallettes can be useful, but is not required to begin.'],
  ['Can I pause or cancel?', 'Yes. The membership is $95 per month, and you can pause or cancel anytime.'],
]

type Props = {
  authReady: boolean
  isLoggedIn: boolean
  isStartingTraining: boolean
  ctaLabel: string
  loadingLabel: string
  message: string
  onStartTraining: () => void
  children: ReactNode
}

export default function MarketingHomepage({ authReady, isLoggedIn, isStartingTraining, ctaLabel, loadingLabel, message, onStartTraining, children }: Props) {
  const [path, setPath] = useState(0)
  const [point, setPoint] = useState(0)
  const [playing, setPlaying] = useState<string | null>(null)
  const [quizOpen, setQuizOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const questionHeading = useRef<HTMLHeadingElement>(null)
  const quizTrigger = useRef<HTMLElement | null>(null)
  const activePath = pathways[path]
  const result = pathways[answers[0] ?? 0]
  const disabled = !authReady || isStartingTraining

  useEffect(() => {
    if (!quizOpen) return
    const modal = dialog.current
    const previousOverflow = document.body.style.overflow
    modal?.showModal()
    document.body.style.overflow = 'hidden'
    questionHeading.current?.focus()
    return () => {
      modal?.close()
      document.body.style.overflow = previousOverflow
      quizTrigger.current?.focus()
    }
  }, [quizOpen])

  useEffect(() => {
    if (quizOpen) questionHeading.current?.focus()
  }, [step, quizOpen])

  const openQuiz = () => {
    quizTrigger.current = document.activeElement as HTMLElement
    setAnswers([])
    setStep(0)
    setQuizOpen(true)
  }

  const start = () => { setMenuOpen(false); onStartTraining() }
  const action = (className = s.primary) => <button className={className} disabled={disabled} onClick={start}>{isStartingTraining ? loadingLabel : ctaLabel}<Arrow /></button>

  return (
    <div className={s.site}>
      <a href="#main-content" className={s.skip}>Skip to content</a>
      <header className={s.header}><div className={s.readingProgress} aria-hidden="true" />
        <a href="#hero" aria-label="Angle home" className={s.brand}><Image src="/angle-logo-white.svg" alt="Angle" width={52} height={60} priority /><span>MASTER HANDSTANDS<br />WITH TECHNICAL PRECISION</span></a>
        <nav className={s.desktopNav} aria-label="Main navigation"><a href="#how-it-works">The method</a><a href="#results">Real progress</a><a href="#pricing">Membership</a></nav>
        <div className={s.headerActions}><a className={s.signinLink} href={isLoggedIn ? '/dashboard' : '#signin'}>{isLoggedIn ? 'Dashboard' : 'Sign in'}</a>{action(s.smallButton)}<button className={s.menuToggle} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close −' : 'Menu +'}</button></div>
        {menuOpen && <nav id="mobile-navigation" className={s.mobileNav} aria-label="Mobile navigation"><a onClick={() => setMenuOpen(false)} href="#how-it-works">The method</a><a onClick={() => setMenuOpen(false)} href="#results">Real progress</a><a onClick={() => setMenuOpen(false)} href="#pricing">Membership</a><a onClick={() => setMenuOpen(false)} href={isLoggedIn ? '/dashboard' : '#signin'}>{isLoggedIn ? 'Dashboard' : 'Sign in'}</a></nav>}
      </header>

      <main id="main-content">
        <section id="hero" className={s.hero}>
          <div className={s.heroPhoto}><Image src="/photos-20260920/angle-new%203.jpg" alt="Angle athlete balancing in a one-arm handstand" fill priority sizes="(max-width: 700px) 100vw, 65vw" /><div className={s.photoGrid} aria-hidden="true" /><span className={s.photoCaption}>BALANCE IS BUILT.<br />ONE DETAIL AT A TIME.</span><span className={s.orbit} aria-hidden="true" /></div>
          <div className={s.heroContent}><p className={s.eyebrow}><i /> PERSONALIZED HANDSTAND COACHING</p><h1>DEFY<br />YOUR<span className={s.serif}>limits.</span></h1><p className={s.heroCopy}>Find your balance. Build real control.<br />A training system built around you, from your first hold to your next breakthrough.</p><div className={s.heroButtons}>{action()}<button className={s.textButton} onClick={openQuiz}>Find my starting point <Arrow /></button></div><p className={s.heroNote}>Your level. Your goals. Your Angle.</p></div>
          <div className={s.heroBottom}><span>01 — A NEW PERSPECTIVE</span><a href="#journey">EXPLORE THE METHOD <Arrow direction="down" /></a><span>STRENGTH / BALANCE / CONTROL</span></div>
        </section>

        <div className={s.principles}><span>Built around your body.</span><span>Led by a clear method.</span><span>Made for your next breakthrough.</span><span className={s.accent}>THIS IS ANGLE. <Arrow /></span></div>

        <section id="journey" className={`${s.section} ${s.light}`}>
          <div className={s.sectionHeading}><div><p className={s.eyebrow}>01 / YOUR NEXT CHAPTER</p><h2>A different starting point.<br /><span className={s.serif}>The same possibility.</span></h2></div><p>You don’t need to be “good enough” to begin.<br />You need a path that starts where you are.</p></div>
          <div className={s.pathTabs} role="group" aria-label="Choose your training level">{pathways.map((item, index) => <button key={item.level} aria-pressed={path === index} onClick={() => setPath(index)}><span>0{index + 1}</span>{item.label}<Arrow /></button>)}</div>
          <div className={s.pathPanel} aria-live="polite"><div className={s.pathPhoto}><Image src={activePath.image} alt={`Angle athlete demonstrating handstand control — ${activePath.label}`} fill sizes="(max-width: 700px) 100vw, 45vw" /><span className={s.imageTag}>THE PRACTICE IS PERSONAL.</span></div><div className={s.pathCopy}><p className={s.eyebrow}>{activePath.level}</p><h3>{activePath.title}</h3><p>{activePath.description}</p><ul>{activePath.focus.map((focus, i) => <li key={focus}><span>0{i + 1}</span>{focus}</li>)}</ul><button className={s.darkButton} onClick={openQuiz}>Find my starting point <Arrow /></button></div></div>
        </section>

        <MethodStory />

        <section className={`${s.section} ${s.technique}`} aria-labelledby="technique-title"><div className={s.techniquePhoto}><Image src="/photos-20260920/angle-new.jpg" alt="One-arm handstand with interactive technique markers" fill sizes="(max-width: 700px) 100vw, 50vw" /><div className={s.alignmentLine} aria-hidden="true" />{technique.map((item, index) => <button key={item.label} className={s.hotspot} style={{ left: item.x, top: item.y }} aria-label={`Explore ${item.label.toLowerCase()}`} aria-pressed={point === index} onClick={() => setPoint(index)}>{index + 1}</button>)}<span className={s.imageTag}>EXPLORE THE DETAILS +</span></div><div className={s.techniqueCopy}><p className={s.eyebrow}>03 / A CLOSER LOOK</p><h2 id="technique-title">Small details.<br /><span className={s.serif}>A different feeling.</span></h2><p>There’s more to a handstand than the hold. Explore three ideas behind a more intentional practice.</p><div className={s.techniqueTabs} role="group" aria-label="Technique focus">{technique.map((item, index) => <button key={item.label} aria-pressed={point === index} onClick={() => setPoint(index)}>{item.label}</button>)}</div><div className={s.techniqueDetail} aria-live="polite"><span>0{point + 1}</span><h3>{technique[point].title}</h3><p>{technique[point].text}</p></div><p className={s.fine}>An introduction to the method. Your assessment guides your individual training.</p></div></section>

        <section id="results" className={`${s.section} ${s.results}`}><div className={s.sectionHeading}><div><p className={s.eyebrow}>04 / THE WORK, IN MOTION</p><h2>Real practice.<br /><span className={s.serif}>Visible progress.</span></h2></div><p>Individual journeys. Meaningful breakthroughs.<br />Watch Angle members in their own practice.</p></div><div className={s.stories}>{stories.map((story) => <article key={story.id}><div className={s.storyVideo}>{playing === story.id ? <><VideoPlayer playbackId={story.id} aspect="4/5" autoPlay poster={`https://image.mux.com/${story.id}/thumbnail.png?width=720&time=${story.thumb}`} objectFit="cover" /><button className={s.closeVideo} onClick={() => setPlaying(null)} aria-label={`Close ${story.name}'s video`}>×</button></> : <button className={s.playCard} onClick={() => setPlaying(story.id)} aria-label={`Play ${story.name}'s progress video`}><Image unoptimized src={`https://image.mux.com/${story.id}/thumbnail.png?width=720&time=${story.thumb}`} alt={story.outcome || `${story.name} practicing handstands`} fill sizes="(max-width: 700px) 100vw, 30vw" style={{ objectPosition: story.position }} /><span className={s.playIcon}>▶</span><span className={s.watchLabel}>WATCH THE PROGRESS <Arrow /></span></button>}</div><div className={s.storyMeta}><h3>{story.name}</h3>{story.time && <span>{story.time}</span>}</div>{story.outcome && <p>{story.outcome}</p>}</article>)}</div><p className={s.fine}>These are individual member milestones, not a promised timeline. Every practice develops differently.</p></section>

        <section className={s.quizBanner}><p className={s.eyebrow}>YOUR PRACTICE STARTS WITH A QUESTION.</p><h2>Take your handstand to the <span className={s.serif}>next level</span></h2><p>Three quick questions. A suggested starting direction.<br />No email needed.</p><button className={s.darkButton} onClick={openQuiz}>Find my starting point <Arrow /></button><span className={s.bannerMark} aria-hidden="true"><Arrow /></span></section>

        <section id="pricing" className={`${s.section} ${s.pricing}`}><div><p className={s.eyebrow}>05 / YOUR ANGLE MEMBERSHIP</p><h2>Commit to<br /><span className={s.serif}>your potential.</span></h2><p className={s.pricingIntro}>One membership. A training plan that grows with you.<br />Everything you need to start training with intention.</p><div className={s.priceVisual}><Image src="/photos-20260920/angle-new%201.jpg" alt="Athlete exploring an advanced handstand shape" fill sizes="(max-width: 700px) 100vw, 40vw" /><span>MAKE ROOM FOR POSSIBILITY.</span></div></div><div className={s.priceCard}><div className={s.priceCardTop}><span>ANGLE MEMBERSHIP</span><span>ALL LEVELS</span></div><div className={s.price}>$95<span>PER MONTH</span></div><p>A clear plan. A stronger practice.</p><ul>{['Personalized onboarding and assessment', 'A training plan built for your current level', 'Clear, step-by-step progressions', 'Full access to the Angle video library', 'Coach-guided training structure', 'Programming that evolves with your ability'].map(item => <li key={item}><span><Arrow /></span>{item}</li>)}</ul>{action()}<p className={s.priceNote}>Pause or cancel anytime.</p><div className={s.priceFoot}>Not sure where to start? <button onClick={openQuiz}>Find your starting point <Arrow /></button></div></div></section>

        <section id="faq" className={`${s.section} ${s.faq}`}><div><p className={s.eyebrow}>A LITTLE MORE CLARITY</p><h2>Good<br /><span className={s.serif}>questions.</span></h2></div><div className={s.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
        <div className={s.signin}>{children}</div>
        <section className={s.closing}><p className={s.eyebrow}>UNLOCK YOUR POTENTIAL</p><h2>See what<br /><span className={s.serif}>you’re capable of.</span></h2>{action()}</section>
      </main>
      <footer className={s.footer}><a href="#hero" aria-label="Back to top"><Image src="/angle-logo-footer-black.svg" alt="Angle" width={800} height={240} /></a><div><span>© {new Date().getFullYear()} Angle</span><span>MASTER HANDSTANDS WITH TECHNICAL PRECISION</span><a href="#hero">BACK TO TOP <Arrow direction="up" /></a></div></footer>
      <div className={s.mobileCta}><span>$95 <small>/ month</small></span>{action(s.smallButton)}</div>
      {message && <div role="status" className={s.toast}>{message}</div>}

      {quizOpen && <dialog aria-labelledby="starting-point-heading" ref={dialog} className={s.dialog} onCancel={() => setQuizOpen(false)} onClick={event => { if (event.target === event.currentTarget) setQuizOpen(false) }}><div className={s.dialogInner}><button className={s.closeQuiz} aria-label="Close starting point quiz" onClick={() => setQuizOpen(false)}>×</button><p className={s.eyebrow}>{step < 3 ? `FIND YOUR ANGLE / 0${step + 1} OF 03` : 'YOUR STARTING DIRECTION'}</p><div className={s.quizProgress} aria-hidden="true"><span style={{ width: `${Math.min(step + 1, 3) / 3 * 100}%` }} /></div><h2 id="starting-point-heading" ref={questionHeading} tabIndex={-1}>{step < 3 ? questions[step].title : result.label}</h2>{step < 3 ? <><div className={s.quizOptions}>{questions[step].options.map((option, index) => <button key={option} onClick={() => { setAnswers([...answers.slice(0, step), index]); setStep(step + 1) }}><span>0{index + 1}</span>{option}<Arrow /></button>)}</div>{step > 0 && <button className={s.textButton} onClick={() => setStep(step - 1)}><Arrow direction="left" /> Previous question</button>}<p className={s.fine}>No email required. Your answers stay in this page.</p></> : <><p>{result.description}</p><div className={s.quizResult}><span>YOUR FOCUS</span><strong>{questions[1].options[answers[1]]}</strong><span>WHAT YOUR PLAN SHOULD ADDRESS</span><strong>{questions[2].options[answers[2]]}</strong></div><p className={s.fine}>This is a suggested direction, not an assessment. Your coach will establish the right starting point with you.</p><a className={s.primary} href="#pricing" onClick={() => { setPath(answers[0]); setQuizOpen(false) }}>Explore membership <Arrow /></a><button className={s.textButton} onClick={() => { setStep(0); setAnswers([]) }}>Retake the quiz <Arrow direction="reset" /></button></>}</div></dialog>}
    </div>
  )
}
