export function validateApplication({ fullName, phone, paymentPlan }) {
  const name = String(fullName || '').trim();
  const number = String(phone || '').trim();
  const digits = number.replace(/\D/g, '');
  if (!name || name.length > 120) return 'Enter your full name (up to 120 characters).';
  if (!/^\+?[\d\s().-]+$/.test(number) || number.length > 30 || digits.length < 7 || digits.length > 15) return 'Enter a valid phone number with 7–15 digits.';
  if (!['full', 'instalments'].includes(paymentPlan)) return 'Choose a payment option.';
  return '';
}
export function isConfigured(config) {
  try {
    const url = new URL(config?.supabaseUrl);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') &&
      (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash &&
      typeof config.supabasePublishableKey === 'string' && config.supabasePublishableKey.startsWith('sb_publishable_');
  } catch { return false; }
}
export function balanceFromPayments(payments) {
  return Math.max(0, 10000 - payments.reduce((sum, item) => sum + Number(item.amount_kes), 0));
}

export function paymentTotals(payments) {
  const paid=payments.reduce((sum,row)=>sum+Number(row.amount_kes),0);
  return {paid,remaining:Math.max(0,10000-paid)};
}
export function validateUpload(file,notes='') {
  if(!file) return 'Choose a file first.';
  if(!file.size || file.size>10*1024*1024) return 'Choose a non-empty file of at most 10 MB.';
  if(file.name.length>250 || !/\.(pdf|zip|docx?|txt|png|jpe?g)$/i.test(file.name)) return 'Use a PDF, ZIP, Word, text, PNG or JPEG file.';
  if(notes.length>4000) return 'Keep notes under 4,000 characters.';
  return '';
}
