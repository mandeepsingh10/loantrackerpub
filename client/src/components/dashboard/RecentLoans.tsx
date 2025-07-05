import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/ui/status-badge";
import { format } from "date-fns";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface LoanWithBorrower {
  id: number;
  borrowerId: number;
  borrowerName: string;
  amount: number;
  loanStrategy: string;
  status: string;
  nextPayment: string;
  createdAt: string;
}

interface BorrowerWithLoans {
  borrowerId: number;
  borrowerName: string;
  loans: LoanWithBorrower[];
}

const RecentLoans = () => {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [isAmountVisible, setIsAmountVisible] = useState(false);
  const [expandedBorrowers, setExpandedBorrowers] = useState<Set<number>>(new Set());

  const toggleAmountVisibility = () => {
    setIsAmountVisible(!isAmountVisible);
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
  
  const { data: recentLoans, isLoading } = useQuery({
    queryKey: ["/api/dashboard/recent-loans"],
  });

  // Group loans by borrower
  const groupedLoans = (recentLoans || []).reduce((acc: BorrowerWithLoans[], loan: LoanWithBorrower) => {
    const existingBorrower = acc.find(b => b.borrowerId === loan.borrowerId);
    if (existingBorrower) {
      existingBorrower.loans.push(loan);
    } else {
      acc.push({
        borrowerId: loan.borrowerId,
        borrowerName: loan.borrowerName,
        loans: [loan]
      });
    }
    return acc;
  }, []);

  // Sort loans within each borrower by ID (oldest first) for sequential numbering
  groupedLoans.forEach(borrower => {
    borrower.loans.sort((a, b) => a.id - b.id);
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Loans</CardTitle>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if we have valid loans data
  const hasLoans = groupedLoans.length > 0;

  return (
    <>
      <Card className="bg-black border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-0">
          <CardTitle className="text-white">Recent Loans</CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAmountVisibility}
              className="text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded"
              title={isAmountVisible ? "Hide amounts" : "Show amounts"}
            >
              {isAmountVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <Link href="/borrowers">
              <Button variant="link" className="text-blue-400 font-medium hover:text-blue-300">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {hasLoans ? (
              <table className="w-full">
                <thead className="bg-gray-900 text-left">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Loan Type
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Next Payment
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {groupedLoans.map((borrower) => {
                    const loans = borrower.loans;
                    const hasMultipleLoans = loans.length > 1;
                    const isExpanded = expandedBorrowers.has(borrower.borrowerId);
                    
                    return loans.map((loan, loanIndex) => {
                      // For single loan borrowers, show normally
                      if (!hasMultipleLoans) {
                        return (
                          <tr key={loan.id} className="hover:bg-[#111111]">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white mr-3 ${
                                  (loan.status || '').toLowerCase() === 'defaulter' ? 'bg-red-600' : 'bg-blue-600'
                                }`}>
                                  <span>{loan.borrowerName ? loan.borrowerName.charAt(0) : '?'}</span>
                                </div>
                                <div className="text-white font-medium">{loan.borrowerName || 'Unknown'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-white">
                              {isAmountVisible ? 
                                `₹${loan.amount ? loan.amount.toLocaleString() : '0'}` : 
                                '••••••'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-medium text-white capitalize">
                                {loan.loanStrategy ? 
                                  loan.loanStrategy.toUpperCase() : 
                                  'EMI'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <StatusBadge status={loan.status || 'unknown'} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-white">
                              {(() => {
                                if (!loan.nextPayment || 
                                    typeof loan.nextPayment !== 'string' || 
                                    loan.nextPayment === 'Invalid Date' ||
                                    loan.nextPayment === 'No payments scheduled') {
                                  return loan.nextPayment === 'No payments scheduled' ? 
                                    'No payments scheduled' : 'N/A';
                                }
                                
                                try {
                                  const date = new Date(loan.nextPayment);
                                  return isNaN(date.getTime()) ? 'N/A' : format(date, 'dd MMM yyyy');
                                } catch (e) {
                                  return 'N/A';
                                }
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button 
                                variant="link" 
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0"
                                onClick={() => setSelectedBorrower(loan.borrowerId)}
                              >
                                View Details
                              </Button>
                            </td>
                          </tr>
                        );
                      }
                      
                      // For multiple loan borrowers
                      // Show only the first loan by default, or all if expanded
                      const shouldShow = loanIndex === 0 || isExpanded;
                      
                      if (!shouldShow) return null;
                      
                      // For collapsed view with multiple loans, show empty in loan columns
                      const isCollapsedMultipleLoans = loanIndex === 0 && hasMultipleLoans && !isExpanded;
                      
                      return (
                        <>
                          {/* Borrower info row - only for first loan */}
                          {loanIndex === 0 && (
                            <tr key={`${borrower.borrowerId}-info`} className="hover:bg-[#111111]">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="relative mr-3">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleBorrowerExpansion(borrower.borrowerId)}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white p-0 hover:opacity-80 ${
                                        (loan.status || '').toLowerCase() === 'defaulter' ? 'bg-red-600' : 'bg-blue-600'
                                      }`}
                                    >
                                      <span>{loan.borrowerName ? loan.borrowerName.charAt(0) : '?'}</span>
                                    </Button>
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-bold text-black">{loans.length}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-white">
                                      {loan.borrowerName || 'Unknown'}
                                    </div>
                                    {!isExpanded && (
                                      <div className="text-xs text-gray-400">
                                        {loans.length} loans
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {!isExpanded ? "" : ""}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-medium text-white capitalize">
                                  {!isExpanded ? "" : ""}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {!isExpanded ? (
                                  <span className="text-gray-400"></span>
                                ) : (
                                  <span className="text-gray-400"></span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {!isExpanded ? "" : ""}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Button 
                                  variant="link" 
                                  className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0"
                                  onClick={() => setSelectedBorrower(loan.borrowerId)}
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          )}
                          
                          {/* Loan details row - only show when expanded */}
                          {loanIndex === 0 && isExpanded && (
                            <tr key={`${borrower.borrowerId}-${loan.id}`} className="hover:bg-[#111111]">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="ml-10 font-bold text-white">
                                  • Loan {loanIndex + 1}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {isAmountVisible ? 
                                  `₹${loan.amount ? loan.amount.toLocaleString() : '0'}` : 
                                  '••••••'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-medium text-white capitalize">
                                  {loan.loanStrategy ? 
                                    loan.loanStrategy.toUpperCase() : 
                                    'EMI'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <StatusBadge status={loan.status || 'unknown'} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {(() => {
                                  if (!loan.nextPayment || 
                                      typeof loan.nextPayment !== 'string' || 
                                      loan.nextPayment === 'Invalid Date' ||
                                      loan.nextPayment === 'No payments scheduled') {
                                    return loan.nextPayment === 'No payments scheduled' ? 
                                      'No payments scheduled' : 'N/A';
                                  }
                                  
                                  try {
                                    const date = new Date(loan.nextPayment);
                                    return isNaN(date.getTime()) ? 'N/A' : format(date, 'dd MMM yyyy');
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Button 
                                  variant="link" 
                                  className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0"
                                  onClick={() => setSelectedBorrower(loan.borrowerId)}
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          )}
                          
                          {/* Additional loan details rows - only show when expanded */}
                          {isExpanded && loanIndex > 0 && (
                            <tr key={`${borrower.borrowerId}-${loan.id}`} className="hover:bg-[#111111]">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="ml-10 font-bold text-white">
                                  • Loan {loanIndex + 1}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {isAmountVisible ? 
                                  `₹${loan.amount ? loan.amount.toLocaleString() : '0'}` : 
                                  '••••••'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-medium text-white capitalize">
                                  {loan.loanStrategy ? 
                                    loan.loanStrategy.toUpperCase() : 
                                    'EMI'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <StatusBadge status={loan.status || 'unknown'} />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-white">
                                {(() => {
                                  if (!loan.nextPayment || 
                                      typeof loan.nextPayment !== 'string' || 
                                      loan.nextPayment === 'Invalid Date' ||
                                      loan.nextPayment === 'No payments scheduled') {
                                    return loan.nextPayment === 'No payments scheduled' ? 
                                      'No payments scheduled' : 'N/A';
                                  }
                                  
                                  try {
                                    const date = new Date(loan.nextPayment);
                                    return isNaN(date.getTime()) ? 'N/A' : format(date, 'dd MMM yyyy');
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Button 
                                  variant="link" 
                                  className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0"
                                  onClick={() => setSelectedBorrower(loan.borrowerId)}
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    });
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex justify-center items-center h-40 text-slate-400">
                <div className="text-center">
                  <p>No recent loans found</p>
                  <Link href="/borrowers">
                    <Button variant="link" className="mt-2">
                      Add a new loan
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedBorrower && (
        <BorrowerDetails
          borrowerId={selectedBorrower}
          isOpen={!!selectedBorrower}
          onClose={() => setSelectedBorrower(null)}
          fullScreen={true}
        />
      )}
    </>
  );
};

export default RecentLoans;
