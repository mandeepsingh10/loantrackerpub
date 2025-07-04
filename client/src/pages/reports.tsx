import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Users, 
  AlertTriangle, 
  Download 
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const Reports = () => {
  const { toast } = useToast();

  const { data: borrowers = [] } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["/api/loans"],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
  });

  // Export borrowers CSV mutation
  const exportBorrowersMutation = useMutation({
    mutationFn: async () => {
      // Helper function to escape CSV values
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Generate comprehensive CSV content for all borrowers
      const borrowerData = borrowers as any[];
      const loanData = loans as any[];
      const paymentData = payments as any[];
      
      const csvHeaders = [
        'Borrower ID', 'Borrower Name', 'Phone', 'Address', 'Document Type', 'Document Number',
        'Guarantor Name', 'Guarantor Phone', 'Guarantor Address', 'Notes',
        'Loan Amount', 'Loan Strategy', 'Loan Start Date', 'Loan Duration (Months)', 
        'Monthly EMI/Payment', 'Custom EMI Amount', 'Flat Monthly Amount',
        'Total Payments Due', 'Payments Collected', 'Payments Overdue', 'Outstanding Amount'
      ].join(',') + '\n';
      
      const csvContent = borrowerData.map((borrower: any) => {
        // Get borrower's loan information
        const borrowerLoans = loanData.filter((loan: any) => loan.borrowerId === borrower.id);
        const primaryLoan = borrowerLoans[0] || {};
        
        // Get payment statistics
        const borrowerPayments = paymentData.filter((payment: any) => 
          borrowerLoans.some((loan: any) => loan.id === payment.loanId)
        );
        
        const collectedPayments = borrowerPayments.filter((p: any) => p.status === 'collected').length;
        const overduePayments = borrowerPayments.filter((p: any) => {
          const dueDate = new Date(p.dueDate);
          const today = new Date();
          return dueDate < today && p.status !== 'collected';
        }).length;
        
        const outstandingAmount = borrowerPayments
          .filter((p: any) => p.status !== 'collected')
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        
        // Calculate monthly payment amount
        const monthlyPayment = primaryLoan.loanStrategy === 'flat' 
          ? (primaryLoan.flatMonthlyAmount || (primaryLoan.amount / 12))
          : (primaryLoan.customEmiAmount || (primaryLoan.amount / (primaryLoan.tenure || 12)));
        
        return [
          escapeCSV(borrower.id),
          escapeCSV(borrower.name),
          escapeCSV(borrower.phone),
          escapeCSV(borrower.address || ''),
          escapeCSV(borrower.documentType || ''),
          escapeCSV(borrower.documentNumber || ''),
          escapeCSV(borrower.guarantorName || ''),
          escapeCSV(borrower.guarantorPhone || ''),
          escapeCSV(borrower.guarantorAddress || ''),
          escapeCSV(borrower.notes || ''),
          escapeCSV(primaryLoan.amount || ''),
          escapeCSV(primaryLoan.loanStrategy || ''),
          escapeCSV(primaryLoan.startDate || ''),
          escapeCSV(primaryLoan.tenure || ''),
          escapeCSV(Math.round(monthlyPayment) || ''),
          escapeCSV(primaryLoan.customEmiAmount || ''),
          escapeCSV(primaryLoan.flatMonthlyAmount || ''),
          escapeCSV(borrowerPayments.length),
          escapeCSV(collectedPayments),
          escapeCSV(overduePayments),
          escapeCSV(Math.round(outstandingAmount))
        ].join(',');
      }).join('\n');
      
      return csvHeaders + csvContent;
    },
    onSuccess: (csvContent) => {
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-borrowers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "All borrowers data has been exported to CSV format.",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "There was an error exporting borrowers data. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Export defaulters CSV mutation
  const exportDefaultersMutation = useMutation({
    mutationFn: async () => {
      // Helper function to escape CSV values
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Process data to find defaulters
      const borrowerData = borrowers as any[];
      const loanData = loans as any[];
      const paymentData = payments as any[];
      const defaulters: any[] = [];
      const today = new Date();

      borrowerData.forEach((borrower: any) => {
        // Get borrower's loans and payments
        const borrowerLoans = loanData.filter((loan: any) => loan.borrowerId === borrower.id);
        const borrowerPayments = paymentData.filter((payment: any) => 
          borrowerLoans.some((loan: any) => loan.id === payment.loanId)
        );

        // Check for overdue payments
        const overduePayments = borrowerPayments.filter((payment: any) => {
          const dueDate = new Date(payment.dueDate);
          return dueDate < today && payment.status !== 'collected';
        });

        // If borrower has 2+ overdue payments, they're a defaulter
        if (overduePayments.length >= 2) {
          const primaryLoan = borrowerLoans[0] || {};
          const totalOutstanding = overduePayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          const collectedPayments = borrowerPayments.filter((p: any) => p.status === 'collected');
          const lastPaymentDate = collectedPayments.length > 0 
            ? collectedPayments[collectedPayments.length - 1].paidDate || 'Never'
            : 'Never';

          // Calculate days overdue for the oldest unpaid payment
          const oldestOverdue = overduePayments.reduce((oldest: any, p: any) => {
            const pDate = new Date(p.dueDate);
            const oldestDate = new Date(oldest.dueDate);
            return pDate < oldestDate ? p : oldest;
          });
          const daysOverdue = Math.floor((today.getTime() - new Date(oldestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24));

          // Calculate monthly payment amount
          const monthlyPayment = primaryLoan.loanStrategy === 'flat' 
            ? (primaryLoan.flatMonthlyAmount || (primaryLoan.amount / 12))
            : (primaryLoan.customEmiAmount || (primaryLoan.amount / (primaryLoan.tenure || 12)));

          defaulters.push({
            borrowerId: borrower.id,
            borrowerName: borrower.name,
            borrowerPhone: borrower.phone,
            borrowerAddress: borrower.address || '',
            guarantorName: borrower.guarantorName || '',
            guarantorPhone: borrower.guarantorPhone || '',
            guarantorAddress: borrower.guarantorAddress || '',
            loanAmount: primaryLoan.amount || 0,
            loanStrategy: primaryLoan.loanStrategy || '',
            monthlyPayment: Math.round(monthlyPayment) || 0,
            startDate: primaryLoan.startDate || '',
            tenure: primaryLoan.tenure || '',
            consecutiveMissed: overduePayments.length,
            totalOutstanding: Math.round(totalOutstanding),
            daysOverdue,
            lastPaymentDate
          });
        }
      });

      // Generate comprehensive CSV content for defaulters
      const csvHeaders = [
        'Borrower ID', 'Borrower Name', 'Borrower Phone', 'Borrower Address',
        'Guarantor Name', 'Guarantor Phone', 'Guarantor Address',
        'Loan Amount', 'Loan Strategy', 'Monthly Payment', 'Loan Start Date', 'Loan Duration (Months)',
        'Consecutive Missed Payments', 'Total Outstanding Amount', 'Days Overdue', 'Last Payment Date'
      ].join(',') + '\n';
      
      const csvContent = defaulters.map((defaulter) => {
        return [
          escapeCSV(defaulter.borrowerId),
          escapeCSV(defaulter.borrowerName),
          escapeCSV(defaulter.borrowerPhone),
          escapeCSV(defaulter.borrowerAddress),
          escapeCSV(defaulter.guarantorName),
          escapeCSV(defaulter.guarantorPhone),
          escapeCSV(defaulter.guarantorAddress),
          escapeCSV(defaulter.loanAmount),
          escapeCSV(defaulter.loanStrategy),
          escapeCSV(defaulter.monthlyPayment),
          escapeCSV(defaulter.startDate),
          escapeCSV(defaulter.tenure),
          escapeCSV(defaulter.consecutiveMissed),
          escapeCSV(defaulter.totalOutstanding),
          escapeCSV(defaulter.daysOverdue),
          escapeCSV(defaulter.lastPaymentDate)
        ].join(',');
      }).join('\n');
      
      return csvHeaders + csvContent;
    },
    onSuccess: (csvContent) => {
      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defaulters-details-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Defaulters details have been exported to CSV format.",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "There was an error exporting defaulters data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleExportBorrowers = () => {
    exportBorrowersMutation.mutate();
  };

  const handleExportDefaulters = () => {
    exportDefaultersMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">

      {/* Export All Borrowers */}
      <Card className="bg-black border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Users className="h-5 w-5" />
            <span>Export All Borrowers</span>
          </CardTitle>
          <p className="text-gray-300">
            Export a complete CSV file containing all borrower information including contact details and loan status.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border border-gray-600 rounded-lg bg-black">
            <h4 className="font-medium text-white mb-2">Borrowers CSV Export</h4>
            <p className="text-sm text-gray-300 mb-4">
              Download a comprehensive CSV file with all borrower data. Perfect for external analysis or backup purposes.
            </p>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p>Total Borrowers: <span className="font-medium text-white">{(borrowers as any[]).length}</span></p>
                <p>Includes: Personal details, guarantor info, loan amounts, EMI details, payment statistics</p>
              </div>
              <Button 
                onClick={handleExportBorrowers}
                disabled={exportBorrowersMutation.isPending}
                className="flex items-center space-x-2 bg-blue-800 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4" />
                <span>
                  {exportBorrowersMutation.isPending ? "Exporting..." : "Export CSV"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Defaulters Details */}
      <Card className="bg-black border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <AlertTriangle className="h-5 w-5" />
            <span>Export Defaulters Details</span>
          </CardTitle>
          <p className="text-gray-300">
            Export detailed information about all defaulters (borrowers with 2+ consecutive missed payments).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border border-red-600 rounded-lg bg-red-900/20">
            <h4 className="font-medium text-white mb-2">Defaulters CSV Export</h4>
            <p className="text-sm text-gray-300 mb-4">
              Download a detailed CSV report of all defaulters with payment history and outstanding amounts.
            </p>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <p>Criteria: 2+ consecutive missed payments</p>
                <p>Includes: Complete borrower & guarantor details, loan info, EMI amounts, overdue statistics</p>
              </div>
              <Button 
                onClick={handleExportDefaulters}
                disabled={exportDefaultersMutation.isPending}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <Download className="h-4 w-4" />
                <span>
                  {exportDefaultersMutation.isPending ? "Exporting..." : "Export CSV"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;