'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Arrow from './ui/Arrow';
import { instagramProfile, instagramReels, instagramStatsDate } from '@/lib/instagramReels';
import s from './InstagramReels.module.css';

const number = (value: number) => value.toLocaleString('en-US');
const totalViews = instagramReels.reduce((sum, reel) => sum + reel.views, 0);
function InstagramIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>;
}
function processEmbeds() {
  const instagram = (window as Window & { instgrm?: { Embeds?: { process: () => void } } }).instgrm;
  instagram?.Embeds?.process();
}

export default function InstagramReels() {
  const section = useRef<HTMLElement>(null);
  const [loadEmbeds, setLoadEmbeds] = useState(false);
  useEffect(() => {
    const target = section.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setLoadEmbeds(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <section ref={section} id="instagram" className={s.section} aria-labelledby="instagram-heading">
    <div className={s.headingRow}>
      <div><p className={s.eyebrow}><InstagramIcon /> THE OTHER SIDE OF THE PRACTICE</p>
        <h2 id="instagram-heading">Serious skill.<br /><em>A less serious side.</em></h2>
        <p className={s.intro}>Handstands, a little chaos, and the lighter side of practice.<br />Three pinned favorites from Josh&apos;s Instagram.</p>
      </div>
      <a className={s.profile} href={instagramProfile} target="_blank" rel="noopener noreferrer"><InstagramIcon /><span>FOLLOW ALONG<strong>@joshie.lee</strong></span><Arrow /></a>
    </div>
    <div className={s.totals}><span><strong>{(totalViews / 1000000).toFixed(2)}M</strong> views across these three reels</span><span>PINNED / 01—03</span></div>
    <div className={s.grid}>
      {instagramReels.map((reel, index) => {
        const url = `https://www.instagram.com/reel/${reel.id}/`;
        return <article className={s.card} key={reel.id} aria-label={`Pinned reel ${index + 1}: ${reel.title}`}>
          <div className={s.cardTop}><span>PINNED REEL / 0{index + 1}</span><Arrow /></div>
          <div className={s.embed}>
            <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14">
              <a href={url} target="_blank" rel="noopener noreferrer" className={s.fallback}><InstagramIcon /><span>{reel.title}</span><span>Watch on Instagram <Arrow /></span></a>
            </blockquote>
          </div>
          <div className={s.cardBody}>
            <h3>{reel.title}</h3>
            <p className={s.views}><strong>{number(reel.views)}</strong><span>VIEWS</span></p>
            <dl className={s.stats}>{([['Likes', reel.likes], ['Comments', reel.comments], ['Shares', reel.shares], ['Saves', reel.saves]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}</dl>
            <details className={s.more}><summary>More reel insights <span aria-hidden="true">+</span></summary>
              <dl>{([['Viewers', number(reel.viewers)], ['Interactions', number(reel.interactions)], ['Accounts engaged', number(reel.accountsEngaged)], ['Follows', number(reel.follows)], ['Views · followers', `${reel.followerViewsPercent}%`], ['Views · non-followers', `${(100 - reel.followerViewsPercent).toFixed(1)}%`], ['Interactions · followers', `${reel.followerInteractionsPercent}%`], ['Interactions · non-followers', `${(100 - reel.followerInteractionsPercent).toFixed(1)}%`]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            </details>
            <a className={s.watch} href={url} target="_blank" rel="noopener noreferrer">Watch on Instagram <Arrow /></a>
          </div>
        </article>;
      })}
    </div>
    <p className={s.note}>Instagram Insights · Updated <time dateTime={instagramStatsDate}>October 4, 2026</time>. Counts are a snapshot and may differ from Instagram&apos;s current public counts.</p>
    {loadEmbeds && <Script id="angle-instagram-embeds" src="https://www.instagram.com/embed.js" strategy="afterInteractive" onReady={processEmbeds} />}
  </section>;
}
