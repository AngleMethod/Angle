import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Mux from '@mux/mux-node'
import { createAdminClient } from '@/lib/supabase'
import { hasSubscriptionAccess } from '@/lib/subscriptionStatus'

export const MAX_REVIEW_VIDEO_DURATION_SECONDS = 120
export const MAX_REVIEW_VIDEO_SIZE_BYTES = 500 * 1024 * 1024

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
  'ninagrishchenko2003@gmail.com',
]

let muxClient: Mux | null = null

export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try { return JSON.stringify(err) } catch { return String(err) }
}

export function getMuxClient() {
  const { MUX_TOKEN_ID, MUX_TOKEN_SECRET } = process.env
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    throw new Error('Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET')
  }

  if (!muxClient) {
    muxClient = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET })
  }

  return muxClient
}

export function assertMuxSigningConfigured() {
  if (!process.env.MUX_SIGNING_KEY || !process.env.MUX_PRIVATE_KEY) {
    throw new Error('Missing MUX_SIGNING_KEY or MUX_PRIVATE_KEY')
  }
}

export type AuthedReviewUser = {
  id: string
  email: string
  isAdmin: boolean
}

export type ReviewPlaybackTokens = {
  playback?: string
  thumbnail?: string
  storyboard?: string
}

export async function getAuthedAdminReviewUser(req: NextRequest): Promise<
  | { user: AuthedReviewUser }
  | { response: NextResponse }
> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  const email = user?.email?.toLowerCase() ?? ''
  if (error || !user || !ADMIN_EMAILS.includes(email)) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }

  return { user: { id: user.id, email, isAdmin: true } }
}

export async function getActiveReviewUser(req: NextRequest): Promise<
  | { user: AuthedReviewUser }
  | { response: NextResponse }
> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const email = user.email?.toLowerCase() ?? ''
  const isAdmin = ADMIN_EMAILS.includes(email)
  if (isAdmin) {
    return { user: { id: user.id, email, isAdmin } }
  }

  const admin = createAdminClient()
  const { data: subscription, error: subscriptionErr } = await admin
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (subscriptionErr && subscriptionErr.code !== 'PGRST116') {
    console.error('[dashboard/reviews] Failed to load subscription:', subscriptionErr)
    return { response: NextResponse.json({ error: 'Unable to verify subscription' }, { status: 500 }) }
  }

  if (!hasSubscriptionAccess(subscription?.status)) {
    return { response: NextResponse.json({ error: 'Active subscription required' }, { status: 403 }) }
  }

  return { user: { id: user.id, email, isAdmin } }
}

export async function signReviewPlaybackTokens(playbackId: string): Promise<ReviewPlaybackTokens> {
  assertMuxSigningConfigured()
  const mux = getMuxClient()
  const tokens = await mux.jwt.signPlaybackId(playbackId, {
    expiration: '1h',
    type: ['video', 'thumbnail', 'storyboard'],
  })

  if (typeof tokens === 'string') {
    return { playback: tokens }
  }

  return {
    playback: tokens['playback-token'],
    thumbnail: tokens['thumbnail-token'],
    storyboard: tokens['storyboard-token'],
  }
}

export function isValidReviewMimeType(mimeType: string | null): boolean {
  if (!mimeType) return true
  return mimeType.startsWith('video/') || mimeType === 'application/octet-stream'
}
