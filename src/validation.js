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
