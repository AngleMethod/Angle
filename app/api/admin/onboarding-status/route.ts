import { renderAngleEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'josh@angle.coach',
  'morgan@anglemethod.com',
  'ninagrishchenko2003@gmail.com',
]
const VALID_STATUSES = ['not_booked', 'booked', 'completed']

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const REPLY_TO_EMAIL = 'josh@angle.coach'
const DASHBOARD_URL = 'https://angle.coach/dashboard'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return !!user?.email && ADMIN_EMAILS.includes(user.email)
}

function buildProgramReadyEmailHtml(): string {
  return renderAngleEmail({eyebrow: 'Your training starts here', title: 'Your next level.', accent: 'Your plan.', descriptionHtml: 'Your training program is ready. We’ve built your personalized handstand plan based on your assessment. Open your dashboard to start your first session.', actionLabel: 'View your program', actionUrl: DASHBOARD_URL})
}

function buildProgramReadyEmailText(): string {
  return `Your training program is ready.

We've built your personalized handstand training plan based on your assessment.

Start here:
${DASHBOARD_URL}

— Angle`
}

async function sendProgramReadyEmail(toEmail: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('Resend send skipped: RESEND_API_KEY not set')
    return false
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: REPLY_TO_EMAIL,
    subject: 'Your program is ready — Angle',
    html: buildProgramReadyEmailHtml(),
    text: buildProgramReadyEmailText(),
  })

  if (error) {
    console.error('Resend send failed:', error)
    return false
  }

  console.log('Program-ready email sent:', toEmail)
  return true
}

type EmailResult =
  | { attempted: false; sent: false; reason: 'not_completed' | 'already_completed' | 'missing_email' }
  | { attempted: true; sent: boolean }

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, status } = await req.json()
  if (!userId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'userId and valid status required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('subscriptions')
    .select('onboarding_status')
    .eq('user_id', userId)
    .single()
  const previousStatus: string | undefined = existing?.onboarding_status

  const { error } = await admin
    .from('subscriptions')
    .update({ onboarding_status: status })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to update onboarding status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  let emailResult: EmailResult

  if (status !== 'completed') {
    emailResult = { attempted: false, sent: false, reason: 'not_completed' }
  } else if (previousStatus === 'completed') {
    emailResult = { attempted: false, sent: false, reason: 'already_completed' }
  } else {
    let recipientEmail: string | null = null
    try {
      const { data: userResult } = await admin.auth.admin.getUserById(userId)
      recipientEmail = userResult?.user?.email ?? null
    } catch (err) {
      console.error('Program-ready email error:', err)
    }

    if (!recipientEmail) {
      console.error('Program-ready email skipped: no email for user', userId)
      emailResult = { attempted: false, sent: false, reason: 'missing_email' }
    } else {
      const sent = await sendProgramReadyEmail(recipientEmail)
      emailResult = { attempted: true, sent }
    }
  }

  return NextResponse.json({ success: true, email: emailResult })
}
