import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Extend session type
declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    userId?: number;
    username?: string;
    role?: string;
  }
}
import { storage } from "./storage";
import { AuthService, type AuthenticatedUser } from "./auth";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { 
  insertBorrowerSchema, updateBorrowerSchema, insertLoanSchema, 
  insertPaymentSchema, updatePaymentSchema, 
  createUserSchema, updateUserSchema, changePasswordSchema, resetPasswordSchema, loginSchema,
  PaymentStatus, LoanStrategy, UserRole,
  borrowers, loans, payments, users
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { addMonths, format, isBefore, parseISO, subDays } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get __dirname equivalent for ES modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Ensure API routes return JSON
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Helper functions
  const validateBody = <T>(schema: z.ZodSchema<T>, req: Request): T => {
    try {
      return schema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        throw new Error(validationError.message);
      }
      throw error;
    }
  };

  const handleError = (error: unknown, res: Response) => {
    console.error(error);
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Unknown error occurred' });
  };

  // Initialize default users if no users exist
  const initializeDefaultUsers = async () => {
    try {
      const existingUsers = await storage.getUsers();
      if (existingUsers.length === 0) {
        console.log('No users found, creating default users...');
        
        // Create default admin user
        await AuthService.createUser({
          username: 'admin',
          password: 'Admin@2024!',
          role: UserRole.ADMIN,
          firstName: 'System',
          lastName: 'Administrator',
          email: 'admin@loansight.com'
        });
        console.log('Default admin user created: admin');
        
        // Create your user account
        await AuthService.createUser({
          username: 'mandeepsingh10',
          password: 'Md@Singh2024!',
          role: UserRole.ADMIN,
          firstName: 'Mandeep',
          lastName: 'Singh',
          email: 'mandeep@example.com'
        });
        console.log('User account created: mandeepsingh10');
        
        // Create Lakshay's user account
        await AuthService.createUser({
          username: 'lakshayb',
          password: 'Lk$Batra2024#',
          role: UserRole.ADMIN,
          firstName: 'Lakshay',
          lastName: 'Batra',
          email: 'lakshay@example.com'
        });
        console.log('User account created: lakshayb');
        
        // Create viewer user for read-only access
        await AuthService.createUser({
          username: 'viewer',
          password: 'View@2024!',
          role: UserRole.VIEWER,
          firstName: 'View',
          lastName: 'Only',
          email: 'viewer@example.com'
        });
        console.log('Viewer account created: viewer');
        
        console.log('Default users initialization completed successfully!');
      }
    } catch (error) {
      console.error('Error initializing default users:', error);
    }
  };

  // Initialize default users on startup
  await initializeDefaultUsers();



  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: any) => {
    if ((req.session as any)?.authenticated && (req.session as any)?.userId) {
      next();
    } else {
      res.status(401).json({ message: 'Authentication required' });
    }
  };

  // Admin-only middleware for write operations
  const requireAdmin = (req: Request, res: Response, next: any) => {
    if ((req.session as any)?.authenticated && (req.session as any)?.role === UserRole.ADMIN) {
      next();
    } else {
      res.status(403).json({ message: 'Admin access required' });
    }
  };

  // Manager or Admin middleware
  const requireManagerOrAdmin = (req: Request, res: Response, next: any) => {
    const role = (req.session as any)?.role;
    if ((req.session as any)?.authenticated && (role === UserRole.ADMIN || role === UserRole.MANAGER)) {
      next();
    } else {
      res.status(403).json({ message: 'Manager or Admin access required' });
    }
  };

  // Configure multer for photo uploads
  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads/photos');
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'borrower-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: multerStorage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Check file type
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  // Photo upload endpoint
  app.post('/api/upload/photo', requireAuth, upload.single('photo'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No photo uploaded' });
      }

      // Generate URL for the uploaded file
      const photoUrl = `/uploads/photos/${req.file.filename}`;
      
      res.status(200).json({ 
        message: 'Photo uploaded successfully',
        photoUrl: photoUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ message: 'Failed to upload photo' });
    }
  });

  // Serve uploaded photos
  app.use('/uploads', (req: Request, res: Response, next: any) => {
    // Serve static files from uploads directory
    const uploadsPath = path.join(__dirname, '../uploads');
    res.sendFile(path.join(uploadsPath, req.path), (err) => {
      if (err) {
        res.status(404).json({ message: 'File not found' });
      }
    });
  });

  // Authentication routes
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      console.log("Login request body:", req.body);
      
      // Validate input
      const credentials = validateBody(loginSchema, req);
      
      // Authenticate user
      const authenticatedUser = await AuthService.authenticateUser(credentials);
      
      if (!authenticatedUser) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Set session data
      (req.session as any).authenticated = true;
      (req.session as any).userId = authenticatedUser.id;
      (req.session as any).username = authenticatedUser.username;
      (req.session as any).role = authenticatedUser.role;
      
      console.log("Login successful for:", authenticatedUser.username, "with role:", authenticatedUser.role);
      res.status(200).json({ 
        message: 'Login successful', 
        username: authenticatedUser.username, 
        role: authenticatedUser.role,
        firstName: authenticatedUser.firstName,
        lastName: authenticatedUser.lastName
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/status', async (req: Request, res: Response) => {
    try {
      console.log("Auth status check, session:", req.session);
      if ((req.session as any)?.authenticated && (req.session as any)?.userId) {
        // Verify user still exists and is active
        const user = await AuthService.getUserById((req.session as any).userId);
        
        if (!user) {
          // User no longer exists or is inactive, clear session
          req.session.destroy(() => {});
          return res.status(200).json({ authenticated: false });
        }

        const response = { 
          authenticated: true, 
          userId: (req.session as any).userId,
          username: (req.session as any).username,
          role: (req.session as any).role,
          firstName: user.firstName,
          lastName: user.lastName
        };
        console.log("Auth status response:", response);
        res.status(200).json(response);
      } else {
        const response = { authenticated: false };
        console.log("Auth status response:", response);
        res.status(200).json(response);
      }
    } catch (error) {
      console.error("Auth status error:", error);
      res.status(200).json({ authenticated: false });
    }
  });

  // Password reset request
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }

      const success = await AuthService.requestPasswordReset(username);
      
      if (success) {
        res.status(200).json({ message: 'Password reset instructions sent to your email' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const resetData = validateBody(resetPasswordSchema, req);
      
      const success = await AuthService.resetPassword(resetData.token, resetData.newPassword);
      
      if (success) {
        res.status(200).json({ message: 'Password reset successfully' });
      } else {
        res.status(400).json({ message: 'Invalid or expired reset token' });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Change password (authenticated user)
  app.post('/api/auth/change-password', requireAuth, async (req: Request, res: Response) => {
    try {
      const changeData = validateBody(changePasswordSchema, req);
      const userId = (req.session as any).userId;
      
      const success = await AuthService.changePassword(
        userId, 
        changeData.currentPassword, 
        changeData.newPassword
      );
      
      if (success) {
        res.status(200).json({ message: 'Password changed successfully' });
      } else {
        res.status(400).json({ message: 'Current password is incorrect' });
      }
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes (Admin only)
  app.get('/api/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const allUsers = await storage.getUsers();
      const usersWithoutPasswords = allUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post('/api/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userData = validateBody(createUserSchema, req);
      
      // Validate password strength
      const passwordValidation = AuthService.validatePassword(userData.password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ 
          message: 'Password does not meet requirements',
          errors: passwordValidation.errors
        });
      }
      
      const user = await AuthService.createUser(userData);
      
      if (user) {
        res.status(201).json({
          message: 'User created successfully',
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName
          }
        });
      } else {
        res.status(400).json({ message: 'Failed to create user' });
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  app.put('/api/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = validateBody(updateUserSchema, req);
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      if (updatedUser) {
        res.json({
          message: 'User updated successfully',
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            isActive: updatedUser.isActive
          }
        });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete('/api/users/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deleting the current user
      if (userId === (req.session as any).userId) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
      
      const success = await storage.deleteUser(userId);
      
      if (success) {
        res.json({ message: 'User deleted successfully' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  // Generate payment schedule based on loan details
  const generatePaymentSchedule = async (loanId: number) => {
    try {
      const loan = await storage.getLoanById(loanId);
      if (!loan) throw new Error('Loan not found');

      // Check if payments already exist for this loan to prevent duplicates
      const existingPayments = await storage.getPaymentsByLoanId(loanId);
      if (existingPayments.length > 0) {
        console.log(`Payment schedule already exists for loan ${loanId}, skipping generation`);
        return existingPayments;
      }

      // Convert startDate string to Date if needed
      const startDate = typeof loan.startDate === 'object' && loan.startDate !== null
        ? loan.startDate 
        : new Date(loan.startDate);
      
      const paymentSchedule = [];
      
      // Calculate payment amounts based on loan strategy
      let numberOfPayments = 12; // Default for monthly payments for 1 year
      let paymentAmount = 0;
      
      // Determine number of payments and amount based on loan strategy
      if (loan.loanStrategy === 'emi') {
        // If using EMI strategy with tenure
        if (loan.tenure) {
          numberOfPayments = loan.tenure;
        }
        
        // Use custom EMI amount if provided
        if (loan.customEmiAmount) {
          paymentAmount = loan.customEmiAmount;
        } else {
          // Default calculation if no custom amount
          paymentAmount = loan.amount / numberOfPayments;
        }
      } else if (loan.loanStrategy === 'flat') {
        // For flat strategy, use the flatMonthlyAmount directly
        paymentAmount = loan.flatMonthlyAmount || (loan.amount / 12); // Default to amount/12 if not specified
        
        // For flat strategy, we'll generate 6 monthly payments by default
        numberOfPayments = 6;
      } else if (loan.loanStrategy === 'custom') {
        // For custom strategy, no payments are generated automatically
        // Payments will be added manually by the user
        numberOfPayments = 0;
        paymentAmount = 0;
        console.log("Custom loan: No automatic payments generated");
      } else if (loan.loanStrategy === 'gold_silver') {
        // For gold & silver strategy, no payments are generated automatically
        // Payments will be added manually by the user
        numberOfPayments = 0;
        paymentAmount = 0;
        console.log("Gold & Silver loan: No automatic payments generated");
      }
      
      console.log(`Generating payment schedule for loan ${loanId}: ${numberOfPayments} payments of ${paymentAmount} each`);
      
      // Create payment records
      for (let i = 0; i < numberOfPayments; i++) {
        let dueDate;
        
        // For EMI and FLAT strategies, calculate monthly due dates
        dueDate = addMonths(startDate, i + 1);
        
        // Determine payment status
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
        const paymentDueDate = new Date(dueDate);
        paymentDueDate.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
        
        let status = PaymentStatus.UPCOMING;
        let paidDate = null;
        let paidAmount = null;
        
        // For EMI and FLAT strategies, use the existing logic
        if (isBefore(dueDate, today)) {
          status = PaymentStatus.OVERDUE;
        } else if (isBefore(dueDate, addMonths(today, 1))) {
          if (isBefore(dueDate, addMonths(today, 1)) && isBefore(subDays(dueDate, 5), today)) {
            status = PaymentStatus.DUE_SOON;
          }
        }
        
        // Set first payment as due soon if in the future
        if (i === 0 && status === PaymentStatus.UPCOMING) {
          status = PaymentStatus.DUE_SOON;
        }
        
        // Format the date as a proper ISO string for PostgreSQL
        const formattedDueDate = dueDate.toISOString().split('T')[0];
        console.log(`Creating payment for ${formattedDueDate} with amount ${paymentAmount}`);
        
        // Create payment record - use a fixed amount based on strategy
        const payment = {
          loanId,
          dueDate: formattedDueDate, // Store as YYYY-MM-DD string format
          principal: paymentAmount,
          interest: 0, // Simplified for now
          amount: paymentAmount,
          status,
          paidDate,
          paidAmount
        };
        
        const createdPayment = await storage.createPayment(payment);
        paymentSchedule.push(createdPayment);
      }
      
      return paymentSchedule;
    } catch (error) {
      console.error('Error generating payment schedule:', error);
      throw error;
    }
  };

  // ---------- API Routes -------------

  // Dashboard stats
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/dashboard/recent-loans', requireAuth, async (req, res) => {
    try {
      const recentLoans = await storage.getRecentLoans();
      // Prevent caching to ensure fresh status calculations
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.json(recentLoans);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/dashboard/upcoming-payments', async (req, res) => {
    try {
      const upcomingPayments = await storage.getUpcomingPayments();
      const result = [];

      for (const payment of upcomingPayments) {
        const loan = await storage.getLoanById(payment.loanId);
        if (loan) {
          const borrower = await storage.getBorrowerById(loan.borrowerId);
          if (borrower) {
            const dueDate = typeof payment.dueDate === 'object' && payment.dueDate !== null
              ? payment.dueDate 
              : new Date(payment.dueDate);
            
            const today = new Date();
            const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            result.push({
              ...payment,
              borrower: borrower.name,
              daysLeft: daysLeft
            });
          }
        }
      }

      res.json(result.slice(0, 3)); // Return top 3 upcoming payments
    } catch (error) {
      handleError(error, res);
    }
  });

  // Get next available ID
  app.get('/api/borrowers/next-id', async (req, res) => {
    try {
      const borrowers = await storage.getBorrowers();
      const existingIds = new Set(borrowers.map(b => b.id));
      
      // Find the first missing ID starting from 1
      let nextId = 1;
      while (existingIds.has(nextId)) {
        nextId++;
      }
      
      res.json({ nextId });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Borrower routes (protected)
  app.get('/api/borrowers', requireAuth, async (req, res) => {
    try {
      // Disable caching for search requests
      if (req.query.search) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
      
      const query = req.query.search as string;
      const borrowers = query && query.trim()
        ? await storage.searchBorrowers(query) 
        : await storage.getBorrowers();
      
      // Enhance borrowers with latest loan and payment info
      const enhancedBorrowers = await Promise.all(borrowers.map(async (borrower) => {
        const loans = await storage.getLoansByBorrowerId(borrower.id);
        if (loans.length === 0) {
          return { ...borrower, loan: null, nextPayment: null, status: 'No Loan' };
        }
        
        // Get most recent loan
        const latestLoan = loans.sort((a, b) => {
          // Safely handle null createdAt values by defaulting to current time
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date();
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date();
          return dateB.getTime() - dateA.getTime();
        })[0];
        
        // Get all payments for this loan
        const payments = await storage.getPaymentsByLoanId(latestLoan.id);
        const upcomingPayments = payments
          .filter(p => p.status !== PaymentStatus.COLLECTED)
          .sort((a, b) => 
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          );
        
        let nextPayment = null;
        let status = 'Current';
        
        if (upcomingPayments.length > 0) {
          nextPayment = upcomingPayments[0];
          
          // Check if the payment is overdue (missed)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dueDate = new Date(nextPayment.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate < today) {
            status = 'Missed';
          } else {
            status = nextPayment.status;
          }
        } else {
          status = 'Completed';
        }
        
        return {
          ...borrower,
          loan: {
            ...latestLoan,
            formattedAmount: latestLoan.amount,
            formattedInterest: 'N/A',
            paymentType: latestLoan.loanStrategy === 'emi' ? 'EMI' : 'FLAT'
          },
          nextPayment: nextPayment ? format(new Date(nextPayment.dueDate), 'dd MMM yyyy') : null,
          status
        };
      }));
      
      res.json(enhancedBorrowers);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/borrowers/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const borrower = await storage.getBorrowerById(id);
      if (!borrower) {
        return res.status(404).json({ message: 'Borrower not found' });
      }
      res.json(borrower);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Get all loans for a specific borrower
  app.get('/api/borrowers/:id/loans', requireAuth, async (req, res) => {
    try {
      const borrowerId = parseInt(req.params.id);
      const loans = await storage.getLoansByBorrowerId(borrowerId);
      
      // Add next payment information to each loan
      const loansWithNextPayment = await Promise.all(
        loans.map(async (loan) => {
          const nextPayment = await storage.getNextPaymentForLoan(loan.id);
          return {
            ...loan,
            nextPayment: nextPayment ? format(new Date(nextPayment.dueDate), "MMM d, yyyy") : "No payments"
          };
        })
      );
      
      res.json(loansWithNextPayment);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Notes update endpoint
  app.post('/api/borrowers/:id/notes', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    console.log("=== NOTES UPDATE ENDPOINT HIT ===");
    console.log("Borrower ID:", id);
    console.log("Notes data:", req.body);
    
    storage.updateBorrower(id, { notes: req.body.notes })
      .then(borrower => {
        if (!borrower) {
          return res.status(404).json({ message: 'Borrower not found' });
        }
        console.log("Notes saved successfully:", borrower.notes);
        res.json({ success: true, borrower });
      })
      .catch(error => {
        console.error('Notes update error:', error);
        res.status(500).json({ error: 'Failed to update notes' });
      });
  });

  app.post('/api/borrowers', requireAdmin, async (req, res) => {
    try {
      const data = validateBody(insertBorrowerSchema, req);
      console.log("Creating borrower with data:", data);
      const borrower = await storage.createBorrower(data);
      res.status(201).json(borrower);
    } catch (error) {
      console.error("Error creating borrower:", error);
      handleError(error, res);
    }
  });

  app.put('/api/borrowers/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("PUT /api/borrowers/:id called with:", req.body);
      
      // For notes-only updates, skip validation and handle directly
      if (req.body.notes !== undefined && Object.keys(req.body).length === 1) {
        console.log("=== NOTES UPDATE VIA PUT ===");
        const borrower = await storage.updateBorrower(id, { notes: req.body.notes });
        if (!borrower) {
          return res.status(404).json({ message: 'Borrower not found' });
        }
        console.log("Notes updated:", borrower.notes);
        return res.json(borrower);
      }
      
      const data = validateBody(updateBorrowerSchema, req);
      const borrower = await storage.updateBorrower(id, data);
      if (!borrower) {
        return res.status(404).json({ message: 'Borrower not found' });
      }
      res.json(borrower);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete('/api/borrowers/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteBorrower(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Borrower not found' });
      }
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Loan routes
  app.get('/api/loans', async (req, res) => {
    try {
      const borrowerId = req.query.borrowerId ? parseInt(req.query.borrowerId as string) : undefined;
      const loans = borrowerId 
        ? await storage.getLoansByBorrowerId(borrowerId) 
        : await storage.getLoans();
      res.json(loans);
    } catch (error) {
      handleError(error, res);
    }
  });
  
  // Get loans for a specific borrower
  app.get('/api/loans/borrower/:borrowerId', async (req, res) => {
    try {
      const borrowerId = parseInt(req.params.borrowerId);
      const loans = await storage.getLoansByBorrowerId(borrowerId);
      console.log("Loans for borrower", borrowerId, ":", loans);
      res.json(loans);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.get('/api/loans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const loan = await storage.getLoanById(id);
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      res.json(loan);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post('/api/loans', requireAdmin, async (req, res) => {
    try {
      // First validate the loan data
      const rawData = validateBody(insertLoanSchema, req);
      
      // Ensure borrower exists
      const borrower = await storage.getBorrowerById(rawData.borrowerId);
      if (!borrower) {
        return res.status(400).json({ message: 'Borrower not found' });
      }
      
      // Create loan data with required fields to satisfy type requirements
      const data = {
        borrowerId: rawData.borrowerId,
        amount: rawData.amount,
        startDate: rawData.startDate,
        guarantorName: rawData.guarantorName,
        guarantorPhone: rawData.guarantorPhone,
        guarantorAddress: rawData.guarantorAddress,
        notes: rawData.notes,
        loanStrategy: rawData.loanStrategy || LoanStrategy.EMI,
        tenure: rawData.tenure,
        customEmiAmount: rawData.customEmiAmount,
        flatMonthlyAmount: rawData.flatMonthlyAmount,
        pmType: rawData.pmType,
        metalWeight: rawData.metalWeight,
        purity: rawData.purity,
        netWeight: rawData.netWeight,
        amountPaid: rawData.amountPaid,
        goldSilverNotes: rawData.goldSilverNotes,
      };
      
      console.log('Creating loan with data:', data);
      
      // Save the loan details
      const loan = await storage.createLoan(data);
      console.log('Loan created:', loan);
      
      // Generate the payment schedule
      await generatePaymentSchedule(loan.id);
      
      res.status(201).json(loan);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.put('/api/loans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = validateBody(insertLoanSchema.partial(), req);
      const loan = await storage.updateLoan(id, data);
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      res.json(loan);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.patch('/api/loans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      // Validate status
      if (!status || !['active', 'completed', 'defaulted', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be one of: active, completed, defaulted, cancelled' });
      }
      
      const loan = await storage.updateLoanStatus(id, status);
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      res.json(loan);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.delete('/api/loans/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteLoan(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      res.json({ success: true });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Payment routes
  app.get('/api/payments', async (req, res) => {
    try {
      const loanId = req.query.loanId ? parseInt(req.query.loanId as string) : undefined;
      const month = req.query.month as string; // Format: YYYY-MM
      
      let payments = loanId 
        ? await storage.getPaymentsByLoanId(loanId) 
        : await storage.getPayments();
      
      // Filter by month if provided
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        payments = payments.filter(payment => {
          const paymentDate = new Date(payment.dueDate);
          return paymentDate.getFullYear() === year && paymentDate.getMonth() === monthNum - 1;
        });
      }
      
      // Enhance payments with borrower and loan information
      const enhancedPayments = await Promise.all(payments.map(async payment => {
        const loan = await storage.getLoanById(payment.loanId);
        const borrower = loan ? await storage.getBorrowerById(loan.borrowerId) : null;
        
        return {
          ...payment,
          borrower: borrower ? borrower.name : 'Unknown',
          phone: borrower ? borrower.phone : 'No contact',
          loanType: loan ? loan.loanStrategy?.toUpperCase() || 'EMI' : 'Unknown'
        };
      }));
      
      // Sort by due date
      enhancedPayments.sort((a, b) => {
        // First by status (overdue first, then due soon, then upcoming, then collected)
        const statusOrder = {
          [PaymentStatus.OVERDUE]: 0,
          [PaymentStatus.DUE_SOON]: 1,
          [PaymentStatus.UPCOMING]: 2,
          [PaymentStatus.COLLECTED]: 3
        };
        
        const statusDiff = statusOrder[a.status as PaymentStatus] - statusOrder[b.status as PaymentStatus];
        if (statusDiff !== 0) return statusDiff;
        
        // Then by due date (oldest first)
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
      
      res.json(enhancedPayments);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Get payments for a specific loan
  app.get('/api/payments/loan/:loanId', async (req, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
      console.log(`Fetching payments for loan ${loanId}`);
      
      const payments = await storage.getPaymentsByLoanId(loanId);
      
      // If no payments are found, try to generate them
      if (payments.length === 0) {
        console.log(`No payments found for loan ${loanId}, generating payment schedule...`);
        try {
          await generatePaymentSchedule(loanId);
          // Re-fetch the payments after generation
          const newPayments = await storage.getPaymentsByLoanId(loanId);
          console.log(`Generated ${newPayments.length} payments for loan ${loanId}`);
          
          // Sort the payments
          newPayments.sort((a, b) => {
            // First by status priority
            const statusOrder = {
              [PaymentStatus.OVERDUE]: 0,
              [PaymentStatus.DUE_SOON]: 1,
              [PaymentStatus.UPCOMING]: 2,
              [PaymentStatus.COLLECTED]: 3
            };
            
            const statusDiff = statusOrder[a.status as PaymentStatus] - statusOrder[b.status as PaymentStatus];
            if (statusDiff !== 0) return statusDiff;
            
            // Then by due date (oldest first)
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          });
          
          return res.json(newPayments);
        } catch (error) {
          console.error("Error generating payments:", error);
          return res.json([]);  // Return empty array if generation failed
        }
      }
      
      // Sort the existing payments
      payments.sort((a, b) => {
        // First by status priority
        const statusOrder = {
          [PaymentStatus.OVERDUE]: 0,
          [PaymentStatus.DUE_SOON]: 1,
          [PaymentStatus.UPCOMING]: 2,
          [PaymentStatus.COLLECTED]: 3
        };
        
        const statusDiff = statusOrder[a.status as PaymentStatus] - statusOrder[b.status as PaymentStatus];
        if (statusDiff !== 0) return statusDiff;
        
        // Then by due date (oldest first)
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
      
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      handleError(error, res);
    }
  });

  app.get('/api/payments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const payment = await storage.getPaymentById(id);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      res.json(payment);
    } catch (error) {
      handleError(error, res);
    }
  });

  app.post('/api/payments/:id/collect', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get the raw input data
      const rawData = req.body;
      console.log('Payment collection raw data:', rawData);
      
      // Create a properly typed UpdatePayment object
      const data = {
        status: rawData.status || PaymentStatus.COLLECTED,
        paidDate: undefined,
        paidAmount: undefined,
        paymentMethod: undefined,
        notes: undefined
      };
      
      // Process optional fields
      if (rawData.paidDate !== undefined) {
        data.paidDate = rawData.paidDate;
      }
      
      if (rawData.paidAmount !== undefined) {
        // Convert to number if it's a string
        data.paidAmount = typeof rawData.paidAmount === 'string' 
          ? parseFloat(rawData.paidAmount) 
          : rawData.paidAmount;
      }
      
      if (rawData.paymentMethod !== undefined) {
        data.paymentMethod = rawData.paymentMethod;
      }
      
      if (rawData.notes !== undefined) {
        data.notes = rawData.notes;
      }
      
      console.log('Payment collection processed data:', data);
      
      const payment = await storage.markPaymentCollected(id, data);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      console.error('Error collecting payment:', error);
      handleError(error, res);
    }
  });

  app.put('/api/payments/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get raw data and manually process it
      const rawData = req.body;
      
      // Create a properly typed data object for UpdatePayment
      const data = {
        status: rawData.status || "",
        paidDate: undefined,
        paidAmount: undefined,
        paymentMethod: undefined,
        notes: undefined
      };
      
      if (rawData.status !== undefined) {
        data.status = rawData.status;
      }
      
      if (rawData.paidDate !== undefined) {
        data.paidDate = rawData.paidDate;
      }
      
      if (rawData.paidAmount !== undefined) {
        // Convert to number if it's a string
        data.paidAmount = typeof rawData.paidAmount === 'string' 
          ? parseFloat(rawData.paidAmount) 
          : rawData.paidAmount;
      }
      
      if (rawData.paymentMethod !== undefined) {
        data.paymentMethod = rawData.paymentMethod;
      }
      
      if (rawData.notes !== undefined) {
        data.notes = rawData.notes;
      }
      
      console.log('Updating payment with data:', data);
      
      const payment = await storage.updatePayment(id, data);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      res.json(payment);
    } catch (error) {
      console.error('Error updating payment:', error);
      handleError(error, res);
    }
  });

  // Delete payment
  app.delete('/api/payments/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid payment ID' });
      }
      
      const success = await storage.deletePayment(id);
      if (!success) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
      handleError(error, res);
    }
  });

  // Backup endpoints
  app.post('/api/backup/create', requireAdmin, async (req, res) => {
    try {
      console.log('Creating backup...');
      
      // Get all data from storage (excluding users for security)
      const borrowers = await storage.getBorrowers();
      const loans = await storage.getLoans();
      const payments = await storage.getPayments();
      
      // Get photos from uploads directory and embed them in backup
      const photosDir = path.join(__dirname, '../uploads/photos');
      const photos: { [filename: string]: { data: string; mimetype: string; size: number } } = {};
      
      if (fs.existsSync(photosDir)) {
        const photoFiles = fs.readdirSync(photosDir);
        
        // Also check which photos are referenced in borrower data
        const referencedPhotos = new Set<string>();
        borrowers.forEach(borrower => {
          if (borrower.photoUrl) {
            const filename = borrower.photoUrl.split('/').pop();
            if (filename) {
              referencedPhotos.add(filename);
            }
          }
        });
        
        console.log(`Found ${photoFiles.length} photo files, ${referencedPhotos.size} referenced in borrower data`);
        
        // Only include photos that are referenced by borrowers
        for (const filename of photoFiles) {
          // Only include this photo if it's referenced by a borrower
          if (referencedPhotos.has(filename)) {
            const filePath = path.join(photosDir, filename);
            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString('base64');
            
            // Determine MIME type based on file extension
            const ext = path.extname(filename).toLowerCase();
            let mimetype = 'image/jpeg'; // default
            if (ext === '.png') mimetype = 'image/png';
            else if (ext === '.gif') mimetype = 'image/gif';
            else if (ext === '.webp') mimetype = 'image/webp';
            
            photos[filename] = {
              data: base64Data,
              mimetype: mimetype,
              size: fileBuffer.length
            };
          }
        }
        
        // Check for orphaned photos (files not referenced by any borrower)
        const orphanedPhotos = photoFiles.filter(filename => !referencedPhotos.has(filename));
        if (orphanedPhotos.length > 0) {
          console.log(`Warning: Found ${orphanedPhotos.length} orphaned photos: ${orphanedPhotos.join(', ')}`);
        }
        
        console.log(`Included ${Object.keys(photos).length} referenced photos in backup (${Object.values(photos).reduce((sum, photo) => sum + photo.size, 0)} bytes total)`);
      }
      
      const backupData = {
        metadata: {
          exportDate: new Date().toISOString(),
          version: '2.0',
          totalBorrowers: borrowers.length,
          totalLoans: loans.length,
          totalPayments: payments.length,
          totalUsers: 0, // Users are not backed up for security
          totalPhotos: Object.keys(photos).length,
          totalPhotoSize: Object.values(photos).reduce((sum, photo) => sum + (photo.size || 0), 0),
          features: {
            photoSupport: true,
            guarantorPerLoan: true,
            multipleLoanStrategies: true,
            customPayments: true,
            notesSupport: true,
            userManagement: false // Users are not included in backup
          }
        },
        data: {
          borrowers,
          loans,
          payments
          // users excluded for security
        },
        photos
      };
      
      console.log('Backup created successfully');
      res.json(backupData);
    } catch (error) {
      console.error('Backup creation error:', error);
      handleError(error, res);
    }
  });

  app.post('/api/backup/restore', requireAdmin, async (req, res) => {
    try {
      console.log('Starting data restore...');
      const { data, photos } = req.body;
      
      if (!data || !data.borrowers || !data.loans || !data.payments) {
        return res.status(400).json({ message: 'Invalid backup file format' });
      }
      
      // Note: Users are not restored from backup for security reasons
      // Default users will be created on startup if no users exist
      
      console.log('Clearing existing data...');
      
      // Clear existing data using TRUNCATE CASCADE for complete cleanup
      // Note: Users table is not cleared to preserve admin access
      await db.execute(sql.raw('TRUNCATE TABLE payments, loans, borrowers RESTART IDENTITY CASCADE'));
      console.log('Tables cleared successfully (users preserved)');
      
      // Restore photos if they exist
      if (photos && typeof photos === 'object') {
        console.log('Restoring photos...');
        const photosDir = path.join(__dirname, '../uploads/photos');
        
        // Create photos directory if it doesn't exist
        if (!fs.existsSync(photosDir)) {
          fs.mkdirSync(photosDir, { recursive: true });
        }
        
        // Clear existing photos
        if (fs.existsSync(photosDir)) {
          const existingPhotos = fs.readdirSync(photosDir);
          for (const photo of existingPhotos) {
            fs.unlinkSync(path.join(photosDir, photo));
          }
        }
        
        // Restore photos from backup
        let totalSize = 0;
        for (const [filename, photoData] of Object.entries(photos)) {
          // Handle both old format (string) and new format (object)
          let base64Data: string;
          if (typeof photoData === 'string') {
            // Old format - just base64 string
            base64Data = photoData;
          } else {
            // New format - object with data, mimetype, size
            base64Data = photoData.data;
            totalSize += photoData.size || 0;
          }
          
          const fileBuffer = Buffer.from(base64Data, 'base64');
          const filePath = path.join(photosDir, filename);
          fs.writeFileSync(filePath, fileBuffer);
          
          // Verify the photo URL in database matches the restored file
          console.log(`Restored photo: ${filename} -> ${filePath}`);
        }
        console.log(`Restored ${Object.keys(photos).length} photos (${totalSize} bytes total)`);
        
        // Verify that all borrower photo URLs have corresponding files
        const restoredPhotoFiles = fs.readdirSync(photosDir);
        console.log(`Available photo files after restore: ${restoredPhotoFiles.join(', ')}`);
        
        // Validate that all photo URLs in borrower data have corresponding files
        const missingPhotos: string[] = [];
        data.borrowers.forEach(borrower => {
          if (borrower.photoUrl) {
            const filename = borrower.photoUrl.split('/').pop();
            if (filename && !restoredPhotoFiles.includes(filename)) {
              missingPhotos.push(filename);
            }
          }
        });
        
        if (missingPhotos.length > 0) {
          console.log(`Warning: Missing photo files for URLs: ${missingPhotos.join(', ')}`);
        } else {
          console.log('All photo URLs have corresponding files ✓');
        }
      }
      
      // Users are not restored from backup for security reasons
      // Default users will be created on startup if no users exist
      console.log('Skipping user restoration (users are not backed up for security)');
      
      console.log('Restoring borrowers...');
      // Create a mapping from old IDs to new IDs
      const borrowerIdMapping = new Map();
      
      for (const borrower of data.borrowers) {
        // Ensure photoUrl is properly formatted for the new instance
        let photoUrl = borrower.photoUrl;
        if (photoUrl && !photoUrl.startsWith('/uploads/photos/')) {
          // If photoUrl doesn't have the correct path, extract filename and create proper path
          const filename = photoUrl.split('/').pop() || photoUrl.split('\\').pop();
          if (filename) {
            photoUrl = `/uploads/photos/${filename}`;
          }
        }
        
        const newBorrower = await storage.createBorrower({
          name: borrower.name,
          phone: borrower.phone,
          address: borrower.address,
          documentType: borrower.documentType,
          documentNumber: borrower.documentNumber,
          guarantorName: borrower.guarantorName,
          guarantorPhone: borrower.guarantorPhone,
          guarantorAddress: borrower.guarantorAddress,
          notes: borrower.notes,
          photoUrl: photoUrl
        });
        borrowerIdMapping.set(borrower.id, newBorrower.id);
      }
      
      console.log('Restoring loans...');
      // Restore loans using the mapped borrower IDs and create loan ID mapping
      const loanIdMapping = new Map();
      
      for (const loan of data.loans) {
        const newBorrowerId = borrowerIdMapping.get(loan.borrowerId);
        if (newBorrowerId) {
          // Create loan with all new fields
          const [newLoan] = await db.insert(loans).values({
            borrowerId: newBorrowerId,
            amount: loan.amount,
            startDate: loan.startDate,
            guarantorName: loan.guarantorName,
            guarantorPhone: loan.guarantorPhone,
            guarantorAddress: loan.guarantorAddress,
            loanStrategy: loan.loanStrategy,
            tenure: loan.tenure,
            customEmiAmount: loan.customEmiAmount,
            flatMonthlyAmount: loan.flatMonthlyAmount,
            pmType: loan.pmType,
            metalWeight: loan.metalWeight,
            purity: loan.purity,
            netWeight: loan.netWeight,
            amountPaid: loan.amountPaid,
            goldSilverNotes: loan.goldSilverNotes,
            notes: loan.notes,
            status: loan.status
          }).returning();
          loanIdMapping.set(loan.id, newLoan.id);
        }
      }
      
      console.log('Restoring payments...');
      // Restore payments using the mapped loan IDs
      for (const payment of data.payments) {
        const newLoanId = loanIdMapping.get(payment.loanId);
        if (newLoanId) {
          await storage.createPayment({
            loanId: newLoanId,
            dueDate: payment.dueDate,
            amount: payment.amount,
            status: payment.status,
            paidDate: payment.paidDate,
            paidAmount: payment.paidAmount,
            dueAmount: payment.dueAmount,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes
          });
        }
      }
      
      console.log('Data restore completed successfully');
      res.json({ 
        message: 'Data restored successfully',
        stats: {
          borrowers: data.borrowers.length,
          loans: data.loans.length,
          payments: data.payments.length,
          users: 0, // Users are not restored for security
          photos: photos ? Object.keys(photos).length : 0,
          photoSize: photos ? Object.values(photos).reduce((sum, photo) => sum + (typeof photo === 'string' ? 0 : (photo.size || 0)), 0) : 0
        }
      });
    } catch (error) {
      console.error('Restore error:', error);
      handleError(error, res);
    }
  });

  // Test route to ensure API routing works
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API routing is working' });
  });

  // Create custom payment for Custom and Gold & Silver loans
  app.post('/api/loans/:loanId/payments/custom', async (req: Request, res: Response) => {
    try {
      const loanId = parseInt(req.params.loanId);
      const { amount, dueDate, notes } = req.body;

      if (!amount || !dueDate) {
        return res.status(400).json({ error: "Amount and payment date are required" });
      }

      // Get the loan to verify it exists and is of type custom or gold_silver
      const loan = await storage.getLoanById(loanId);
      if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
      }

      if (loan.loanStrategy !== 'custom' && loan.loanStrategy !== 'gold_silver') {
        return res.status(400).json({ error: "Custom payments are only allowed for Custom and Gold & Silver loans" });
      }

      // Determine payment status based on payment date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      const paymentDate = new Date(dueDate);
      paymentDate.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
      
      let status = PaymentStatus.UPCOMING;
      let paidDate = null;
      let paidAmount = null;
      
      // If payment date is today or in the past, automatically mark as collected
      if (isBefore(paymentDate, today) || paymentDate.getTime() === today.getTime()) {
        status = PaymentStatus.COLLECTED;
        paidDate = dueDate; // Use the user-selected payment date
        paidAmount = amount;
        console.log(`Auto-marking payment as collected: payment date ${dueDate} is today or in the past`);
      }

      // Create the payment
      const payment = {
        loanId,
        dueDate,
        principal: amount,
        interest: 0,
        amount: amount,
        status,
        paidDate,
        paidAmount,
        notes: notes || ""
      };

      const createdPayment = await storage.createPayment(payment);
      console.log(`Created custom payment:`, createdPayment);

      res.setHeader('Content-Type', 'application/json');
      res.status(201).json(createdPayment);
    } catch (error) {
      console.error('Error creating custom payment:', error);
      handleError(error, res);
    }
  });

  // Add explicit Content-Type header for all API routes
  app.use('/api/*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // Bulk create payments for FLAT loans
  app.post('/api/payments/bulk/:loanId', async (req, res) => {
    try {
      const loanId = parseInt(req.params.loanId);
      
      if (isNaN(loanId)) {
        return res.status(400).json({ message: 'Invalid loan ID' });
      }
      
      const { months, customAmount, customDueDate } = req.body;
      
      if (!months || months <= 0) {
        return res.status(400).json({ message: 'Months must be a positive number' });
      }
      
      console.log(`Bulk payment creation request for loan ${loanId}: ${months} months, customAmount: ${customAmount}, customDueDate: ${customDueDate}`);
      
      const loan = await storage.getLoanById(loanId);
      if (!loan) {
        return res.status(404).json({ message: 'Loan not found' });
      }
      
      // Allow bulk payment creation for both EMI and FLAT loans
      
      // Calculate payment amount based on loan strategy
      const paymentAmount = customAmount || 
        (loan.loanStrategy === 'flat' 
          ? (loan.flatMonthlyAmount || (loan.amount / 12))
          : (loan.customEmiAmount || (loan.amount / (loan.tenure || 12))));
      const createdPayments = [];
      
      // Determine starting due date
      let nextDueDate;
      if (customDueDate) {
        // Use custom due date for partial payment scenarios
        nextDueDate = new Date(customDueDate);
      } else {
        // Get existing payments to determine the next due date
        const existingPayments = await storage.getPaymentsByLoanId(loanId);
        nextDueDate = new Date(loan.startDate);
        
        if (existingPayments.length > 0) {
          // Find the latest due date and add one month
          const latestPayment = existingPayments.sort((a, b) => 
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          )[0];
          nextDueDate = addMonths(new Date(latestPayment.dueDate), 1);
        } else {
          // Start from the next month after loan start date
          nextDueDate = addMonths(new Date(loan.startDate), 1);
        }
      }
      
      // Create the specified number of monthly payments
      for (let i = 0; i < months; i++) {
        const dueDate = customDueDate && i === 0 ? nextDueDate : addMonths(nextDueDate, i);
        const formattedDueDate = dueDate.toISOString().split('T')[0];
        
        // Determine status - if it's a partial payment (custom amount), mark as DUE_SOON
        const status = customAmount && customAmount < (loan.flatMonthlyAmount || 0) 
          ? PaymentStatus.DUE_SOON 
          : PaymentStatus.UPCOMING;
        
        const payment = {
          loanId,
          dueDate: formattedDueDate,
          principal: paymentAmount,
          interest: 0,
          amount: paymentAmount,
          status
        };
        
        const createdPayment = await storage.createPayment(payment);
        createdPayments.push(createdPayment);
      }
      
      console.log(`Successfully created ${createdPayments.length} payments for loan ${loanId}`);
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(createdPayments);
    } catch (error) {
      console.error('Error in bulk payment creation:', error);
      handleError(error, res);
    }
  });

  // Delete all data endpoint
  app.delete('/api/database/delete-all', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      const session = req.session as any;
      
      if (!password) {
        return res.status(400).json({ message: 'Admin password is required' });
      }
      
      // Get current user from database
      const currentUser = await storage.getUserById(session.userId);
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Ensure user has admin role
      if (currentUser.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: 'Admin role required for this operation' });
      }
      
      const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      
      console.log('Starting database cleanup - deleting all data...');
      
      // Delete all data using TRUNCATE CASCADE for complete cleanup and reset sequences
      await db.execute(sql.raw('TRUNCATE TABLE payments, loans, borrowers RESTART IDENTITY CASCADE'));
      console.log('All tables cleared and ID sequences reset successfully');
      
      res.status(200).json({ 
        message: 'Database cleaned successfully',
        deletedTables: ['payments', 'loans', 'borrowers'],
        sequencesReset: true
      });
    } catch (error) {
      console.error('Error deleting all data:', error);
      handleError(error, res);
    }
  });

  const httpServer = createServer(app);


  return httpServer;
}