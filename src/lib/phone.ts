// Normalizes Egyptian phone numbers to the canonical local format: 01012345678
// Accepts input with +20, 0020, spaces, or dashes and strips them down.
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d]/g, "");

  if (digits.startsWith("0020")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("20") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  }

  // Egyptian mobile numbers: 01[0125]XXXXXXXX — 11 digits total
  if (/^01[0125]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}
