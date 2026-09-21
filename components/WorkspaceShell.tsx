import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Arrow from './ui/Arrow'
import s from './WorkspaceTheme.module.css'

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  return <div className={s.workspace}>
    {children}
    <footer className={s.footer}>
      <div className={s.footerIntro}><p>Your level. Your goals.<br /><em>Your Angle.</em></p><Link href="/">Explore the method <Arrow /></Link></div>
      <Link href="/" aria-label="Angle home" className={s.footerLogo}><Image src="/angle-logo-footer-black.svg" alt="Angle" width={800} height={240} /></Link>
      <div className={s.footerBottom}><span>© {new Date().getFullYear()} Angle</span><span>STRENGTH / BALANCE / CONTROL</span><Link href="/dashboard">Your training <Arrow /></Link></div>
    </footer>
  </div>
}
