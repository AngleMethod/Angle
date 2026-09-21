'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import WorkspaceShell from '@/components/WorkspaceShell'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import s from '@/components/WorkspaceTheme.module.css'

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return <WorkspaceShell>
    <WorkspaceHeader isLoggedIn={false} authReady={false} />
    <main><section><div className={s.statePanel}>
      <p className="text-xs tracking-widest uppercase">A moment to reset</p>
      <h1>Let&apos;s try <em>again.</em></h1>
      <p>We couldn&apos;t load this page. Try again to pick up where you left off.</p>
      <div className="flex flex-wrap justify-center gap-6 items-center">
        <button type="button" className={s.stateAction} onClick={() => unstable_retry()}>Try again</button>
        <Link href="/" className="text-sm underline underline-offset-4">Back to Angle</Link>
      </div>
    </div></section></main>
  </WorkspaceShell>
}
