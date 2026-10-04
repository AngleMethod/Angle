import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { certificateAuth, certReply } from '@/lib/certificateAuth';
import { uuid } from '@/lib/certificates';
import { createCertificatePdf } from '@/lib/certificatePdf';
export const runtime='nodejs';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const user=await certificateAuth(req);
    if(!user) return certReply({error:'Please sign in again.'},401);
    const {id}=await params;
    if(!uuid.test(id)) return certReply({error:'Invalid certificate.'},400);
    let query=createAdminClient().from('mastery_certificates').select('*').eq('id',id);
    if(!user.isAdmin) query=query.eq('user_id',user.id);
    const {data,error}=await query.maybeSingle();
    if(error) throw error;
    if(!data) return certReply({error:'Certificate not found.'},404);
    const bytes=await createCertificatePdf(data);
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Angle-${id.slice(0,8)}-certificate.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  } catch {return certReply({error:'Could not prepare the PDF. Please try again.'},503);}
}
