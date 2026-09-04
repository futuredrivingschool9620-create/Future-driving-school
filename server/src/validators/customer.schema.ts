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

export const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  secondName: z.string().max(100).optional().or(z.literal('')),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(5, 'Phone number is required').max(20),
  vehicleNumber: z.string().min(1, 'Vehicle number is required').max(20),
  remarks: z.string().max(500).optional(),
  documents: z.array(documentInputSchema).optional(),
});

export const updateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  secondName: z.string().max(100).optional().or(z.literal('')).or(z.null()),
  vehicleType: z.enum(['2 Wheeler', '4 Wheeler', 'Truck']).optional().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().min(5).max(20).optional(),
  vehicleNumber: z.string().min(1).max(20).optional(),
  remarks: z.string().max(500).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
