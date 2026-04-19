import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'josh@notecreativestudios.com'

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

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('user_workouts')
    .select('steps')
    .eq('user_id', userId)
    .single()

  return NextResponse.json({ steps: data?.steps ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, steps } = await req.json()
  if (!userId || !Array.isArray(steps)) {
    return NextResponse.json({ error: 'userId and steps required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_workouts')
    .upsert({
      user_id: userId,
      steps,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Failed to save workout:', error)
    return NextResponse.json({ error: 'Failed to save workout' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
