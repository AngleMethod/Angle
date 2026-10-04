import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { certificateDate, certificateNumber, certificateSkillLines } from './certificates';
export type CertificateDocument = {id:string;recipient_name:string;skill:string;award_date:string;awarded_at:string};
let assets: Promise<Buffer[]> | undefined;
function readAssets() {
  return assets ??= Promise.all(['master.pdf','serif.woff'].map(file=>readFile(path.join(process.cwd(),'public/certificates/v1',file)))).catch(e=>{assets=undefined;throw e;});
}
export async function createCertificatePdf(cert:CertificateDocument) {
  const [master,fontBytes]=await readAssets();
  const pdf=await PDFDocument.load(master);
  pdf.registerFontkit(fontkit);
  const serif=await pdf.embedFont(fontBytes,{subset:true});
  const supported=new Set(serif.getCharacterSet());
  for(const char of cert.recipient_name+cert.skill) {
    if(!supported.has(char.codePointAt(0)!)) throw new Error('Please use Latin letters, accents, numbers, and punctuation for the certificate name and skill.');
  }
  const sans=await pdf.embedFont(StandardFonts.Helvetica);
  const page=pdf.getPages()[0];
  const ink=rgb(240/255,238/255,232/255);
  const fit=(text:string,base:number,width:number)=>Math.min(base,base*width/serif.widthOfTextAtSize(text,base));
  const center=(text:string,y:number,size:number)=>page.drawText(text,{x:(792-serif.widthOfTextAtSize(text,size))/2,y,size,font:serif,color:ink});
  center(cert.recipient_name,350,fit(cert.recipient_name,40,650));
  const lines=certificateSkillLines(cert.skill);
  const size=Math.min(33,...lines.map(line=>fit(line,33,630)));
  lines.forEach((line,i)=>center(line,lines.length===1?260:280-i*40,size));
  const date=certificateDate(cert.award_date);
  page.drawText(date,{x:516,y:120,size:fit(date,14,199),font:serif,color:ink});
  page.drawText(`CERTIFICATE NO. ${certificateNumber(cert.id)}`,{x:535,y:39,size:6,font:sans,color:rgb(.67,.68,.65)});
  pdf.setTitle(`${cert.recipient_name} | ${cert.skill} | Angle`);
  pdf.setAuthor('Angle - Josh Lee');
  pdf.setCreationDate(new Date(cert.awarded_at));pdf.setModificationDate(new Date(cert.awarded_at));
  return Buffer.from(await pdf.save());
}
