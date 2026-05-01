import { z } from 'zod';

export const marketSchema = z.object({
  name:         z.string().min(2, 'نام حداقل ۲ کاراکتر'),
  symbol:       z.string().min(1).max(10),
  unitWeight:   z.number().positive(),
  unitLabel:    z.string().min(1),
  lafzMin:      z.number().int().min(1),
  lafzMax:      z.number().int().max(9999),
  lafzScale:    z.number().int().positive(),
  mazneCurrent: z.number().int().positive('مزنه باید مثبت باشد'),
  active:       z.boolean(),
});

export const userSchema = z.object({
  fullName:        z.string().min(2, 'نام کامل الزامی است'),
  phone:           z.string().regex(/^09\d{9}$/, 'فرمت موبایل نادرست است'),
  telegramId:      z.string().optional(),
  role:            z.enum(['admin', 'accountant', 'trader']),
  depositTether:   z.number().min(0).optional(),
  perUnitDeposit:  z.number().min(0).optional(),
  commissionPerUnit: z.number().int().min(0).optional(),
  active:          z.boolean(),
});

export const orderSchema = z.object({
  marketId:       z.string().min(1, 'بازار الزامی است'),
  side:           z.enum(['buy', 'sell']),
  lafz:           z.number().int().min(1).max(9999),
  quantity:       z.number().int().min(1),
  settlementDate: z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/, 'تاریخ نادرست'),
});

export const finalSettlementSchema = z.object({
  rateToman:  z.number().int().positive('نرخ تصفیه باید مثبت باشد'),
  rateTether: z.number().int().positive('نرخ تتر باید مثبت باشد'),
});

export const reversalSchema = z.object({
  reason: z.string().min(5, 'دلیل برگشت حداقل ۵ کاراکتر'),
});

export type MarketFormData       = z.infer<typeof marketSchema>;
export type UserFormData         = z.infer<typeof userSchema>;
export type OrderFormData        = z.infer<typeof orderSchema>;
export type FinalSettlementData  = z.infer<typeof finalSettlementSchema>;
export type ReversalData         = z.infer<typeof reversalSchema>;
