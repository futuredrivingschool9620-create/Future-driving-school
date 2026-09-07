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

export const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  secondName: z.string().max(100).optional().or(z.literal('')),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(5, 'Phone number is required').max(20),
  vehicleNumber: z.string().min(1, 'Vehicle number is required').max(25).refine(
    (val) => validateAndFormatVehicleNumber(val).valid,
    (val) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()),
  remarks: z.string().max(500).optional(),
  documents: z.array(documentInputSchema).optional(),
});

export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  secondName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(5).max(20).optional(),
  vehicleNumber: z.string().min(1).max(25).refine(
    (val) => validateAndFormatVehicleNumber(val).valid,
    (val) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()).optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

