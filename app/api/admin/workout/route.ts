import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
]

type WorkoutRow = {
  steps?: unknown
  goals?: string | null
}

function isMissingGoalsColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { message?: unknown; details?: unknown }
  const text = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase()
  return text.includes('goals') && (text.includes('column') || text.includes('schema cache'))
}

async function getAdminEmail(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) return null
  return user.email
}

export async function GET(req: NextRequest) {
  if (!await getAdminEmail(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const initial = await admin
    .from('user_workouts')
    .select('steps, goals')
    .eq('user_id', userId)
    .single()

  let data = initial.data as WorkoutRow | null
  let error = initial.error

  if (error && isMissingGoalsColumn(error)) {
    const fallback = await admin
      .from('user_workouts')
      .select('steps')
      .eq('user_id', userId)
      .single()
    data = fallback.data as WorkoutRow | null
    error = fallback.error
  }

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to load workout:', error)
    return NextResponse.json({ error: 'Failed to load workout' }, { status: 500 })
  }

  return NextResponse.json({ steps: data?.steps ?? [], goals: data?.goals ?? '' })
}

export async function POST(req: NextRequest) {
  const adminEmail = await getAdminEmail(req)
  if (!adminEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, steps, goals: rawGoals } = await req.json()
  if (!userId || !Array.isArray(steps)) {
    return NextResponse.json({ error: 'userId and steps required' }, { status: 400 })
  }

  const goals = typeof rawGoals === 'string' ? rawGoals.trim() : ''

  const admin = createAdminClient()
  const payload = {
    user_id: userId,
    steps,
    goals: goals || null,
    assigned_by_email: adminEmail,
    updated_at: new Date().toISOString(),
  }

  const initial = await admin
    .from('user_workouts')
    .upsert(payload, { onConflict: 'user_id' })

  let error = initial.error

  if (error && isMissingGoalsColumn(error)) {
    const fallbackPayload = {
      user_id: payload.user_id,
      steps: payload.steps,
      assigned_by_email: payload.assigned_by_email,
      updated_at: payload.updated_at,
    }
    const fallback = await admin
      .from('user_workouts')
      .upsert(fallbackPayload, { onConflict: 'user_id' })
    error = fallback.error
  }

  if (error) {
    console.error('Failed to save workout:', error)
    return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
