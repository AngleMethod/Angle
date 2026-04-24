import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Mux from '@mux/mux-node'

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

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    console.error('[videos/upload POST] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    console.log('[videos/upload POST] Creating Mux direct upload')
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
      },
    })
    console.log('[videos/upload POST] Mux upload created:', { id: upload.id })

    return NextResponse.json({
      uploadId: upload.id,
      uploadUrl: upload.url,
    })
  } catch (err) {
    console.error('[videos/upload POST] Mux upload create failed:', describeError(err))
    return NextResponse.json(
      { error: `Failed to create upload: ${describeError(err)}` },
      { status: 500 }
    )
  }
}
