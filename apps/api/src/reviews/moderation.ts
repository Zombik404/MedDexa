/**
 * Automatic pre-moderation. Reviews that trip any rule are held as PENDING for a human
 * moderator instead of being published immediately. Rules are deliberately conservative.
 */
export interface ModerationVerdict {
  hold: boolean;
  reasons: string[];
}

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const REPEAT_RE = /(.)\1{6,}/;
/** Claims that present personal experience as medical advice. */
const MEDICAL_CLAIM_RE = /\b(cures?|guaranteed|instead of your (doctor|medication)|stop taking|replace(s|d)? (my|your) (prescription|medication))\b/i;
const ABUSE = ['idiot', 'scam', 'fraud', 'bastard', 'hülye', 'betrug', 'arnaque', 'estafa', 'oszustwo'];

export function moderateText(text: string): ModerationVerdict {
  const reasons: string[] = [];
  if (URL_RE.test(text)) reasons.push('contains_link');
  if (EMAIL_RE.test(text) || PHONE_RE.test(text)) reasons.push('personal_data');
  if (REPEAT_RE.test(text)) reasons.push('spam_pattern');
  if (MEDICAL_CLAIM_RE.test(text)) reasons.push('medical_claim');
  const lower = text.toLowerCase();
  if (ABUSE.some((w) => lower.includes(w))) reasons.push('abusive_language');
  const letters = text.replace(/[^A-Za-zÀ-ž]/g, '');
  if (letters.length > 20 && letters.replace(/[^A-ZÀ-Þ]/g, '').length / letters.length > 0.7) reasons.push('shouting');
  return { hold: reasons.length > 0, reasons };
}
