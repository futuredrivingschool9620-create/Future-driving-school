export const VALID_INDIAN_STATE_CODES = [
  'AN', 'AP', 'AR', 'AS', 'BH', 'BR', 'CH', 'CG', 'CT', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML',
  'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TN', 'TR',
  'TS', 'UK', 'UA', 'UP', 'WB',
] as const;

export const indianStateCodesSet = new Set<string>(VALID_INDIAN_STATE_CODES);

const regexWithSeries = /^([A-Z]{2})[\s\-]*([0-9]{1,2})[\s\-]*([A-Z]{1,3})[\s\-]*([0-9]{1,4})$/;
const regexWithoutSeries = /^([A-Z]{2})[\s\-]+([0-9]{1,2})[\s\-]+([0-9]{1,4})$/;

export function validateAndFormatVehicleNumber(input: string): { valid: boolean; formatted?: string; error?: string } {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Vehicle number is required' };
  }
  const cleaned = input.trim().toUpperCase();
  let match = cleaned.match(regexWithSeries);
  if (match) {
    const [, state, rto, series, num] = match;
    if (!indianStateCodesSet.has(state)) {
      return { valid: false, error: `Invalid Indian State/UT code: ${state}. Must be a valid Indian registration code (e.g. KA, MH, TN, DL, etc.)` };
    }
    return { valid: true, formatted: `${state} ${rto.padStart(2, '0')} ${series} ${num}` };
  }
  match = cleaned.match(regexWithoutSeries);
  if (match) {
    const [, state, rto, num] = match;
    if (!indianStateCodesSet.has(state)) {
      return { valid: false, error: `Invalid Indian State/UT code: ${state}. Must be a valid Indian registration code (e.g. KA, MH, TN, DL, etc.)` };
    }
    return { valid: true, formatted: `${state} ${rto.padStart(2, '0')} ${num}` };
  }
  return { valid: false, error: 'Invalid Indian vehicle registration number format (e.g. KA 01 AB 1234 or TN 38 BC 5678)' };
}
