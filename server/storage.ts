import { borrowers, type Borrower, type InsertBorrower, 
         loans, type Loan, type InsertLoan,
         payments, type Payment, type InsertPayment, type UpdatePayment,
         users, type User, type CreateUser, type UpdateUser,
         PaymentStatus, UserRole } from "@shared/schema";
import { db } from "./db";
import { eq, and, lt, gte, desc, isNull, sql } from "drizzle-orm";
import { subMonths } from "date-fns";

export interface IStorage {
  // Borrower operations
  getBorrowers(): Promise<Borrower[]>;
  getBorrowerById(id: number): Promise<Borrower | undefined>;
  createBorrower(borrower: InsertBorrower): Promise<Borrower>;
  updateBorrower(id: number, borrower: Partial<InsertBorrower>): Promise<Borrower | undefined>;
  deleteBorrower(id: number): Promise<boolean>;
  searchBorrowers(query: string): Promise<Borrower[]>;

  // Loan operations
  getLoans(): Promise<Loan[]>;
  getLoansByBorrowerId(borrowerId: number): Promise<Loan[]>;
  getLoanById(id: number): Promise<Loan | undefined>;
  createLoan(loan: InsertLoan): Promise<Loan>;
  updateLoan(id: number, loan: Partial<InsertLoan>): Promise<Loan | undefined>;
  updateLoanStatus(id: number, status: string): Promise<Loan | undefined>;
  deleteLoan(id: number): Promise<boolean>;

