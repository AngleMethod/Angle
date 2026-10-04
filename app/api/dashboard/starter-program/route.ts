import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase';

const reply = (body: object, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply({ error: 'Please sign in again.' }, 401);
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data: { user }, error } = await auth.auth.getUser(token);
    if (error || !user) return reply({ error: 'Please sign in again.' }, 401);
    const body = await req.json().catch(() => null);
    if (!body || !['beginner', 'intermediate', 'advanced'].includes(body.level)) {
      return reply({ error: 'Choose a handstand level.' }, 400);
    }
    // Identity comes from auth; the database copies the saved template itself.
    // No submitted userId or steps can affect another member or the assigned plan.
    const { data: result, error: assignmentError } = await createAdminClient().rpc('assign_starter_program', {
      p_user_id: user.id, p_level: body.level,
    });
    if (assignmentError) {
      console.error('Starter program assignment failed:', assignmentError.code);
      return reply({ error: 'Unable to start your program. Please try again.' }, 500);
    }
    if (result === 'assigned') return reply({ success: true });
    if (result === 'existing_program') return reply({ error: 'Your program is already ready.', code: 'existing_program' }, 409);
    if (result === 'subscription_required') return reply({ error: 'An active membership is required to start a program.' }, 403);
    if (result === 'invalid_level') return reply({ error: 'Choose a handstand level.' }, 400);
    return reply({ error: 'This program is temporarily unavailable. Please contact Josh in chat.' }, 503);
  } catch {
    return reply({ error: 'Unable to start your program. Please try again.' }, 500);
  }
}
