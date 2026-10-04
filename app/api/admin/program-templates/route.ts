import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';
import { parseTemplateSteps, type TemplateItem } from '@/lib/programTemplates';

const admins = ['josh@angle.coach', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com'];
async function isAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return false;
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error } = await auth.auth.getUser(token);
  return !error && !!user?.email && admins.includes(user.email);
}
function failure() {
  return NextResponse.json({ error: 'Templates are unavailable. Please try again or finish the program-template database setup.' }, { status: 503 });
}
async function missingVideos(admin: ReturnType<typeof createAdminClient>, steps: TemplateItem[]) {
  const ids = [...new Set(steps.flatMap(s => s.type !== 'banner' && s.videoId ? [s.videoId] : []))];
  if (!ids.length) return [];
  const { data, error } = await admin.from('videos').select('id').in('id', ids);
  if (error) throw new Error('Could not verify library videos.');
  const present = new Set((data ?? []).map(v => v.id));
  return ids.filter(id => !present.has(id));
}
export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('program_templates').select('steps, version, updated_at').eq('id', 'beginner').single();
    if (error || !data) return failure();
    return NextResponse.json({ template: data, missingVideoIds: await missingVideos(admin, data.steps) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return failure(); }
}
export async function PUT(req: NextRequest) {
  if (!await isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  let steps: TemplateItem[], version: number;
  try {
    const body = await req.json();
    steps = parseTemplateSteps(body.steps);
    version = body.version;
    if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid template version.');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid template.' }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    if ((await missingVideos(admin, steps)).length) return NextResponse.json({ error: 'A template video was removed from the library. Replace or remove it before saving.' }, { status: 400 });
    const { data, error } = await admin.from('program_templates')
      .update({ steps, version: version + 1, updated_at: new Date().toISOString() })
      .eq('id', 'beginner').eq('version', version).select('steps, version, updated_at').maybeSingle();
    if (error) return failure();
    if (!data) return NextResponse.json({ error: 'Another coach updated this template. Reload it before saving again.' }, { status: 409 });
    return NextResponse.json({ template: data });
  } catch { return failure(); }
}
