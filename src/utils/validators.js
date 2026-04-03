'use strict';

const { z } = require('zod');

// ── Auth ──────────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128),
  role: z.enum(['viewer', 'analyst', 'admin']).optional(), // only admins can set this
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── Users ─────────────────────────────────────────────────────────────────────
const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['viewer', 'analyst', 'admin']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided to update' }
);

// ── Records ───────────────────────────────────────────────────────────────────
const createRecordSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than zero'),
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: "Type must be 'income' or 'expense'" }),
  }),
  category: z.string().min(1, 'Category is required').max(100),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(500).optional(),
});

const updateRecordSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero').optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().min(1).max(100).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided to update' }
);

const recordFilterSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  search: z.string().optional(),
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
const trendQuerySchema = z.object({
  year: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : new Date().getFullYear()))
    .pipe(z.number().int().min(2000).max(2100)),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateUserSchema,
  createRecordSchema,
  updateRecordSchema,
  recordFilterSchema,
  trendQuerySchema,
};
