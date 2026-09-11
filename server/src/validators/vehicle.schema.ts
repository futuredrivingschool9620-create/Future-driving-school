import { z } from 'zod';
import { validateAndFormatVehicleNumber } from './customer.schema.js';

export const vehicleDocumentItemSchema = z.object({
  documentName: z.string().min(1, 'Document name is required').max(100),
  startDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
  notes: z.string().max(500).optional(),
});

export const dateRangeSchema = z.object({
  startDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
}).optional().or(z.null());

export const createVehicleSchema = z.object({
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']),
  vehicleNumber: z.string().min(1, 'Vehicle number is required').max(25).refine(
    (val: string) => validateAndFormatVehicleNumber(val).valid,
    (val: string) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val: string) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()),
  status: z.enum(['Active', 'Expired', 'Renewed']).default('Active').optional(),
  notes: z.string().max(500).optional(),
  insurance: dateRangeSchema,
  fc: dateRangeSchema,
  tax: dateRangeSchema,
  documents: z.array(vehicleDocumentItemSchema).optional(),
});

export const updateVehicleSchema = z.object({
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional(),
  vehicleNumber: z.string().min(1).max(25).refine(
    (val: string) => validateAndFormatVehicleNumber(val).valid,
    (val: string) => ({ message: validateAndFormatVehicleNumber(val).error || 'Invalid Indian vehicle number' })
  ).transform((val: string) => validateAndFormatVehicleNumber(val).formatted || val.toUpperCase()).optional(),
  status: z.enum(['Active', 'Expired', 'Renewed']).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const updateVehicleStatusSchema = z.object({
  status: z.enum(['Active', 'Expired', 'Renewed']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;

