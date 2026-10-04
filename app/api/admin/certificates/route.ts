import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { certificateAuth, certReply } from '@/lib/certificateAuth';
import { certificateColumns, certificateText, uuid } from '@/lib/certificates';
import { createCertificatePdf } from '@/lib/certificatePdf';
import { sendCertificateEmail } from '@/lib/certificateEmail';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:NextRequest) {
  try {
    const admin=await certificateAuth(req);
    if(!admin) return certReply({error:'Please sign in again.'},401);
    if(!admin.isAdmin) return certReply({error:'Only coaches can award certificates.'},403);
    const body=await req.json().catch(()=>null);
    const name=certificateText(body?.name,80),skill=certificateText(body?.skill,100);
    if(!name || !skill || !uuid.test(body?.id||'') || !uuid.test(body?.userId||'')) return certReply({error:'Enter a name and handstand skill.'},400);
    const db=createAdminClient();
    const {data:existing,error:lookupError}=await db.from('mastery_certificates').select('*').eq('id',body.id).maybeSingle();
    if(lookupError) throw lookupError;
    if(existing && (existing.user_id!==body.userId || existing.recipient_name!==name || existing.skill!==skill)) return certReply({error:'This award request has already been used. Refresh and try again.'},409);
    if(!existing) {
      const {data:member,error}=await db.auth.admin.getUserById(body.userId);
      if(error || !member.user?.email) return certReply({error:'Member not found.'},404);
      // Validate PDF/font support before issuing anything. The actual issue date comes from the database.
      try {await createCertificatePdf({id:body.id,recipient_name:name,skill,award_date:'2026-01-01',awarded_at:'2026-01-01T12:00:00Z'});}
      catch(e) {return certReply({error:e instanceof Error && e.message.startsWith('Please use')?e.message:'Certificate preview unavailable. Please try again.'},400);}
      const {error:insertError}=await db.from('mastery_certificates').insert({id:body.id,user_id:body.userId,recipient_name:name,recipient_email:member.user.email,skill,awarded_by:admin.id});
      if(insertError && insertError.code!=='23505') throw insertError;
      if(insertError) {
        const {data:retry}=await db.from('mastery_certificates').select('id,user_id,recipient_name,skill').eq('id',body.id).maybeSingle();
        if(!retry || retry.user_id!==body.userId || retry.recipient_name!==name || retry.skill!==skill) return certReply({error:'This member already has a certificate for this skill.'},409);
      }
    }
    await sendCertificateEmail(body.id);
    const {data,error}=await db.from('mastery_certificates').select(certificateColumns).eq('id',body.id).single();
    if(error) throw error;
    return certReply({certificate:data});
  } catch {return certReply({error:'Could not confirm the award. Please retry the same request.'},503);}
}
export async function PATCH(req:NextRequest) {
  try {
    const admin=await certificateAuth(req);
    if(!admin) return certReply({error:'Please sign in again.'},401);
    if(!admin.isAdmin) return certReply({error:'Only coaches can send certificates.'},403);
    const body=await req.json().catch(()=>null);
    if(!uuid.test(body?.id||'')) return certReply({error:'Invalid certificate.'},400);
    await sendCertificateEmail(body.id);
    const {data,error}=await createAdminClient().from('mastery_certificates').select(certificateColumns).eq('id',body.id).single();
    if(error) throw error;
    return certReply({certificate:data});
  } catch {return certReply({error:'Could not retry the email. Please try again.'},503);}
}
