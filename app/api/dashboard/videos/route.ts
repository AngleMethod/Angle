import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Step = { videoId?: string }

type VideoRecord = {
  id: string
  mux_playback_id: string
  title: string
  description: string | null
  level: string | null
  category: string | null
  duration_seconds: number | null
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Pull the user's workout steps from the legacy JSON column.
  const { data: workoutRow, error: workoutErr } = await admin
    .from('user_workouts')
    .select('steps')
    .eq('user_id', user.id)
    .single()

  if (workoutErr && workoutErr.code !== 'PGRST116') {
    console.error('[dashboard/videos GET] Failed to load workout:', workoutErr)
    return NextResponse.json({ videos: {} })
  }

  const steps: Step[] = Array.isArray(workoutRow?.steps) ? (workoutRow.steps as Step[]) : []
  const candidateIds = steps
    .map(s => s?.videoId)
    .filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))

  if (candidateIds.length === 0) {
    return NextResponse.json({ videos: {} })
  }

  const uniqueIds = Array.from(new Set(candidateIds))

  const { data: videos, error: videosErr } = await admin
    .from('videos')
    .select('id, mux_playback_id, title, description, level, category, duration_seconds')
    .in('id', uniqueIds)

  if (videosErr) {
    console.error('[dashboard/videos GET] Failed to fetch videos:', videosErr)
    return NextResponse.json({ videos: {} })
  }

  const map: Record<string, VideoRecord> = {}
  for (const v of (videos ?? []) as VideoRecord[]) {
    map[v.id] = v
  }

  return NextResponse.json({ videos: map })
}
