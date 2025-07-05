import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Eye, ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/providers/AuthProvider";
import { Borrower, Loan } from "@/types";
import BorrowerDetails from "./BorrowerDetails";
import { LoanDetailsModal } from "./LoanDetailsModal";

interface BorrowerTableProps {
  borrowers: Borrower[];
  searchQuery?: string;
}

interface BorrowerWithLoans extends Borrower {
  loans?: Array<{
    id: number;
    amount: number;
    formattedAmount: number;
    interestRate: number | null;
    interestType: string | null;
    formattedInterest: string;
    paymentType: string | null;
    startDate: string | Date;
    tenure: number | null;
    loanStrategy: string;
    customEmiAmount: number | null;
    flatMonthlyAmount: number | null;
    status: string;
    nextPayment?: string;
    guarantorName?: string;
    guarantorPhone?: string;
    guarantorAddress?: string;
  }>;
}

const BorrowerTable = ({ borrowers, searchQuery = "" }: BorrowerTableProps) => {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteLoan, setConfirmDeleteLoan] = useState<{ borrowerId: number; loanId: number } | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedLoanNumber, setSelectedLoanNumber] = useState<number>(0);
  const [showLoanDetailsModal, setShowLoanDetailsModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [expandedBorrowers, setExpandedBorrowers] = useState<Set<number>>(new Set());
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Function to highlight search terms in text
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return <span key={index} className="bg-yellow-200 text-black font-semibold px-1 rounded">{part}</span>;
      }
      return part;
    });
  };

  // Fetch loans for all borrowers
  const { data: borrowersWithLoans = [] } = useQuery({
    queryKey: ["/api/borrowers", "with-loans"],
    queryFn: async () => {
      const borrowersWithLoansData: BorrowerWithLoans[] = [];
      
      for (const borrower of borrowers) {
        try {
          const response = await apiRequest("GET", `/api/borrowers/${borrower.id}/loans`);
          if (response.ok) {
            const loans = await response.json();
            // Sort loans by ID (oldest first) to ensure sequential numbering
            const sortedLoans = (loans || []).sort((a: any, b: any) => {
              return a.id - b.id;
            });
            borrowersWithLoansData.push({
              ...borrower,
              loans: sortedLoans
            });
          } else {
            // If no loans found, add borrower with empty loans array
            borrowersWithLoansData.push({
              ...borrower,
              loans: []
            });
          }
        } catch (error) {
          console.error(`Failed to fetch loans for borrower ${borrower.id}:`, error);
          borrowersWithLoansData.push({
            ...borrower,
            loans: []
          });
        }
      }
      
      return borrowersWithLoansData;
    },
    enabled: borrowers.length > 0
  });

  // Fetch payments to detect defaulters
  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
  });

  // Function to check if a borrower is a defaulter (2+ consecutive missed payments)
  const isDefaulter = (borrowerId: number) => {
    if (!Array.isArray(payments)) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all payments for this borrower's loans
    const borrower = borrowersWithLoans.find(b => b.id === borrowerId);
    if (!borrower || !borrower.loans || borrower.loans.length === 0) return false;
    
    const borrowerPayments = payments.filter((payment: any) => 
      borrower.loans!.some(loan => loan.id === payment.loanId)
    );
    
    // Sort payments by due date
    const sortedPayments = borrowerPayments.sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    
    let consecutiveMissed = 0;
    
    sortedPayments.forEach((payment) => {
      const dueDate = new Date(payment.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (payment.status === 'collected') {
        consecutiveMissed = 0;
      } else if (daysOverdue > 0) {
        consecutiveMissed++;
      }
    });
    
    return consecutiveMissed >= 2;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/borrowers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", "with-loans"] });
      toast({
        title: "Borrower Deleted",
        description: "The borrower has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete borrower: ${error}`,
        variant: "destructive",
      });
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await apiRequest("DELETE", `/api/loans/${loanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", "with-loans"] });
      toast({
        title: "Loan Deleted",
        description: "The loan has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete loan: ${error}`,
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (confirmDelete && deleteConfirmText.toLowerCase() === 'delete') {
      deleteMutation.mutate(confirmDelete);
      setConfirmDelete(null);
      setDeleteConfirmText("");
    }
  };

  const handleDeleteLoanConfirm = () => {
    if (confirmDeleteLoan && deleteConfirmText.toLowerCase() === 'delete') {
      deleteLoanMutation.mutate(confirmDeleteLoan.loanId);
      setConfirmDeleteLoan(null);
      setDeleteConfirmText("");
    }
  };

  const handleDeleteDialogClose = () => {
    setConfirmDelete(null);
    setConfirmDeleteLoan(null);
    setDeleteConfirmText("");
  };

  const handleViewLoan = (loan: Loan, loanNumber: number) => {
    setSelectedLoan(loan);
    setSelectedLoanNumber(loanNumber);
    setShowLoanDetailsModal(true);
  };

  const toggleBorrowerExpansion = (borrowerId: number) => {
    const newExpanded = new Set(expandedBorrowers);
    if (newExpanded.has(borrowerId)) {
      newExpanded.delete(borrowerId);
    } else {
      newExpanded.add(borrowerId);
    }
    setExpandedBorrowers(newExpanded);
  };

  const getLoanStrategyDisplay = (strategy: string) => {
    switch (strategy) {
      case "emi":
        return "EMI";
      case "flat":
        return "FLAT";
      case "custom":
        return "CUSTOM";
      case "gold_silver":
        return "GOLD/SILVER";
      default:
        return strategy.toUpperCase();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <div className="bg-black rounded-lg shadow overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-left">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Guarantor
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Loan Amount
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Loan Type
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  EMI Amount
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Next Payment
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {borrowersWithLoans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-300">
                    No borrowers found. Add your first borrower to get started.
                  </td>
                </tr>
              ) : (
                borrowersWithLoans.map((borrower) => {
                  const loans = borrower.loans || [];
                  const hasMultipleLoans = loans.length > 1;
                  const isExpanded = expandedBorrowers.has(borrower.id);
                  
                  if (loans.length === 0) {
                    // Borrower with no loans
                    return (
                  <tr key={borrower.id} className="hover:bg-[#111111]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 ${
                          isDefaulter(borrower.id) ? 'bg-red-600' : 'bg-blue-600'
                        }`}>
                          <span>{borrower.name ? borrower.name.charAt(0).toUpperCase() : '?'}</span>
                        </div>
                        <div className="font-medium text-white">
                          {highlightText(borrower.name, searchQuery)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-white">{highlightText(borrower.phone, searchQuery)}</div>
                        <div className="text-xs text-gray-300">{highlightText(borrower.address, searchQuery)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {borrower.guarantorName ? highlightText(borrower.guarantorName, searchQuery) : "-"}
                      </div>
                    </td>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                          No loans
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={borrower.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedBorrower(borrower.id)}
                        >
                          {isAdmin ? (
                            <Pencil size={16} className="text-blue-400 hover:text-blue-300" />
                          ) : (
                            <Eye size={16} className="text-blue-400 hover:text-blue-300" />
                          )}
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setConfirmDelete(borrower.id)}
                          >
                            <Trash2 size={16} className="text-red-500 hover:text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                    );
                  }

                  // Borrower with loans
                  return loans.map((loan, loanIndex) => {
                    // For single loan borrowers, show loan details directly
                    if (!hasMultipleLoans && loanIndex === 0) {
                      return (
                        <tr key={`${borrower.id}-${loan.id}`} className="hover:bg-[#111111]">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 ${
                                isDefaulter(borrower.id) ? 'bg-red-600' : 'bg-blue-600'
                              }`}>
                                <span>{borrower.name ? borrower.name.charAt(0).toUpperCase() : '?'}</span>
                              </div>
                              <div>
                                <div className="font-medium text-white">
                                  {highlightText(borrower.name, searchQuery)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="text-white">{highlightText(borrower.phone, searchQuery)}</div>
                              <div className="text-xs text-gray-300">{highlightText(borrower.address, searchQuery)}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">
                              <div className="font-medium">
                                {loan.guarantorName || borrower.guarantorName || "-"}
                              </div>
                              <div className="text-xs text-gray-300">
                                {loan.guarantorPhone || borrower.guarantorPhone || ""}
                                {loan.guarantorPhone || borrower.guarantorPhone ? <br /> : null}
                                {loan.guarantorAddress || borrower.guarantorAddress || ""}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-white">
                              {formatCurrency(loan.amount)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-white">
                              {getLoanStrategyDisplay(loan.loanStrategy)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-white">
                              {loan.loanStrategy === 'custom' || loan.loanStrategy === 'gold_silver'
                                ? 'NA'
                                : loan.loanStrategy === 'emi' 
                                  ? formatCurrency(loan.customEmiAmount || 0)
                                  : formatCurrency(loan.flatMonthlyAmount || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-white">
                            {loan.nextPayment || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <StatusBadge status={loan.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setSelectedBorrower(borrower.id)}
                              >
                                {isAdmin ? (
                                  <Pencil size={16} className="text-blue-400 hover:text-blue-300" />
                                ) : (
                                  <Eye size={16} className="text-blue-400 hover:text-blue-300" />
                                )}
                              </Button>
                              {isAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setConfirmDelete(borrower.id)}
                                >
                                  <Trash2 size={16} className="text-red-500 hover:text-red-400" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    // For multiple loan borrowers
                    // Show only the first loan by default, or all if expanded
                    const shouldShow = loanIndex === 0 || isExpanded;
                    
                    if (!shouldShow) return null;
                    
                    // For collapsed view with multiple loans, show NA in loan columns
                    const isCollapsedMultipleLoans = loanIndex === 0 && hasMultipleLoans && !isExpanded;
                    
                    return (
                      <>
                        {/* Borrower info row - only for first loan */}
                        {loanIndex === 0 && (
                          <tr key={`${borrower.id}-info`} className="hover:bg-[#111111]">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="relative mr-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleBorrowerExpansion(borrower.id)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white p-0 hover:opacity-80 ${
                                      isDefaulter(borrower.id) ? 'bg-red-600' : 'bg-blue-600'
                                    }`}
                                  >
                                    <span>{borrower.name ? borrower.name.charAt(0).toUpperCase() : '?'}</span>
                                  </Button>
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-black">{loans.length}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium text-white">
                                    {highlightText(borrower.name, searchQuery)}
                                  </div>
                                  {!isExpanded && (
                                    <div className="text-xs text-gray-400">
                                      {loans.length} loans
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm">
                                <div className="text-white">{highlightText(borrower.phone, searchQuery)}</div>
                                <div className="text-xs text-gray-300">{highlightText(borrower.address, searchQuery)}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-400"></div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-white">
                                {!isExpanded ? "" : ""}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {!isExpanded ? "" : ""}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {!isExpanded ? "" : ""}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-white">
                              {!isExpanded ? "" : ""}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {!isExpanded ? (
                                <span className="text-gray-400"></span>
                              ) : (
                                ""
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => setSelectedBorrower(borrower.id)}
                                >
                                  {isAdmin ? (
                                    <Pencil size={16} className="text-blue-400 hover:text-blue-300" />
                                  ) : (
                                    <Eye size={16} className="text-blue-400 hover:text-blue-300" />
                                  )}
                                </Button>
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setConfirmDelete(borrower.id)}
                                  >
                                    <Trash2 size={16} className="text-red-500 hover:text-red-400" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        
                        {/* Loan details row - only show when expanded */}
                        {loanIndex === 0 && isExpanded && (
                          <tr key={`${borrower.id}-${loan.id}`} className="hover:bg-[#111111]">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="ml-10 font-bold text-white">
                                • Loan {loanIndex + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-400"></div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-white">
                                <div className="font-medium">
                                  {loan.guarantorName || borrower.guarantorName || "-"}
                                </div>
                                <div className="text-xs text-gray-300">
                                  {loan.guarantorPhone || borrower.guarantorPhone || ""}
                                  {loan.guarantorPhone || borrower.guarantorPhone ? <br /> : null}
                                  {loan.guarantorAddress || borrower.guarantorAddress || ""}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-white">
                                {formatCurrency(loan.amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {getLoanStrategyDisplay(loan.loanStrategy)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {loan.loanStrategy === 'custom' || loan.loanStrategy === 'gold_silver'
                                  ? 'NA'
                                  : loan.loanStrategy === 'emi' 
                                    ? formatCurrency(loan.customEmiAmount || 0)
                                    : formatCurrency(loan.flatMonthlyAmount || 0)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-white">
                              {loan.nextPayment || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <StatusBadge status={loan.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleViewLoan(loan, loanIndex + 1)}
                                >
                                  {isAdmin ? (
                                    <Pencil size={16} className="text-blue-400 hover:text-blue-300" />
                                  ) : (
                                    <Eye size={16} className="text-blue-400 hover:text-blue-300" />
                                  )}
                                </Button>
                                {isAdmin && hasMultipleLoans && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setConfirmDeleteLoan({ borrowerId: borrower.id, loanId: loan.id })}
                                  >
                                    <Trash2 size={16} className="text-red-500 hover:text-red-400" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        
                        {/* Additional loan details rows - only show when expanded */}
                        {isExpanded && loanIndex > 0 && (
                          <tr key={`${borrower.id}-${loan.id}`} className="hover:bg-[#111111]">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="ml-10 font-bold text-white">
                                • Loan {loanIndex + 1}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-400"></div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-white">
                                <div className="font-medium">
                                  {loan.guarantorName || borrower.guarantorName || "-"}
                                </div>
                                <div className="text-xs text-gray-300">
                                  {loan.guarantorPhone || borrower.guarantorPhone || ""}
                                  {loan.guarantorPhone || borrower.guarantorPhone ? <br /> : null}
                                  {loan.guarantorAddress || borrower.guarantorAddress || ""}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-white">
                                {formatCurrency(loan.amount)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {getLoanStrategyDisplay(loan.loanStrategy)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white">
                                {loan.loanStrategy === 'custom' || loan.loanStrategy === 'gold_silver'
                                  ? 'NA'
                                  : loan.loanStrategy === 'emi' 
                                    ? formatCurrency(loan.customEmiAmount || 0)
                                    : formatCurrency(loan.flatMonthlyAmount || 0)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-white">
                              {loan.nextPayment || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <StatusBadge status={loan.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-3">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => handleViewLoan(loan, loanIndex + 1)}
                                >
                                  {isAdmin ? (
                                    <Pencil size={16} className="text-blue-400 hover:text-blue-300" />
                                  ) : (
                                    <Eye size={16} className="text-blue-400 hover:text-blue-300" />
                                  )}
                                </Button>
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setConfirmDeleteLoan({ borrowerId: borrower.id, loanId: loan.id })}
                                  >
                                    <Trash2 size={16} className="text-red-500 hover:text-red-400" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-900 px-6 py-3 flex items-center justify-between border-t border-gray-700">
          <div className="text-sm text-white/70">
            Showing <span className="font-medium text-white">1</span> to{" "}
            <span className="font-medium text-white">{borrowersWithLoans.length}</span> of{" "}
            <span className="font-medium text-white">{borrowersWithLoans.length}</span> results
          </div>
          {/* Pagination would go here in a real app with more data */}
        </div>
      </div>

      {/* Borrower Details Modal */}
      {selectedBorrower && (
        <BorrowerDetails
          borrowerId={selectedBorrower}
          isOpen={selectedBorrower !== null}
          onClose={() => setSelectedBorrower(null)}
          readOnly={!isAdmin}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmDelete !== null} onOpenChange={handleDeleteDialogClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this borrower and all associated loan data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type "delete" to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Type 'delete' to confirm"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteDialogClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className={`${
                deleteConfirmText.toLowerCase() === 'delete'
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={deleteConfirmText.toLowerCase() !== 'delete'}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Loan Confirmation Dialog */}
      <AlertDialog open={confirmDeleteLoan !== null} onOpenChange={handleDeleteDialogClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this specific loan. The borrower will remain, but this loan and all its associated payment data will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type "delete" to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Type 'delete' to confirm"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteDialogClose}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLoanConfirm} 
              className={`${
                deleteConfirmText.toLowerCase() === 'delete'
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={deleteConfirmText.toLowerCase() !== 'delete'}
            >
              Delete Loan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loan Details Modal */}
      <LoanDetailsModal
        loan={selectedLoan}
        loanNumber={selectedLoanNumber}
        isOpen={showLoanDetailsModal}
        onClose={() => setShowLoanDetailsModal(false)}
      />
    </>
  );
};

export default BorrowerTable;
