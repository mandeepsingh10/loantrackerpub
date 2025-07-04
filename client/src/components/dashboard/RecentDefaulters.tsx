import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User } from "lucide-react";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { useState } from "react";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/utils";

const RecentDefaulters = () => {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: borrowers = [], isLoading: borrowersLoading } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  const isLoading = paymentsLoading || borrowersLoading;

  // Process payments to find defaulters (borrowers with 2+ consecutive missed payments)
  const processDefaulters = () => {
    const borrowerMap = new Map((borrowers as any[]).map((b: any) => [b.id, b]));
    const defaulters: any[] = [];

    // Group payments by borrower
    const paymentsByBorrower = new Map<number, any[]>();
    (payments as any[]).forEach((payment: any) => {
      const borrowerId = payment.borrowerId;
      if (!paymentsByBorrower.has(borrowerId)) {
        paymentsByBorrower.set(borrowerId, []);
      }
      paymentsByBorrower.get(borrowerId)!.push(payment);
    });

    // Analyze each borrower's payments
    paymentsByBorrower.forEach((borrowerPayments, borrowerId) => {
      const borrower = borrowerMap.get(borrowerId);
      if (!borrower) return;

      // Sort payments by due date
      const sortedPayments = borrowerPayments.sort((a, b) => 
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      let consecutiveMissed = 0;
      let totalOutstanding = 0;

      sortedPayments.forEach((payment) => {
        const dueDate = new Date(payment.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (payment.status === 'collected') {
          consecutiveMissed = 0;
        } else if (daysOverdue > 0) {
          consecutiveMissed++;
          totalOutstanding += payment.amount;
        }
      });

      // If borrower has 2+ consecutive missed payments, they're a defaulter
      if (consecutiveMissed >= 2) {
        defaulters.push({
          id: borrowerId,
          borrowerId,
          borrowerName: borrower.name,
          phone: borrower.phone,
          consecutiveMissed,
          totalOutstanding,
          status: 'defaulter'
        });
      }
    });

    return defaulters.slice(0, 4); // Limit to 4 for dashboard display
  };

  const defaulters = processDefaulters();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Defaulters</CardTitle>
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

  return (
    <Card className="bg-black border-gray-700">
      <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-0">
        <CardTitle className="text-white">Defaulters</CardTitle>
        <Link href="/defaulters">
          <Button variant="link" className="text-blue-400 font-medium hover:text-blue-300">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {defaulters.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-900 text-left">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Missed Payments
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {defaulters.map((defaulter) => (
                  <tr key={defaulter.id} className="hover:bg-[#111111]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white mr-3">
                          <span>{defaulter.borrowerName ? defaulter.borrowerName.charAt(0) : '?'}</span>
                        </div>
                        <div className="text-white font-medium">{defaulter.borrowerName || 'Unknown'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-white">{defaulter.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="destructive">
                        {defaulter.consecutiveMissed} payments
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-white">
                      {formatCurrency(defaulter.totalOutstanding)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="destructive">
                        Defaulter
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button 
                        variant="link" 
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0"
                        onClick={() => setSelectedBorrower(defaulter.borrowerId)}
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
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white">No defaulters found</p>
                <p className="text-gray-400 text-sm mt-2">Borrowers will appear here after missing 2 consecutive payments</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      {selectedBorrower && (
        <BorrowerDetails
          borrowerId={selectedBorrower}
          isOpen={!!selectedBorrower}
          onClose={() => setSelectedBorrower(null)}
          fullScreen={true}
        />
      )}
    </Card>
  );
};

export default RecentDefaulters;