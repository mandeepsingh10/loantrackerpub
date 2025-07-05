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
  photoUrl: text("photo_url"), // URL to stored photo
});

// Keep enums for backward compatibility but they're not used in current system

// Loan strategy enum
export enum LoanStrategy {
  EMI = "emi",
  FLAT = "flat",
  CUSTOM = "custom",
  GOLD_SILVER = "gold_silver",
}

// Loan status enum
export enum LoanStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  DEFAULTED = "defaulted",
  CANCELLED = "cancelled",
}

// Loan information table
export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  borrowerId: integer("borrower_id").notNull().references(() => borrowers.id),
  amount: real("amount").notNull(),
  startDate: date("start_date").notNull(),
  
  // Guarantor information (per loan)
  guarantorName: text("guarantor_name"),
  guarantorPhone: text("guarantor_phone"),
  guarantorAddress: text("guarantor_address"),
  
  // Loan strategy
  loanStrategy: text("loan_strategy").default(LoanStrategy.EMI).notNull(),
  
  // Fields for EMI strategy
  tenure: integer("tenure"), // In months, optional now
  customEmiAmount: real("custom_emi_amount"),
  
  // Fields for FLAT strategy
  flatMonthlyAmount: real("flat_monthly_amount"),
  
  // Fields for GOLD_SILVER strategy
  pmType: text("pm_type"), // "gold" or "silver"
  metalWeight: real("metal_weight"), // in grams
  purity: real("purity"), // percentage (e.g., 75 for 75%)
  netWeight: real("net_weight"), // calculated field
  amountPaid: real("amount_paid"),
  goldSilverNotes: text("gold_silver_notes"),
  
  // General loan notes
  notes: text("notes"),
  
  // Loan status
  status: text("status").default(LoanStatus.ACTIVE).notNull(),
  
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
  dueAmount: real("due_amount").default(0), // Track outstanding balance after partial payments
  paymentMethod: text("payment_method"),
  notes: text("notes"),
});

// User roles enum
export enum UserRole {
  ADMIN = "admin",
  VIEWER = "viewer",
  MANAGER = "manager"
}

// User management table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default(UserRole.VIEWER),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
    status: z.enum([LoanStatus.ACTIVE, LoanStatus.COMPLETED, LoanStatus.DEFAULTED, LoanStatus.CANCELLED]).default(LoanStatus.ACTIVE),
  });

// Schema for inserting payment
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true });

// Schema for updating payment
export const updatePaymentSchema = z.object({
  status: z.string(),
  paidDate: z.string().or(z.date()).optional(), // Accept either string or Date objects
  paidAmount: z.number().or(z.string().transform(val => Number(val))).optional(), // Accept numbers or strings that can be converted to numbers
  dueAmount: z.number().optional(), // Track outstanding balance
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

// User schemas
export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([UserRole.ADMIN, UserRole.VIEWER, UserRole.MANAGER]).default(UserRole.VIEWER),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
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
export type LoanStatus = typeof LoanStatus[keyof typeof LoanStatus];

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;

// User types
export type User = typeof users.$inferSelect;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
