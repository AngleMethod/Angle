'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import s from './MarketingHomepage.module.css'

const chapters = [
  { label: 'Assess', title: 'Start with understanding.', copy: 'Your body. Your experience. Your goals. A 30-minute assessment brings them together, so your training starts in the right place.', image: '/photos-20260920/angle-new%202.jpg', cue: 'YOUR STARTING POINT', detail: 'An assessment built around you', tags: ['Current ability', 'Your goals', 'Next steps'] },
  { label: 'Practice', title: 'Make every session count.', copy: 'Turn intention into practice. Follow a personalized plan, with clear progressions and the Angle video library to guide the details.', image: '/photos-20260920/angle-new%205.jpg', cue: 'PRACTICE WITH PURPOSE', detail: 'A clear direction for your training', tags: ['Personalized plan', 'Video guidance', 'Clear progressions'] },
  { label: 'Progress', title: 'Find your next possibility.', copy: 'Progress is more than a longer hold. As your ability develops, your programming evolves with it. Keep exploring what comes next.', image: '/photos-20260920/angle-new%208.jpg', cue: 'KEEP EVOLVING', detail: 'Your practice grows with you', tags: ['Refine control', 'Build consistency', 'Explore new skills'] },
]

export default function MethodStory() {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const section = root.current
    if (!section) return
    const media = window.matchMedia('(min-width: 801px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)')
    let frame = 0
    const update = () => {
      frame = 0
      if (!media.matches) return
      const panels = Array.from(section.querySelectorAll<HTMLElement>('[data-method-chapter]'))
      const middle = window.innerHeight * 0.55
      let nearest = 0
      let distance = Infinity
      panels.forEach((panel, index) => {
        const box = panel.getBoundingClientRect()
        const delta = Math.abs(box.top + box.height / 2 - middle)
        if (delta < distance) { distance = delta; nearest = index }
      })
      setActive(previous => previous === nearest ? previous : nearest)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    media.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      media.removeEventListener('change', schedule)
    }
  }, [])

  return (
    <section ref={root} id="how-it-works" className={`${s.section} ${s.method} ${s.methodStory}`}>
      <div className={s.sectionHeading}>
        <div><p className={s.eyebrow}>02 / THE ANGLE METHOD</p><h2>Less guesswork.<br /><span className={s.serif}>More intention.</span></h2></div>
        <p>A practice with a direction.<br />Scroll through the method ↓</p>
      </div>
      <div className={s.storyLayout}>
        <div className={s.storyStage} aria-hidden="true">
          {chapters.map((chapter, index) => (
            <div key={chapter.label} className={s.storyFrame} data-active={active === index}>
              <Image src={chapter.image} alt="" fill sizes="(max-width: 800px) 100vw, 48vw" />
            </div>
          ))}
          <div className={s.storyReticle}><span /><span /></div>
          <div className={s.storyBadge}><span className={s.storyDot} /> THE ANGLE METHOD</div>
          <span className={s.storyCount}>0{active + 1}<small> / 03</small></span>
          <div className={s.storyCue} key={active}><span>{chapters[active].cue}</span><strong>{chapters[active].detail}</strong></div>
          <div className={s.storyRail}>{chapters.map((chapter, index) => <span key={chapter.label} data-active={index <= active} />)}</div>
        </div>
        <div className={s.storyChapters}>
          {chapters.map((chapter, index) => (
            <article key={chapter.label} data-method-chapter={index} data-active={active === index} className={s.storyChapter}>
              <p className={s.eyebrow}>0{index + 1} / {chapter.label.toUpperCase()}</p>
              <h3>{chapter.title}</h3>
              <p>{chapter.copy}</p>
              <div className={s.chapterTags}>{chapter.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              {index === 2 && <a className={s.textButton} href="#pricing">Explore your membership ↗</a>}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
