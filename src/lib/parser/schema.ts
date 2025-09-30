import { z } from 'zod';

export const BankAccount = z.object({
  bank: z.string().optional(),
  iban: z.string().optional(),
  bic_swift: z.string().optional(),
});

export const Party = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  vat_id: z.string().optional(),
  tax_id: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  bank_accounts: z.array(BankAccount).optional(),
});

export const LineItem = z.object({
  position: z.number().int().optional(),
  sku: z.string().optional(),
  uvz_number: z.string().optional(),
  kv_number: z.string().optional(),
  description: z.string(),
  quantity: z.number().default(1),
  unit: z.string().optional(),
  unit_price: z.number().optional(),
  net_amount: z.number(),
  tax_rate: z.number().optional().default(19),
  tax_amount: z.number().optional(),
  gross_amount: z.number().optional(),
});

export const Invoice = z.object({
  filename: z.string(),
  invoice_id: z.string().optional(),
  invoice_number: z.string().optional(),
  secondary_reference: z.string().optional(),
  issue_date: z.string().optional(), // ISO
  due_date: z.string().optional(), // ISO
  currency: z.string().default('EUR'),
  payment_terms: z.string().optional(),
  supplier: Party.optional(),
  customer: Party.optional(),
  line_items: z.array(LineItem).default([]),
  section_totals: z
    .array(
      z.object({
        uvz_number: z.string().optional(),
        title: z.string().optional(),
        net: z.number(),
        taxable_base: z.number().optional(),
        vat_rate: z.number().optional(),
        vat: z.number().optional(),
        gross: z.number().optional(),
      })
    )
    .optional(),
  totals: z
    .object({
      subtotal: z.number().optional(),
      net: z.number().optional(),
      taxable_base: z.number().optional(),
      vat_rate: z.number().optional(),
      vat: z.number().optional(),
      total: z.number().optional(),
      gross: z.number().optional(),
      amount_paid: z.number().optional(),
      amount_due: z.number().optional(),
      verauslagte_kosten_ust_frei: z.number().optional(),
      rounding_adjustment: z.number().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  detected_language: z.string().optional(),
  tax_mode: z.enum(['prices_include_tax', 'prices_exclude_tax']).optional(),
  flags: z.array(z.string()).optional(),
});

export type InvoiceT = z.infer<typeof Invoice>;
export type PartyT = z.infer<typeof Party>;
export type LineItemT = z.infer<typeof LineItem>;
export type BankAccountT = z.infer<typeof BankAccount>;
