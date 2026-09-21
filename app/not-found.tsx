import Link from 'next/link'
import WorkspaceShell from '@/components/WorkspaceShell'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import Arrow from '@/components/ui/Arrow'
import s from '@/components/WorkspaceTheme.module.css'

export default function NotFound() {
  return <WorkspaceShell>
    <WorkspaceHeader isLoggedIn={false} authReady={false} />
    <main><section><div className={s.statePanel}>
      <p className="text-xs tracking-widest uppercase">404 / A different direction</p>
      <h1>Find your <em>way back.</em></h1>
      <p>This page isn&apos;t here. Your next step still is.</p>
      <Link href="/" className={s.stateAction}>Back to Angle <Arrow /></Link>
    </div></section></main>
  </WorkspaceShell>
}
