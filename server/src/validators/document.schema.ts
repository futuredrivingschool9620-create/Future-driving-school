import { z } from 'zod';

export const createDocumentSchema = z.object({
  documentName: z.string().min(1, 'Document name is required').max(100),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
  notes: z.string().max(500).optional().or(z.literal('')),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const renewDocumentSchema = z.object({
  newStartDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  newEndDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),
  notes: z.string().max(500).optional().or(z.literal('')),
  renewalType: z.enum(['NORMAL', 'PRE_RENEWAL']).optional(),
}).refine((data) => {
  const start = new Date(data.newStartDate);
  const end = new Date(data.newEndDate);
  return end > start;
}, {
  message: 'New end date must be after new start date',
  path: ['newEndDate'],
});

export const updateDocumentSchema = z.object({
  documentName: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type RenewDocumentInput = z.infer<typeof renewDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
