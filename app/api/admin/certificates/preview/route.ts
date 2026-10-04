import { NextRequest } from 'next/server';
import { certificateAuth, certReply } from '@/lib/certificateAuth';
import { certificateText } from '@/lib/certificates';
import { createCertificatePdf } from '@/lib/certificatePdf';
export const runtime='nodejs';
export async function POST(req:NextRequest) {
  try {
    const user=await certificateAuth(req);
    if(!user) return certReply({error:'Please sign in again.'},401);
    if(!user.isAdmin) return certReply({error:'Not authorized.'},403);
    const body=await req.json().catch(()=>null);
    const name=certificateText(body?.name,80),skill=certificateText(body?.skill,100);
    if(!name || !skill) return certReply({error:'Enter a name and skill to preview.'},400);
    const now=new Date();
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    const bytes=await createCertificatePdf({id:'00000000-0000-4000-8000-000000000000',recipient_name:name,skill,award_date:date,awarded_at:now.toISOString()});
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store'}});
  } catch(e) {return certReply({error:e instanceof Error && e.message.startsWith('Please use')?e.message:'Could not prepare preview.'},400);}
}
