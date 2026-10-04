import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { certificateAuth, certReply } from '@/lib/certificateAuth';
import { certificateColumns, uuid } from '@/lib/certificates';
export async function GET(req:NextRequest) {
  try {
    const user=await certificateAuth(req);
    if(!user) return certReply({error:'Please sign in again.'},401);
    const target=req.nextUrl.searchParams.get('userId')||user.id;
    if(!uuid.test(target)) return certReply({error:'Invalid member.'},400);
    if(target!==user.id && !user.isAdmin) return certReply({error:'Not authorized.'},403);
    const {data,error}=await createAdminClient().from('mastery_certificates').select(certificateColumns).eq('user_id',target).order('awarded_at',{ascending:false}).limit(500);
    if(error) throw error;
    return certReply({certificates:data});
  } catch {return certReply({error:'Could not load certificates. Please try again.'},503);}
}
export async function PATCH(req:NextRequest) {
  try {
    const user=await certificateAuth(req);
    if(!user) return certReply({error:'Please sign in again.'},401);
    const body=await req.json().catch(()=>null);
    if(!uuid.test(body?.id||'')) return certReply({error:'Invalid certificate.'},400);
    const {error}=await createAdminClient().from('mastery_certificates').update({seen_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',user.id).is('seen_at',null);
    if(error) throw error;
    return certReply({ok:true});
  } catch {return certReply({error:'Could not update certificate.'},503);}
}
