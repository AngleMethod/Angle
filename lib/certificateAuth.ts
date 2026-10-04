import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export function certReply(body:unknown,status=200) {return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});}
const admins=['josh@angle.coach','morgan@anglemethod.com','ninagrishchenko2003@gmail.com'];
export async function certificateAuth(req:NextRequest) {
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token) return null;
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});
  const {data,error}=await db.auth.getUser(token);
  if(error || !data.user) return null;
  return {id:data.user.id,isAdmin:admins.includes(data.user.email?.toLowerCase()||'')};
}
