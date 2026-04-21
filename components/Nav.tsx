'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Button from './ui/Button'

type NavProps = {
  variant?: 'marketing' | 'minimal'
  isLoggedIn: boolean
  authReady: boolean
  isStartingTraining?: boolean
  onStartTraining?: () => void
}

export default function Nav({
  variant = 'marketing',
  isLoggedIn,
  authReady,
  isStartingTraining = false,
  onStartTraining,
}: NavProps) {
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

  const isMinimal = variant === 'minimal'
  const logoHref = isMinimal ? '/' : '#hero'

  const mobileLinks = [
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#pricing',      label: 'Pricing' },
  ]

  const handleMobileCTA = () => {
    setMenuOpen(false)
    onStartTraining?.()
  }

  const UserIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  )

  const renderUserLink = (className: string) => {
    if (!authReady) return null
    return isLoggedIn ? (
      <Link href="/dashboard" aria-label="Dashboard" className={className}>
        {UserIcon}
      </Link>
    ) : (
      <a href="#signin" aria-label="Sign in" className={className}>
        {UserIcon}
      </a>
    )
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-28 py-3 md:py-4 border-b border-[#222] transition-all duration-300 ${scrolled ? 'bg-black/95 backdrop-blur-md' : 'bg-transparent'}`}>
        <a href={logoHref} className="flex-shrink-0">
          <Image src="/angle-logo-white.svg" alt="Angle" width={75} height={22} priority className="w-[43px] md:w-[68px] h-auto" />
        </a>

        {!isMinimal && (
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Pricing</a>
            <a href="#signin" className="text-[#999] text-xs tracking-widest uppercase hover:text-white transition-colors">Sign In</a>
          </div>
        )}

        <div className="hidden md:flex items-center gap-5">
          {renderUserLink('text-[#999] hover:text-white transition-colors')}
          {!isMinimal && (
            <Button onClick={onStartTraining} size="sm">
              {isStartingTraining ? 'Starting...' : 'Start Training'}
            </Button>
          )}
        </div>

        {isMinimal ? (
          <div className="md:hidden">
            {renderUserLink('text-[#999] hover:text-white transition-colors p-1 -m-1')}
          </div>
        ) : (
          <div className="md:hidden flex items-center gap-4">
            {renderUserLink('text-[#999] hover:text-white transition-colors p-1 -m-1')}
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
        )}
      </nav>

      {!isMinimal && (
        <div
          className={`md:hidden fixed inset-0 z-[60] bg-[#0a0a0a] transition-all duration-300 ${menuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
          aria-hidden={!menuOpen}
        >
          <div className="flex items-center justify-between px-6 py-4">
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

            <Button onClick={handleMobileCTA} fullWidth>
              {isStartingTraining ? 'Starting...' : 'Start Training'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
