import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Mux from '@mux/mux-node'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'josh@notecreativestudios.com'

const { MUX_TOKEN_ID, MUX_TOKEN_SECRET } = process.env

if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  throw new Error('Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET')
}

const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET })

async function getAuthedAdminUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user || user.email !== ADMIN_EMAIL) return null
  return { id: user.id, email: user.email }
}

async function resolveAssetFromUpload(uploadId: string): Promise<{ assetId: string; playbackId: string; duration: number | null } | null> {
  // Mux assigns asset_id to upload shortly after the file finishes uploading.
  // Poll briefly to handle the gap between upload completion and asset creation.
  for (let attempt = 0; attempt < 20; attempt++) {
    const upload = await mux.video.uploads.retrieve(uploadId)
    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id)
      const playback = asset.playback_ids?.find(p => p.policy === 'public')
      if (playback) {
        return {
          assetId: asset.id,
          playbackId: playback.id,
          duration: asset.duration ? Math.round(asset.duration) : null,
        }
      }
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return null
}

// GET — list videos for admin library
export async function GET(req: NextRequest) {
  const adminUser = await getAuthedAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('videos')
    .select('id, mux_playback_id, title, description, level, category, duration_seconds, created_at, archived_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to list videos:', error)
    return NextResponse.json({ error: 'Failed to list videos' }, { status: 500 })
  }

  return NextResponse.json({ videos: data ?? [] })
}

// POST — save metadata for an uploaded video
export async function POST(req: NextRequest) {
  const adminUser = await getAuthedAdminUser(req)
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const uploadId: string | undefined = body?.uploadId
  const title: string | undefined = body?.title?.trim()
  const description: string | null = body?.description?.trim() || null
  const level: string | null = body?.level?.trim() || null
  const category: string | null = body?.category?.trim() || null

  if (!uploadId || !title) {
    return NextResponse.json({ error: 'uploadId and title are required' }, { status: 400 })
  }

  const resolved = await resolveAssetFromUpload(uploadId)
  if (!resolved) {
    return NextResponse.json({ error: 'Mux asset not ready yet — try saving again in a moment' }, { status: 409 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('videos')
    .insert({
      mux_playback_id: resolved.playbackId,
      mux_asset_id: resolved.assetId,
      title,
      description,
      level,
      category,
      duration_seconds: resolved.duration,
      created_by: adminUser.id,
    })
    .select('id, mux_playback_id, title, description, level, category, duration_seconds, created_at')
    .single()

  if (error) {
    console.error('Failed to insert video:', error)
    return NextResponse.json({ error: 'Failed to save video' }, { status: 500 })
  }

  return NextResponse.json({ video: data })
}