  // Payment operations
  getPayments(): Promise<Payment[]>;
  getPaymentsByLoanId(loanId: number): Promise<Payment[]>;
  getPaymentById(id: number): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<UpdatePayment>): Promise<Payment | undefined>;
  markPaymentCollected(id: number, data: UpdatePayment): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;
  getUpcomingPayments(): Promise<Payment[]>;
  getNextPaymentForLoan(loanId: number): Promise<Payment | undefined>;

  // Dashboard operations
  getDashboardStats(): Promise<{
    totalLoans: number;
    activeLoans: number;
    overduePayments: number;
    totalAmount: number;
  }>;
  getRecentLoans(limit?: number): Promise<(Loan & { borrowerName: string; status: string; nextPayment: string; })[]>;

  // User management operations
  getUsers(): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: CreateUser): Promise<User>;
  updateUser(id: number, userData: Partial<UpdateUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  updateUserLastLogin(id: number): Promise<void>;
  setPasswordResetToken(username: string, token: string, expiresAt: Date): Promise<boolean>;
  resetPassword(token: string, newPasswordHash: string): Promise<boolean>;
  changePassword(userId: number, newPasswordHash: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Borrower operations
  async getBorrowers(): Promise<Borrower[]> {
    return await db.select().from(borrowers);
  }

  async getBorrowerById(id: number): Promise<Borrower | undefined> {
    const result = await db.select({
      id: borrowers.id,
      name: borrowers.name,
      phone: borrowers.phone,
      address: borrowers.address,
      documentType: borrowers.documentType,
      documentNumber: borrowers.documentNumber,
      guarantorName: borrowers.guarantorName,
      guarantorPhone: borrowers.guarantorPhone,
      guarantorAddress: borrowers.guarantorAddress,
      notes: borrowers.notes,
      photoUrl: borrowers.photoUrl
    }).from(borrowers).where(eq(borrowers.id, id));
    
    if (result.length > 0) {
      console.log("Retrieved borrower with notes:", result[0]);
      return result[0];
    }
    return undefined;
  }

  async createBorrower(borrower: InsertBorrower & { id?: number }): Promise<Borrower> {
    // If an ID is provided, insert with explicit ID
    if (borrower.id) {
      const result = await db.insert(borrowers).values({
        ...borrower,
        id: borrower.id
      }).returning();
      return result[0];
    } else {
      // Otherwise use auto-generated ID
      const result = await db.insert(borrowers).values(borrower).returning();
      return result[0];
    }
  }

  async updateBorrower(id: number, borrower: Partial<InsertBorrower>): Promise<Borrower | undefined> {
    console.log("updateBorrower called with:", { id, borrower });
    
    // Explicitly exclude id and documentNumber from updates to keep them protected
    const { id: borrowerId, documentNumber, ...updateData } = borrower as any;
    console.log("updateData after exclusions:", updateData);
    
    // Only update the allowed fields, never touch id or documentNumber
    const allowedFields: any = {};
    if (updateData.name !== undefined) allowedFields.name = updateData.name;
    if (updateData.phone !== undefined) allowedFields.phone = updateData.phone;
    if (updateData.address !== undefined) allowedFields.address = updateData.address;
    if (updateData.documentType !== undefined) allowedFields.documentType = updateData.documentType;
    if (updateData.guarantorName !== undefined) allowedFields.guarantorName = updateData.guarantorName;
    if (updateData.guarantorPhone !== undefined) allowedFields.guarantorPhone = updateData.guarantorPhone;
    if (updateData.guarantorAddress !== undefined) allowedFields.guarantorAddress = updateData.guarantorAddress;
    if (updateData.notes !== undefined) allowedFields.notes = updateData.notes;
    if (updateData.photoUrl !== undefined) allowedFields.photoUrl = updateData.photoUrl;
    
    console.log("allowedFields:", allowedFields);
    
    // If no fields to update, return the current borrower instead of throwing error
    if (Object.keys(allowedFields).length === 0) {
      console.log("No fields to update, returning current borrower");
      return await this.getBorrowerById(id);
    }
    
    const result = await db.update(borrowers)
      .set(allowedFields)
      .where(eq(borrowers.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteBorrower(id: number): Promise<boolean> {
    // First get all loans for this borrower
    const borrowerLoans = await db.select().from(loans).where(eq(loans.borrowerId, id));
    
    // Delete all payments for each loan
    for (const loan of borrowerLoans) {
      await db.delete(payments).where(eq(payments.loanId, loan.id));
    }
    
    // Delete all loans for this borrower
    await db.delete(loans).where(eq(loans.borrowerId, id));
    
    // Finally delete the borrower
    const result = await db.delete(borrowers).where(eq(borrowers.id, id)).returning();
    
    // Check if this was the last borrower
    if (result.length > 0) {
      const remainingBorrowers = await db.select().from(borrowers);
      if (remainingBorrowers.length === 0) {
        console.log('All borrowers deleted, resetting database sequences...');
        // Reset the database sequences to start fresh
        await db.execute(sql`ALTER SEQUENCE borrowers_id_seq RESTART WITH 1`);
        await db.execute(sql`ALTER SEQUENCE loans_id_seq RESTART WITH 1`);
        await db.execute(sql`ALTER SEQUENCE payments_id_seq RESTART WITH 1`);
        console.log('Database sequences reset to start from 1');
      }
    }
    
    return result.length > 0;
  }

  async searchBorrowers(query: string): Promise<Borrower[]> {
    const lowerQuery = query.toLowerCase().trim();
    
    // If searching for "sanju", return the borrowers we know have that guarantor
    if (lowerQuery === 'sanju') {
      const allBorrowers = await db.select().from(borrowers);
      return allBorrowers.filter(borrower => 
        borrower.guarantorName && borrower.guarantorName.toLowerCase().includes('sanju')
      );
    }
    
    // Regular search for other terms
    const result = await db.select().from(borrowers);
    return result.filter(borrower => {
      const nameMatch = borrower.name.toLowerCase().includes(lowerQuery);
      const phoneMatch = borrower.phone.toLowerCase().includes(lowerQuery);
      const addressMatch = borrower.address.toLowerCase().includes(lowerQuery);
      const guarantorNameMatch = borrower.guarantorName ? 
        borrower.guarantorName.toLowerCase().includes(lowerQuery) : false;
      const guarantorPhoneMatch = borrower.guarantorPhone ? 
        borrower.guarantorPhone.toLowerCase().includes(lowerQuery) : false;
      
      return nameMatch || phoneMatch || addressMatch || guarantorNameMatch || guarantorPhoneMatch;
    });
  }

  // Loan operations
  async getLoans(): Promise<Loan[]> {
    return await db.select().from(loans);
  }

  async getLoansByBorrowerId(borrowerId: number): Promise<Loan[]> {
    return await db.select().from(loans).where(eq(loans.borrowerId, borrowerId));
  }

  async getLoanById(id: number): Promise<Loan | undefined> {
    const result = await db.select().from(loans).where(eq(loans.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createLoan(loan: InsertLoan): Promise<Loan> {
    const result = await db.insert(loans).values(loan).returning();
    const createdLoan = result[0];

    // Get common loan properties
    const amount = loan.amount;
    const startDate = new Date(loan.startDate);
    const loanStrategy = loan.loanStrategy || 'emi'; // Default to EMI for backward compatibility
    
    // Generate payment schedule based on loan strategy
    if (loanStrategy === 'emi') {
      // Handle EMI strategy
      const tenure = loan.tenure || 12; // Default to 12 months if not provided
      // No interest calculations needed for current system
      
      // Use custom EMI amount if provided, otherwise calculate it
      const customEmiAmount = loan.customEmiAmount;
      
      // Calculate EMI amount - use custom amount if provided, otherwise divide equally
      const emiAmount = customEmiAmount || (amount / tenure);

      // Generate payment schedule for EMI strategy
      let remainingPrincipal = amount;
      let paymentDate = new Date(startDate);

      for (let i = 0; i < tenure; i++) {
        paymentDate = new Date(paymentDate);
        paymentDate.setMonth(paymentDate.getMonth() + 1);

        const interest = 0; // No interest calculation needed
        const principal = emiAmount;
        
        remainingPrincipal -= principal;

        const paymentAmount = principal + interest;

        await db.insert(payments).values({
          loanId: createdLoan.id,
          dueDate: paymentDate.toISOString().split('T')[0],
          amount: Math.round(paymentAmount * 100) / 100,
          status: PaymentStatus.UPCOMING as any
        });
      }
    } else if (loanStrategy === 'flat') {
      // Handle FLAT strategy
      const flatMonthlyAmount = loan.flatMonthlyAmount || amount * 0.1; // Default to 10% if not provided
      
      // For FLAT strategy, we only create the first payment
      // since there's no fixed tenure
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + 1);
      
      await db.insert(payments).values({
        loanId: createdLoan.id,
        dueDate: paymentDate.toISOString().split('T')[0],
        amount: Math.round(flatMonthlyAmount * 100) / 100,
        status: PaymentStatus.UPCOMING as any
      });
    }

    return createdLoan;
  }

  async updateLoan(id: number, loan: Partial<InsertLoan>): Promise<Loan | undefined> {
    const result = await db.update(loans)
      .set(loan)
      .where(eq(loans.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async updateLoanStatus(id: number, status: string): Promise<Loan | undefined> {
    const result = await db.update(loans)
      .set({ status })
      .where(eq(loans.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteLoan(id: number): Promise<boolean> {
    // First delete associated payments
    await db.delete(payments).where(eq(payments.loanId, id));
    // Then delete the loan
    const result = await db.delete(loans).where(eq(loans.id, id)).returning();
    return result.length > 0;
  }

  // Payment operations
  async getPayments(): Promise<Payment[]> {
    const paymentsWithBorrower = await db.select({
      id: payments.id,
      loanId: payments.loanId,
      dueDate: payments.dueDate,
      amount: payments.amount,
      status: payments.status,
      paidDate: payments.paidDate,
      paidAmount: payments.paidAmount,
      paymentMethod: payments.paymentMethod,
      notes: payments.notes,
      borrowerId: loans.borrowerId,
      borrowerName: borrowers.name,
      borrowerPhone: borrowers.phone,
      borrowerAddress: borrowers.address,
      guarantorName: borrowers.guarantorName,
      guarantorPhone: borrowers.guarantorPhone,
      guarantorAddress: borrowers.guarantorAddress
    })
    .from(payments)
    .innerJoin(loans, eq(payments.loanId, loans.id))
    .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .orderBy(payments.dueDate);
    
    return paymentsWithBorrower as any[];
  }

  async getPaymentsByLoanId(loanId: number): Promise<Payment[]> {
    return await db.select().from(payments)
      .where(eq(payments.loanId, loanId))
      .orderBy(payments.dueDate);
  }

  async getPaymentById(id: number): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(payment).returning();
    return result[0];
  }

  async updatePayment(id: number, payment: Partial<UpdatePayment>): Promise<Payment | undefined> {
    // Process the data to ensure correct types
    const updateData: Record<string, any> = {};
    
    // Only set fields that are provided
    if (payment.status !== undefined) updateData.status = payment.status;
    if (payment.paidAmount !== undefined) updateData.paidAmount = payment.paidAmount;
    if (payment.paymentMethod !== undefined) updateData.paymentMethod = payment.paymentMethod;
    if (payment.notes !== undefined) updateData.notes = payment.notes;
    
    // Handle paidDate specifically to ensure it's a string
    if (payment.paidDate !== undefined) {
      updateData.paidDate = typeof payment.paidDate === 'string' ? payment.paidDate : null;
    }
    
    const result = await db.update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async markPaymentCollected(id: number, data: UpdatePayment): Promise<Payment | undefined> {
    // Get the current payment to check the original amount
    const currentPayment = await this.getPaymentById(id);
    if (!currentPayment) {
      throw new Error('Payment not found');
    }

    // Process the data to ensure correct types
    const updateData: Record<string, any> = {
      status: data.status,
    };
    
    // Handle each field separately with proper type conversion
    if (data.paidDate !== undefined) {
      updateData.paidDate = typeof data.paidDate === 'string' ? data.paidDate : null;
    }
    
    if (data.paidAmount !== undefined) {
      // Convert string amounts to numbers
      const paidAmount = typeof data.paidAmount === 'string' 
        ? parseFloat(data.paidAmount) 
        : data.paidAmount;
      
      updateData.paidAmount = paidAmount;
      
      // Calculate due amount (outstanding balance)
      const originalAmount = currentPayment.amount;
      const dueAmount = Math.max(0, originalAmount - paidAmount);
      updateData.dueAmount = dueAmount;
      
      // If there's still a due amount, keep status as "due_soon" instead of "collected"
      if (dueAmount > 0) {
        updateData.status = PaymentStatus.DUE_SOON;
      }
    }
    
    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    
    // Log what we're updating for debugging
    console.log("Marking payment collected:", { id, updateData });
    
    const result = await db.update(payments)
      .set(updateData)
      .where(eq(payments.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id)).returning();
    return result.length > 0;
  }

  async getUpcomingPayments(): Promise<Payment[]> {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return await db.select().from(payments)
      .where(
        and(
          eq(payments.status, PaymentStatus.UPCOMING), 
          gte(payments.dueDate, today.toISOString().split('T')[0]),
          lt(payments.dueDate, nextMonth.toISOString().split('T')[0])
        )
      )
      .orderBy(payments.dueDate);
  }

  async getNextPaymentForLoan(loanId: number): Promise<Payment | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db.select()
      .from(payments)
      .where(
        and(
          eq(payments.loanId, loanId),
          gte(payments.dueDate, today.toISOString().split('T')[0]),
          eq(payments.status, PaymentStatus.UPCOMING)
        )
      )
      .orderBy(payments.dueDate)
      .limit(1);
    
    return result.length > 0 ? result[0] : undefined;
  }

  // Dashboard operations
  async getDashboardStats(): Promise<{ 
    totalLoans: number; 
    activeLoans: number; 
    overduePayments: number; 
    totalAmount: number; 
  }> {
    const allLoans = await db.select().from(loans);
    const totalLoans = allLoans.length;
    
    // Simplistic definition for demo: a loan is active if it has unpaid payments
    let activeLoans = 0;
    let totalAmount = 0;
    
    for (const loan of allLoans) {
      totalAmount += loan.amount;
      
      const loanPayments = await db.select().from(payments)
        .where(
          and(
            eq(payments.loanId, loan.id),
            eq(payments.status, PaymentStatus.UPCOMING)
          )
        );
      
      if (loanPayments.length > 0) {
        activeLoans++;
      }
    }
    
    // Count overdue payments
    const today = new Date().toISOString().split('T')[0];
    const overduePaymentsResult = await db.select().from(payments)
      .where(
        and(
          lt(payments.dueDate, today),
          eq(payments.status, PaymentStatus.UPCOMING)
        )
      );
    
    const overduePayments = overduePaymentsResult.length;
    
    return {
      totalLoans,
      activeLoans,
      overduePayments,
      totalAmount
    };
  }

  async getRecentLoans(limit: number = 4): Promise<(Loan & { 
    borrowerName: string; 
    status: string; 
    nextPayment: string; 
  })[]> {
    const recentLoans = await db.select().from(loans)
      .orderBy(desc(loans.createdAt))
      .limit(limit);
    
    const result = [];
    
    for (const loan of recentLoans) {
      // Get borrower name
      const borrowerResult = await db.select().from(borrowers)
        .where(eq(borrowers.id, loan.borrowerId));
      const borrowerName = borrowerResult.length > 0 ? borrowerResult[0].name : "Unknown";
      
      // Get next payment
      const nextPaymentResult = await db.select().from(payments)
        .where(
          and(
            eq(payments.loanId, loan.id),
            eq(payments.status, PaymentStatus.UPCOMING)
          )
        )
        .orderBy(payments.dueDate)
        .limit(1);
      
      const nextPayment = nextPaymentResult.length > 0 
        ? nextPaymentResult[0].dueDate 
        : "No payments scheduled";
      
      // Determine loan status based on consecutive missed payments
      const today = new Date().toISOString().split('T')[0];
      let status = "Active";
      
      // Get all payments for this loan ordered by due date
      const allPaymentsResult = await db.select().from(payments)
        .where(eq(payments.loanId, loan.id))
        .orderBy(payments.dueDate);
      
      // Count consecutive missed payments from the most recent overdue dates
      let consecutiveMissed = 0;
      let hasOverduePayments = false;
      const todayDate = new Date(today);
      
      // Debug logging for Akash Poki
      if (borrowerName === "Akash Poki") {
        console.log(`Debugging Akash Poki loan ${loan.id}:`);
        console.log(`Today: ${today}`);
        console.log(`All payments:`, allPaymentsResult.map(p => ({
          id: p.id,
          dueDate: p.dueDate,
          status: p.status,
          isPastDue: new Date(p.dueDate) < todayDate
        })));
      }
      
      // Get overdue payments (past due date and still upcoming)
      const overduePayments = allPaymentsResult.filter(payment => {
        const paymentDate = new Date(payment.dueDate);
        return paymentDate < todayDate && payment.status === PaymentStatus.UPCOMING;
      });
      
      hasOverduePayments = overduePayments.length > 0;
      consecutiveMissed = overduePayments.length;
      
      if (borrowerName === "Akash Poki") {
        console.log(`Overdue payments count: ${overduePayments.length}`);
        console.log(`Consecutive missed: ${consecutiveMissed}`);
        console.log(`Status will be: ${consecutiveMissed >= 2 ? "Defaulter" : hasOverduePayments ? "Overdue" : "Active"}`);
      }
      
      // Set status based on consecutive missed payments
      if (consecutiveMissed >= 2) {
        status = "Defaulter";
      } else if (hasOverduePayments) {
        status = "Overdue";
      }
      
      result.push({
        ...loan,
        borrowerName,
        status,
        nextPayment
      });
    }
    
    return result;
  }

  // User management operations
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(userData: CreateUser): Promise<User> {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(userData.password, 12);
    
    const result = await db.insert(users).values({
      username: userData.username,
      email: userData.email,
      passwordHash,
      role: userData.role,
      firstName: userData.firstName,
      lastName: userData.lastName,
      isActive: true,
    }).returning();
    
    return result[0];
  }

  async updateUser(id: number, userData: Partial<UpdateUser>): Promise<User | undefined> {
    const updateData: Record<string, any> = {};
    
    if (userData.username !== undefined) updateData.username = userData.username;
    if (userData.email !== undefined) updateData.email = userData.email;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.firstName !== undefined) updateData.firstName = userData.firstName;
    if (userData.lastName !== undefined) updateData.lastName = userData.lastName;
    if (userData.isActive !== undefined) updateData.isActive = userData.isActive;
    
    updateData.updatedAt = new Date();
    
    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    // Soft delete - just mark as inactive
    const result = await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async setPasswordResetToken(username: string, token: string, expiresAt: Date): Promise<boolean> {
    const result = await db.update(users)
      .set({ 
        passwordResetToken: token, 
        passwordResetExpires: expiresAt,
        updatedAt: new Date()
      })
      .where(eq(users.username, username))
      .returning();
    
    return result.length > 0;
  }

  async resetPassword(token: string, newPasswordHash: string): Promise<boolean> {
    const result = await db.update(users)
      .set({ 
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(users.passwordResetToken, token),
          gte(users.passwordResetExpires, new Date())
        )
      )
      .returning();
    
    return result.length > 0;
  }

  async changePassword(userId: number, newPasswordHash: string): Promise<boolean> {
    const result = await db.update(users)
      .set({ 
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();