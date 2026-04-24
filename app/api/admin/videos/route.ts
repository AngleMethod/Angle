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

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

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

type ResolveOk = { kind: 'ok'; assetId: string; playbackId: string; duration: number | null }
type ResolvePending = { kind: 'pending' }
type ResolveError = { kind: 'error'; message: string; stage: 'upload_retrieve' | 'asset_retrieve' }
type ResolveResult = ResolveOk | ResolvePending | ResolveError

async function resolveAssetFromUpload(uploadId: string): Promise<ResolveResult> {
  for (let attempt = 0; attempt < 20; attempt++) {
    let upload
    try {
      upload = await mux.video.uploads.retrieve(uploadId)
    } catch (err) {
      console.error('[videos POST] Mux upload retrieve failed:', { uploadId, attempt, error: describeError(err) })
      return { kind: 'error', message: describeError(err), stage: 'upload_retrieve' }
    }

    console.log('[videos POST] Mux upload retrieve:', { uploadId, attempt, status: upload.status, assetId: upload.asset_id ?? null })

    if (upload.asset_id) {
      let asset
      try {
        asset = await mux.video.assets.retrieve(upload.asset_id)
      } catch (err) {
        console.error('[videos POST] Mux asset retrieve failed:', { assetId: upload.asset_id, error: describeError(err) })
        return { kind: 'error', message: describeError(err), stage: 'asset_retrieve' }
      }

      console.log('[videos POST] Mux asset retrieve:', {
        assetId: asset.id,
        status: asset.status,
        playbackCount: asset.playback_ids?.length ?? 0,
      })

      const playback = asset.playback_ids?.find(p => p.policy === 'public')
      if (playback) {
        return {
          kind: 'ok',
          assetId: asset.id,
          playbackId: playback.id,
          duration: asset.duration ? Math.round(asset.duration) : null,
        }
      }
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  return { kind: 'pending' }
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
    console.error('[videos GET] Supabase select failed:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
    return NextResponse.json({ error: `Failed to list videos: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ videos: data ?? [] })
}

// POST — save metadata for an uploaded video
export async function POST(req: NextRequest) {
  const adminUser = await getAuthedAdminUser(req)
  if (!adminUser) {
    console.error('[videos POST] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const uploadId: string | undefined = body?.uploadId
  const title: string | undefined = body?.title?.trim()
  const description: string | null = body?.description?.trim() || null
  const level: string | null = body?.level?.trim() || null
  const category: string | null = body?.category?.trim() || null

  console.log('[videos POST] Save request:', { hasUploadId: !!uploadId, hasTitle: !!title, hasDescription: !!description, level, category })

  if (!uploadId || !title) {
    return NextResponse.json({ error: 'uploadId and title are required' }, { status: 400 })
  }

  const resolved = await resolveAssetFromUpload(uploadId)

  if (resolved.kind === 'error') {
    return NextResponse.json(
      { error: `Mux ${resolved.stage} failed: ${resolved.message}` },
      { status: 502 }
    )
  }

  if (resolved.kind === 'pending') {
    console.log('[videos POST] Mux still processing — returning 409')
    return NextResponse.json(
      { error: 'Mux is still processing. Try saving again in 10 seconds.' },
      { status: 409 }
    )
  }

  console.log('[videos POST] Inserting video row:', {
    mux_playback_id: resolved.playbackId,
    mux_asset_id: resolved.assetId,
    title,
    duration: resolved.duration,
  })

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
    console.error('[videos POST] Supabase insert failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    const detail = error.details ? ` — ${error.details}` : ''
    return NextResponse.json(
      { error: `Supabase insert failed: ${error.message}${detail}` },
      { status: 500 }
    )
  }

  console.log('[videos POST] Saved:', { id: data?.id })
  return NextResponse.json({ video: data })
}
