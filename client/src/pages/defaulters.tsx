import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, User } from "lucide-react";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/utils";

interface MissedPayment {
  borrowerId: number;
  borrowerName: string;
  borrowerPhone: string;
  borrowerAddress: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorAddress: string;
  loanId: number;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  consecutiveMissed: number;
}

interface Defaulter {
  id: number;
  borrowerId: number;
  borrowerName: string;
  phone: string;
  totalOutstanding: number;
  consecutiveMissed: number;
  lastPaymentDate: string | null;
  missedPayments: MissedPayment[];
}

export default function Defaulters() {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"missed" | "defaulters">("missed");

  // Fetch all payments to analyze missed and defaulted ones
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: borrowers = [] } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  // Process payments to find missed payments and defaulters
  const processDefaulterData = () => {
    const missedPayments: MissedPayment[] = [];
    const defaultersMap = new Map<number, Defaulter>();
    const borrowerMap = new Map((borrowers as any[]).map((b: any) => [b.id, b]));

    // Group payments by borrower using the enhanced payment data that now includes borrower info
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
      const borrowerMissedPayments: MissedPayment[] = [];
      let lastPaymentDate: string | null = null;

      sortedPayments.forEach((payment) => {
        const dueDate = new Date(payment.dueDate);
        const today = new Date();
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (payment.status === 'collected') {
          consecutiveMissed = 0;
          lastPaymentDate = payment.paidDate;
        } else if (daysOverdue > 0 && payment.status !== 'collected') {
          // Payment is overdue
          consecutiveMissed++;
          totalOutstanding += payment.amount;

          const missedPayment: MissedPayment = {
            borrowerId,
            borrowerName: payment.borrowerName || borrower.name,
            borrowerPhone: payment.borrowerPhone || borrower.phone,
            borrowerAddress: payment.borrowerAddress || borrower.address,
            guarantorName: payment.guarantorName || borrower.guarantorName || '',
            guarantorPhone: payment.guarantorPhone || borrower.guarantorPhone || '',
            guarantorAddress: payment.guarantorAddress || borrower.guarantorAddress || '',
            loanId: payment.loanId,
            amount: payment.amount,
            dueDate: payment.dueDate,
            daysOverdue,
            consecutiveMissed
          };

          missedPayments.push(missedPayment);
          borrowerMissedPayments.push(missedPayment);
        }
      });

      // If borrower has 2+ consecutive missed payments, they're a defaulter
      if (consecutiveMissed >= 2) {
        defaultersMap.set(borrowerId, {
          id: borrowerId,
          borrowerId,
          borrowerName: borrower.name,
          phone: borrower.phone,
          totalOutstanding,
          consecutiveMissed,
          lastPaymentDate,
          missedPayments: borrowerMissedPayments
        });
      }
    });

    return {
      missedPayments: missedPayments.filter(mp => {
        // Only show missed payments that aren't from defaulters
        return !defaultersMap.has(mp.borrowerId);
      }),
      defaulters: Array.from(defaultersMap.values())
    };
  };

  const { missedPayments, defaulters } = processDefaulterData();
  
  console.log('Final missed payments data:', missedPayments);
  console.log('Final defaulters data:', defaulters);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 bg-black min-h-screen">
        <div className="text-center py-10">
          <p className="text-white/70">Loading defaulter information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-black min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <span>Defaulters</span>
          </h1>
          <p className="text-white/70 mt-2">
            Track and manage borrowers who have missed consecutive payments
          </p>
        </div>
        <div className="flex space-x-4">
          <Badge variant="destructive" className="text-sm bg-red-800 border-red-600">
            {defaulters.length} Defaulters
          </Badge>
          <Badge variant="outline" className="text-sm border-orange-500 text-orange-400 bg-black">
            {missedPayments.length} Missed Payments
          </Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-white/10 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("missed")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "missed"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/70 hover:text-white"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Missed Payments ({missedPayments.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("defaulters")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "defaulters"
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/70 hover:text-white"
          }`}
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Defaulters ({defaulters.length})</span>
          </div>
        </button>
      </div>

      {/* Missed Payments Section */}
      {activeTab === "missed" && (
        <Card className="bg-black border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Missed Payments</CardTitle>
            <p className="text-white/70">Payments that are overdue but borrower is not yet classified as defaulter</p>
          </CardHeader>
          <CardContent>
            {missedPayments.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/50">No missed payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Borrower Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Guarantor Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Days Overdue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {missedPayments.map((payment, index) => (
                      <tr key={`${payment.borrowerId}-${payment.loanId}-${index}`} className="hover:bg-white/5">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white mr-3">
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-white font-medium">{payment.borrowerName}</div>
                              <div className="text-sm text-white/70">{payment.borrowerPhone}</div>
                              <div className="text-sm text-white/50">{payment.borrowerAddress}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-white font-medium">{payment.guarantorName || 'N/A'}</div>
                            <div className="text-sm text-white/70">{payment.guarantorPhone || ''}</div>
                            <div className="text-sm text-white/50">{payment.guarantorAddress || ''}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">
                          {formatDate(payment.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="destructive">
                            {payment.daysOverdue} days
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedBorrower(payment.borrowerId)}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Defaulters Section */}
      {activeTab === "defaulters" && (
        <Card className="bg-black border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Defaulters</CardTitle>
            <p className="text-white/70">Borrowers with 2 or more consecutive missed payments</p>
          </CardHeader>
          <CardContent>
            {defaulters.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/50">No defaulters found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {defaulters.map((defaulter) => (
                  <Card key={defaulter.id} className="border-red-600/50 bg-red-900/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white">
                            <User className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{defaulter.borrowerName}</h3>
                            <p className="text-white/70">{defaulter.phone}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <Badge variant="destructive">
                                {defaulter.consecutiveMissed} missed payments
                              </Badge>
                              <span className="text-sm text-white/50">
                                Outstanding: {formatCurrency(defaulter.totalOutstanding)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setSelectedBorrower(defaulter.borrowerId)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                      
                      {defaulter.missedPayments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                          <h4 className="text-sm font-medium text-black mb-2">Missed Payments:</h4>
                          <div className="space-y-1">
                            {defaulter.missedPayments.map((payment, idx) => (
                              <div key={`${payment.borrowerId}-${payment.dueDate}-${idx}`} className="text-sm text-gray-600 flex justify-between">
                                <span>{formatDate(payment.dueDate)}</span>
                                <span>{formatCurrency(payment.amount)}</span>
                                <span className="text-red-600">{payment.daysOverdue} days overdue</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedBorrower && (
        <BorrowerDetails
          borrowerId={selectedBorrower}
          isOpen={true}
          onClose={() => setSelectedBorrower(null)}
          fullScreen={true}
        />
      )}
    </div>
  );
}