import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'josh@notecreativestudios.com'
const VALID_STATUSES = ['not_booked', 'booked', 'completed']

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const REPLY_TO_EMAIL = 'josh@anglemethod.com'
const DASHBOARD_URL = 'https://angle.coach/dashboard'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.email === ADMIN_EMAIL
}

function buildProgramReadyEmailHtml(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your program is ready — Angle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding-bottom:40px;">
                <span style="display:inline-block;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Angle</span>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:32px;line-height:1.1;letter-spacing:0.02em;text-transform:uppercase;color:#ffffff;font-weight:700;">
                  Your training program is ready.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#aaaaaa;">
                  We&rsquo;ve built your personalized handstand training plan based on your assessment.<br />
                  Open your dashboard to start your first session.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="${DASHBOARD_URL}" style="display:inline-block;background-color:#ffffff;color:#000000;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:16px 32px;border-radius:4px;">
                  View Dashboard
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1e1e1e;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#555555;">
                  &mdash; Angle
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function sendProgramReadyEmail(toEmail: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('Resend send skipped: RESEND_API_KEY not set')
    return
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: REPLY_TO_EMAIL,
    subject: 'Your program is ready — Angle',
    html: buildProgramReadyEmailHtml(),
  })

  if (error) {
    console.error('Resend send failed:', error)
  }
}

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

  if (status === 'completed' && previousStatus !== 'completed') {
    try {
      const { data: userResult } = await admin.auth.admin.getUserById(userId)
      const recipientEmail = userResult?.user?.email
      if (recipientEmail) {
        await sendProgramReadyEmail(recipientEmail)
      } else {
        console.error('Program-ready email skipped: no email for user', userId)
      }
    } catch (err) {
      console.error('Program-ready email error:', err)
    }
  }

  return NextResponse.json({ success: true })
}
