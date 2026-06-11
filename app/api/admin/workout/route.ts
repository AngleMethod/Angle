import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
  'ninagrishchenko2003@gmail.com',
]

type WorkoutRow = {
  steps?: unknown
}

type AdminNoteRow = {
  goals?: string | null
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
  const [workoutResult, notesResult] = await Promise.all([
    admin
      .from('user_workouts')
      .select('steps')
      .eq('user_id', userId)
      .single(),
    admin
      .from('user_admin_notes')
      .select('goals')
      .eq('user_id', userId)
      .single(),
  ])

  const workoutData = workoutResult.data as WorkoutRow | null
  const notesData = notesResult.data as AdminNoteRow | null

  if (workoutResult.error && workoutResult.error.code !== 'PGRST116') {
    console.error('Failed to load workout:', workoutResult.error)
    return NextResponse.json({ error: 'Failed to load workout' }, { status: 500 })
  }

  if (notesResult.error && notesResult.error.code !== 'PGRST116') {
    console.error('Failed to load admin notes:', notesResult.error)
    return NextResponse.json({ error: 'Failed to load admin notes' }, { status: 500 })
  }

  return NextResponse.json({
    steps: workoutData?.steps ?? [],
    goals: notesData?.goals ?? '',
  })
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
  const updatedAt = new Date().toISOString()

  const admin = createAdminClient()
  const { error: workoutError } = await admin
    .from('user_workouts')
    .upsert({
      user_id: userId,
      steps,
      assigned_by_email: adminEmail,
      updated_at: updatedAt,
    }, { onConflict: 'user_id' })

  if (workoutError) {
    console.error('Failed to save workout:', workoutError)
    return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 })
  }

  const { error: notesError } = await admin
    .from('user_admin_notes')
    .upsert({
      user_id: userId,
      goals: goals || null,
      updated_at: updatedAt,
    }, { onConflict: 'user_id' })

  if (notesError) {
    console.error('Failed to save admin notes:', notesError)
    return NextResponse.json({ error: 'Failed to save admin notes' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
