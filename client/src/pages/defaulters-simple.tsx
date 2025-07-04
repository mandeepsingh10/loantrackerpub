import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, User } from "lucide-react";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/utils";

export default function Defaulters() {
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"missed" | "defaulters">("missed");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: borrowers = [] } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <h1 className="text-3xl font-bold text-black">Defaulters</h1>
        </div>
        <div className="text-center py-10">
          <p className="text-gray-500">Loading defaulter information...</p>
        </div>
      </div>
    );
  }

  // Simple processing to find overdue payments
  const overduePayments = (payments as any[]).filter((payment: any) => {
    const dueDate = new Date(payment.dueDate);
    const today = new Date();
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysOverdue > 0 && payment.status !== 'collected';
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex space-x-4">
          <Badge variant="destructive" className="text-sm">
            0 Defaulters
          </Badge>
          <Badge variant="outline" className="text-sm border-orange-500 text-orange-600">
            {overduePayments.length} Missed Payments
          </Badge>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("missed")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "missed"
              ? "bg-gray-700 text-white shadow-sm"
              : "text-gray-300 hover:text-white"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Missed Payments ({overduePayments.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("defaulters")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "defaulters"
              ? "bg-gray-700 text-white shadow-sm"
              : "text-gray-300 hover:text-white"
          }`}
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Defaulters (0)</span>
          </div>
        </button>
      </div>

      {/* Missed Payments Section */}
      {activeTab === "missed" && (
        <Card className="bg-black border-gray-700">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-white">Missed Payments</CardTitle>
            <p className="text-gray-300">Payments that are overdue but borrower is not yet classified as defaulter</p>
          </CardHeader>
          <CardContent className="p-0">
            {overduePayments.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white">No missed payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 text-left">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                        Payment ID
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {overduePayments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap text-white">
                          #{payment.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-white">
                          {formatDate(payment.dueDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="destructive">
                            Overdue
                          </Badge>
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
        <Card className="bg-black border-gray-700">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-white">Defaulters</CardTitle>
            <p className="text-gray-300">Borrowers with 2 or more consecutive missed payments</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-white">No defaulters found</p>
              <p className="text-gray-400 text-sm mt-2">Borrowers will appear here after missing 2 consecutive payments</p>
            </div>
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