import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";

interface DefaulterDisplay {
  borrowerId: number;
  borrowerName: string;
  borrowerPhone: string;
  borrowerAddress: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorAddress: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

export default function Defaulters() {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);

  // Fetch all payments with borrower information
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  // Fetch borrowers to get full details
  const { data: borrowers = [] } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  // Generate defaulters (borrowers with 2+ consecutive missed payments)
  const getDefaulters = () => {
    if (!Array.isArray(payments) || !Array.isArray(borrowers)) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Group payments by borrower
    const borrowerPayments: { [key: number]: any[] } = {};
    
    payments.forEach((payment: any) => {
      if (payment.status === "collected") return;
      
      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate >= today) return; // Not overdue yet
      
      const borrower = borrowers.find((b: any) => b.loan?.id === payment.loanId);
      if (!borrower) return;
      
      if (!borrowerPayments[borrower.id]) {
        borrowerPayments[borrower.id] = [];
      }
      
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      borrowerPayments[borrower.id].push({
        ...payment,
        borrower,
        daysOverdue
      });
    });
    
    // Find borrowers with 2+ missed payments
    const defaulters: DefaulterDisplay[] = [];
    
    Object.entries(borrowerPayments).forEach(([borrowerId, payments]) => {
      if (payments.length >= 2) {
        const latestPayment = payments.sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
        const borrower = latestPayment.borrower;
        
        defaulters.push({
          borrowerId: parseInt(borrowerId),
          borrowerName: borrower.name,
          borrowerPhone: borrower.phone,
          borrowerAddress: borrower.address,
          guarantorName: borrower.guarantorName || 'N/A',
          guarantorPhone: borrower.guarantorPhone || 'N/A',
          guarantorAddress: borrower.guarantorAddress || 'N/A',
          amount: latestPayment.amount,
          dueDate: latestPayment.dueDate,
          daysOverdue: latestPayment.daysOverdue
        });
      }
    });
    
    return defaulters.sort((a, b) => b.daysOverdue - a.daysOverdue);
  };

  const defaulters = getDefaulters();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 min-h-screen bg-black">
        <div className="text-center py-10">
          <p className="text-white/50">Loading defaulter information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-black">
        <Card className="bg-black border-gray-800">
          <CardHeader>
            <p className="text-gray-400">Borrowers with multiple missed payments (2 or more)</p>
          </CardHeader>
          <CardContent>
          {defaulters.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No defaulters found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {defaulters.map((defaulter, index) => (
                <Card key={`${defaulter.borrowerId}-${index}`} className="border-red-600 bg-black">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white mr-4">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{defaulter.borrowerName}</h3>
                          <p className="text-sm text-gray-300">{defaulter.borrowerPhone}</p>
                          <p className="text-sm text-gray-400">{defaulter.borrowerAddress}</p>
                          <div className="mt-2">
                            <p className="text-sm font-medium text-white">Guarantor: {defaulter.guarantorName}</p>
                            <p className="text-sm text-gray-300">{defaulter.guarantorPhone}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="mb-2">
                          {defaulter.daysOverdue} days overdue
                        </Badge>
                        <p className="text-lg font-bold text-red-400">{formatCurrency(defaulter.amount)}</p>
                        <p className="text-sm text-gray-400">Due: {formatDate(defaulter.dueDate)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Borrower Details Modal */}
        {selectedBorrower && (
          <BorrowerDetails
            borrowerId={selectedBorrower}
            isOpen={!!selectedBorrower}
            onClose={() => setSelectedBorrower(null)}
            fullScreen={false}
            readOnly={false}
          />
        )}
    </div>
  );
}