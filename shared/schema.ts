import { pgTable, text, serial, integer, date, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Borrower information table
export const borrowers = pgTable("borrowers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  documentType: text("document_type"),
  documentNumber: text("document_number"),
  guarantorName: text("guarantor_name"),
  guarantorPhone: text("guarantor_phone"),
  guarantorAddress: text("guarantor_address"),
  notes: text("notes"),
});

// Keep enums for backward compatibility but they're not used in current system

// Loan strategy enum
export enum LoanStrategy {
  EMI = "emi",
  FLAT = "flat",
  CUSTOM = "custom",
  GOLD_SILVER = "gold_silver",
}

// Loan information table
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  borrowerId: integer("borrower_id").notNull().references(() => borrowers.id),
  amount: real("amount").notNull(),
  startDate: date("start_date").notNull(),
  
  // Loan strategy
  loanStrategy: text("loan_strategy").default(LoanStrategy.EMI).notNull(),
  
  // Fields for EMI strategy
  tenure: integer("tenure"), // In months, optional now
  customEmiAmount: real("custom_emi_amount"),
  
  // Fields for FLAT strategy
  flatMonthlyAmount: real("flat_monthly_amount"),
  
  // Fields for CUSTOM strategy
  customDueDate: text("custom_due_date"),
  customPaymentAmount: real("custom_payment_amount"),
  
  // Fields for GOLD_SILVER strategy
  pmType: text("pm_type"), // "gold" or "silver"
  metalWeight: real("metal_weight"), // in grams
  purity: real("purity"), // percentage (e.g., 75 for 75%)
  netWeight: real("net_weight"), // calculated field
  amountPaid: real("amount_paid"),
  goldSilverDueDate: text("gold_silver_due_date"),
  goldSilverPaymentAmount: real("gold_silver_payment_amount"),
  goldSilverNotes: text("gold_silver_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment status enum
export enum PaymentStatus {
  UPCOMING = "upcoming",
  DUE_SOON = "due_soon",
  OVERDUE = "overdue",
  COLLECTED = "collected",
}

// Payment schedule and history
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").notNull().references(() => loans.id),
  dueDate: date("due_date").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default(PaymentStatus.UPCOMING),
  paidDate: date("paid_date"),
  paidAmount: real("paid_amount"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
});

// Schema for inserting borrower
export const insertBorrowerSchema = createInsertSchema(borrowers).omit({ id: true }).extend({
  id: z.number().optional(), // Allow optional ID to be provided
  notes: z.string().nullable().optional(), // Allow optional notes that can be null
});

// Schema for updating borrower (excludes ID and document number to keep them protected)
export const updateBorrowerSchema = createInsertSchema(borrowers).omit({ id: true, documentNumber: true }).partial();

// Schema for inserting loan
export const insertLoanSchema = createInsertSchema(loans).omit({ id: true, createdAt: true })
  .extend({
    // Make the formerly required fields optional based on loan strategy
    loanStrategy: z.enum([LoanStrategy.EMI, LoanStrategy.FLAT, LoanStrategy.CUSTOM, LoanStrategy.GOLD_SILVER]).default(LoanStrategy.EMI),
    tenure: z.number().optional(),
    customEmiAmount: z.number().optional(),
    flatMonthlyAmount: z.number().optional(),
  });

// Schema for inserting payment
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });

// Schema for updating payment
export const updatePaymentSchema = z.object({
  status: z.string(),
  paidDate: z.string().or(z.date()).optional(), // Accept either string or Date objects
  paidAmount: z.number().or(z.string().transform(val => Number(val))).optional(), // Accept numbers or strings that can be converted to numbers
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

// Define relations between tables
export const borrowersRelations = relations(borrowers, ({ many }) => ({
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  borrower: one(borrowers, {
    fields: [loans.borrowerId],
    references: [borrowers.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, {
    fields: [payments.loanId],
    references: [loans.id],
  }),
}));

// Export types
export type Borrower = typeof borrowers.$inferSelect;
export type InsertBorrower = z.infer<typeof insertBorrowerSchema>;

export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;
