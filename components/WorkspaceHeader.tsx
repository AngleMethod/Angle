'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Arrow from './ui/Arrow'
import s from './WorkspaceTheme.module.css'

export default function WorkspaceHeader({ isLoggedIn, authReady }: { isLoggedIn: boolean; authReady: boolean }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = pathname.startsWith('/admin')
  const links = isAdmin
    ? [{ href: '/admin', label: 'Program builder' }, { href: '/admin/videos', label: 'Video library' }, { href: '/admin/reviews', label: 'Coach reviews' }]
    : [{ href: '/dashboard', label: 'Your training' }, { href: '/#how-it-works', label: 'The method' }]

  return (
    <header className={s.header} onKeyDown={event => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        event.currentTarget.querySelector<HTMLButtonElement>('[aria-controls="workspace-navigation"]')?.focus()
      }
    }}>
      <Link href="/" aria-label="Angle home" className={s.brand}>
        <Image src="/angle-logo-white.svg" alt="Angle" width={43} height={52} priority />
        <span>MASTER HANDSTANDS<br />WITH TECHNICAL PRECISION</span>
      </Link>
      <nav className={s.desktopNav} aria-label={isAdmin ? 'Admin navigation' : 'Member navigation'}>
        {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}
      </nav>
      <div className={s.headerActions}>
        <span className={s.workspaceLabel}>{isAdmin ? 'COACH WORKSPACE' : 'YOUR ANGLE'}</span>
        {authReady && <Link className={s.headerLink} href={isLoggedIn ? '/dashboard' : '/#signin'}>{isLoggedIn ? 'Dashboard' : 'Sign in'}<Arrow /></Link>}
        <button type="button" className={s.menuToggle} aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Close −' : 'Menu +'}</button>
      </div>
      {menuOpen && <nav id="workspace-navigation" className={s.mobileNav} aria-label="Workspace mobile navigation">
        {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}<Arrow /></Link>)}
        {authReady && <Link href={isLoggedIn ? '/dashboard' : '/#signin'} onClick={() => setMenuOpen(false)}>{isLoggedIn ? 'Dashboard' : 'Sign in'}<Arrow /></Link>}
      </nav>}
    </header>
  )
}
