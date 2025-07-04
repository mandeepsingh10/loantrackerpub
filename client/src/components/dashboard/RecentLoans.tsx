import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/ui/status-badge";
import { format } from "date-fns";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { useState } from "react";

const RecentLoans = () => {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  
  const { data: recentLoans, isLoading } = useQuery({
    queryKey: ["/api/dashboard/recent-loans"],
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
  const hasLoans = Array.isArray(recentLoans) && recentLoans.length > 0;

  return (
    <>
      <Card className="bg-black border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-0">
          <CardTitle className="text-white">Recent Loans</CardTitle>
          <Link href="/borrowers">
            <Button variant="link" className="text-blue-400 font-medium hover:text-blue-300">
              View All
            </Button>
          </Link>
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
                  {recentLoans.map((loan) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-white">₹{loan.amount ? loan.amount.toLocaleString() : '0'}</td>
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
                          // Check if nextPayment is a valid date string
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
                  ))}
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
