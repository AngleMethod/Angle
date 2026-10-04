import { Resend } from 'resend';
import { createAdminClient } from './supabase';
import { createCertificatePdf, type CertificateDocument } from './certificatePdf';
import { renderAngleEmail } from './email';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function certificateEmailContent(cert:CertificateDocument) {
  return {
    subject:`Mastery unlocked: ${cert.skill} - Angle`,
    html:renderAngleEmail({eyebrow:'A milestone worth celebrating',title:'You earned this.',accent:cert.skill,
      descriptionHtml:`${escape(cert.recipient_name)}, your practice just became a milestone. Josh has awarded you a Certificate of Handstand Mastery.`,
      bodyHtml:'Your personal certificate is attached as a printable PDF. Find it in your dashboard collection whenever you want to celebrate how far you have come.',
      actionLabel:'Open my certificate collection',actionUrl:'https://angle.coach/dashboard#certificates',footer:'Keep showing up. Keep discovering what you are capable of. — Josh Lee'}),
    text:`${cert.recipient_name}, you earned this!\n\nJosh awarded you a Certificate of Handstand Mastery for ${cert.skill}. Your printable PDF is attached.\n\nYour collection: https://angle.coach/dashboard#certificates\n\nJosh Lee | Angle`,
  };
}
// A database lease prevents concurrent retries. Resend's stable key protects an interrupted send.
export async function sendCertificateEmail(id:string) {
  const db=createAdminClient();
  const {data,error}=await db.rpc('claim_certificate_email',{certificate_id:id});
  if(error || !data?.length) return;
  const cert=data[0] as CertificateDocument & {recipient_email:string};
  try {
    if(!process.env.RESEND_API_KEY) throw new Error('Email not configured');
    const pdf=await createCertificatePdf(cert);
    const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
      from:'Angle <hello@angle.coach>',replyTo:'josh@angle.coach',to:cert.recipient_email,
      ...certificateEmailContent(cert),attachments:[{filename:`Angle-${id.slice(0,8)}-certificate.pdf`,content:pdf,contentType:'application/pdf'}],
    },{idempotencyKey:`certificate-${id}-v1`});
    if(result.error || !result.data?.id) throw new Error('Email provider did not accept the certificate');
    // A failed status write leaves the lease intact; the next retry uses the same idempotency key.
    await db.from('mastery_certificates').update({email_status:'sent',email_sent_at:new Date().toISOString(),email_provider_id:result.data.id}).eq('id',id);
  } catch {
    await db.from('mastery_certificates').update({email_status:'failed'}).eq('id',id).eq('email_status','sending');
  }
}
