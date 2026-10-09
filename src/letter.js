import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import template from '../assets/AI WorkHub Admission Letter.html';
import logo from '../assets/logo-horizontal.svg';
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const formatDate=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Nairobi'});
export function admissionHtml(app,details,logoData) {
  const replacements={
    'AIWH/ADM/2026/[000]':app.admission_no,
    '[Date]':new Date(app.admitted_at).toLocaleDateString('en-KE',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Nairobi'}),
    '[Full Name]':app.full_name,'[Address / Email]':app.email,'[First Name]':app.full_name.split(/\s+/)[0],
    '[Programme Name]':'AI Essentials & Automation','[Month, Year]':details.intake,
    '[Start Date]':formatDate(details.start),'[Online / In-person]':details.mode,'[Duration]':'1 week','[ID Number]':app.admission_no,
    '[Deadline]':formatDate(details.deadline),'[Amount]':'KSh 10,000','[Date &amp; Time]':details.orientation,
    '[Signature]':'AI WorkHub','[Name]':details.signer,'[Title]':details.role
  };
  let html=template.replace(/<link[^>]+fonts\.googleapis[^>]*>/g,'');
  for(const [key,value] of Object.entries(replacements)) html=html.split(key).join(escapeHtml(value));
  html=html.replace(/<header><svg[\s\S]*?<\/svg>/,'<header><img alt="AI WorkHub" width="260" height="49" src="'+logoData+'">');
  html=html.replace('<div><div class="brand">AI WorkHub</div><div class="tag">AI Essentials and Automation</div></div>','');
  html=html.replace('</head>',`<style>
  :root{--sans:Arial,Helvetica,sans-serif;--serif:Georgia,'Times New Roman',serif}
  html{padding:0}body{padding:0;background:#fff;width:794px}
  .page{width:794px;max-width:none;min-height:1123px;padding:40px 48px 28px;box-shadow:none;background:#fffdf9}
  header{padding-bottom:18px}header img{width:260px;height:auto}
  .meta{margin:22px 0 8px;font-size:11px}.to{font-size:14px;margin-bottom:14px;overflow-wrap:anywhere}
  h1{margin-top:22px;font-size:20px}.rule{margin-bottom:18px}p{font-size:14px;line-height:1.6;margin-bottom:12px}
  .card{margin:18px 0}.card div{padding:9px 13px}.card span{font-size:13px;overflow-wrap:anywhere}
  h2{margin-top:18px}li{font-size:13px;line-height:1.6}.sign{margin-top:20px}.sign .sig{font-size:23px}
  footer{margin-top:24px;font-size:10px}.cta{margin:0 0 12px}
  @page{size:A4;margin:0}@media print{body{width:210mm}.page{width:210mm;min-height:297mm;break-inside:avoid}}
  </style></head>`);
  return html;
}
export async function createAdmissionPdf(app,details) {
  if(!app.admission_no || app.status!=='approved') throw new Error('Approve admission first.');
  const image=new Image();
  image.src='data:image/svg+xml;base64,'+btoa(logo.replace('<svg ','<svg width="610" height="115" '));
  await image.decode();
  const mark=document.createElement('canvas');mark.width=1220;mark.height=230;mark.getContext('2d').drawImage(image,0,0,1220,230);
  const logoData=mark.toDataURL('image/png');
  const frame=document.createElement('iframe');
  frame.title='Admission letter renderer';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  frame.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;';
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Letter rendering timed out.')),15000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.srcdoc=admissionHtml(app,details,logoData);document.body.append(frame);});
    const doc=frame.contentDocument;
    await Promise.all([...doc.images].map(img=>img.decode()));
    await doc.fonts.ready;
    const canvas=await html2canvas(doc.querySelector('.page'),{scale:2,backgroundColor:'#fffdf9',logging:false,windowWidth:794,windowHeight:1200});
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const scale=Math.min(210/canvas.width,297/canvas.height);
    const width=canvas.width*scale,height=canvas.height*scale;
    pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',(210-width)/2,0,width,height);
    pdf.setProperties({title:`Admission — ${app.admission_no}`,author:'AI WorkHub',subject:'AI Essentials & Automation admission'});
    return pdf.output('blob');
  }finally{frame.remove();}
}
