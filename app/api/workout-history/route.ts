import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';
import { UUID, dateInZone, monthRange, validCompletion } from '@/lib/workoutHistory';

const admins = ['josh@angle.coach', 'morgan@anglemethod.com', 'ninagrishchenko2003@gmail.com'];
const columns = 'session_id,completed_at,completed_date,workout_name,day_key,completed_exercises,total_exercises';
function reply(body: unknown, status = 200) { return NextResponse.json(body, {status, headers:{'Cache-Control':'private, no-store'}}); }
async function authenticate(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return null;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth:{persistSession:false}});
  const {data, error} = await client.auth.getUser(token);
  return error ? null : data.user;
}
export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return reply({error:'Please sign in again.'},401);
    const target = req.nextUrl.searchParams.get('userId') || user.id;
    if (target !== user.id && !admins.includes(user.email?.toLowerCase() || '')) return reply({error:'Not authorized.'},403);
    const range = monthRange(req.nextUrl.searchParams.get('month') || '');
    if (!UUID.test(target) || !range) return reply({error:'Invalid calendar request.'},400);
    const db = createAdminClient();
    // Paginate so a busy month cannot silently lose sessions at the database row limit.
    const rows = [];
    for (let offset=0; ; offset+=500) {
      const {data,error} = await db.from('workout_completions').select(columns).eq('user_id',target)
        .gte('completed_date',range.start).lt('completed_date',range.end).order('completed_at').order('session_id').range(offset,offset+499);
      if (error) return reply({error:'Workout history is unavailable. Please try again.'},503);
      rows.push(...data);
      if (data.length < 500) break;
    }
    return reply({completions:rows});
  } catch { return reply({error:'Workout history is unavailable. Please try again.'},503); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return reply({error:'Please sign in again to save your workout.'},401);
    const body = await req.json().catch(() => null);
    if (!validCompletion(body)) return reply({error:'Invalid workout completion.'},400);
    const db = createAdminClient();
    const now = new Date();
    const row = {user_id:user.id, session_id:body.sessionId, completed_at:now.toISOString(), completed_date:dateInZone(now,body.timeZone),
      time_zone:body.timeZone, workout_name:body.workoutName.trim(), day_key:body.dayKey,
      completed_exercises:body.completedExercises, total_exercises:body.totalExercises};
    // First finish wins. Retrying the same session never adds a second workout or moves its date.
    const {error} = await db.from('workout_completions').insert(row);
    if (error && error.code !== '23505') return reply({error:'Your workout could not be saved. Please retry.'},503);
    const {data,error:readError} = await db.from('workout_completions').select(columns).eq('user_id',user.id).eq('session_id',body.sessionId).single();
    if (readError) return reply({error:'Could not confirm the save. Please retry.'},503);
    return reply({completion:data});
  } catch { return reply({error:'Your workout could not be saved. Please retry.'},503); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return reply({error:'Please sign in again to update your workout.'},401);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.sessionId !== 'string' || !UUID.test(body.sessionId)
      || !Number.isInteger(body.completedExercises) || body.completedExercises < 0 || body.completedExercises > 1000)
      return reply({error:'Invalid workout correction.'},400);
    const db = createAdminClient();
    const {data:existing,error:readError} = await db.from('workout_completions').select('total_exercises')
      .eq('user_id',user.id).eq('session_id',body.sessionId).maybeSingle();
    if (readError) return reply({error:'Could not update your checkmarks. Please try again.'},503);
    if (!existing) return reply({error:'Workout not found.'},404);
    if (body.completedExercises > existing.total_exercises) return reply({error:'Invalid workout correction.'},400);
    const {data,error} = await db.from('workout_completions').update({completed_exercises:body.completedExercises})
      .eq('user_id',user.id).eq('session_id',body.sessionId).select(columns).single();
    if (error) return reply({error:'Could not update your checkmarks. Please try again.'},503);
    return reply({completion:data});
  } catch { return reply({error:'Could not update your checkmarks. Please try again.'},503); }
}
