import { z } from 'zod';

const documentInputSchema = z.object({
  documentName: z.string().min(1, 'Document name is required').max(100),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
});

export const VALID_INDIAN_STATE_CODES = [
  'AN', 'AP', 'AR', 'AS', 'BH', 'BR', 'CH', 'CG', 'CT', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML',
  'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TN', 'TR',
  'TS', 'UK', 'UA', 'UP', 'WB',
] as const;

const indianStateCodesSet = new Set<string>(VALID_INDIAN_STATE_CODES);
const regexWithSeries = /^([A-Z]{2})[\s\-]*([0-9]{1,2})[\s\-]*([A-Z]{1,3})[\s\-]*([0-9]{1,4})$/;
const regexWithoutSeries = /^([A-Z]{2})[\s\-]+([0-9]{1,2})[\s\-]+([0-9]{1,4})$/;

export function validateAndFormatVehicleNumber(input: string): { valid: boolean; formatted?: string; error?: string } {
  if (!input || typeof input !== 'string') {
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

export const vehicleItemInputSchema = z.object({
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']),
  vehicleNumber: z.string().min(1, 'Vehicle number is required').max(25).refine(
    (val) => validateAndFormatVehicleNumber(val).valid,
    (val) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()),
  status: z.enum(['Active', 'Expired', 'Renewed']).default('Active').optional(),
  notes: z.string().max(500).optional(),
  insurance: z.object({
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
  }).optional().or(z.null()),
  fc: z.object({
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
  }).optional().or(z.null()),
  tax: z.object({
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid start date' }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid end date' }),
  }).optional().or(z.null()),
  documents: z.array(documentInputSchema).optional(),
});

export function validatePhoneNumber(input: string): { valid: boolean; clean?: string; error?: string } {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Mobile number is required' };
  }
  let digits = input.trim().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) {
    return { valid: false, error: `Mobile number must be exactly 10 digits (${digits.length}/10 entered)` };
  }
  if (!/^[6-9]/.test(digits)) {
    return { valid: false, error: 'Indian mobile number must start with 6, 7, 8, or 9' };
  }
  return { valid: true, clean: digits };
}

export const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  secondName: z.string().max(100).optional().or(z.literal('')),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(1, 'Phone number is required').refine(
    (val) => validatePhoneNumber(val).valid,
    (val) => ({ message: validatePhoneNumber(val).error || 'Invalid 10-digit Indian mobile number' })
  ).transform((val) => validatePhoneNumber(val).clean || val.trim()),
  vehicleNumber: z.string().max(25).optional().or(z.literal('')).or(z.null()),
  remarks: z.string().max(500).optional(),
  documents: z.array(documentInputSchema).optional(),
  vehicles: z.array(vehicleItemInputSchema).optional(),
});

export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  secondName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(1).refine(
    (val) => validatePhoneNumber(val).valid,
    (val) => ({ message: validatePhoneNumber(val).error || 'Invalid 10-digit Indian mobile number' })
  ).transform((val) => validatePhoneNumber(val).clean || val.trim()).optional(),
  vehicleNumber: z.string().min(1).max(25).refine(
    (val) => validateAndFormatVehicleNumber(val).valid,
    (val) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()).optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type VehicleItemInput = z.infer<typeof vehicleItemInputSchema>;


