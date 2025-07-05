import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Payment } from "@/types";

interface PaymentTableProps {
  payments: Payment[];
}

const PaymentTable = ({ payments }: PaymentTableProps) => {
  const { toast } = useToast();

  const collectPaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const paidDate = new Date();
      return apiRequest("POST", `/api/payments/${paymentId}/collect`, {
        status: "collected",
        paidDate,
        paidAmount: null, // Will be set to the full amount in the backend
        paymentMethod: "Cash",
        notes: "Collected via payments table",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/upcoming-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Payment Collected",
        description: "The payment has been marked as collected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to collect payment: ${error}`,
        variant: "destructive",
      });
    },
  });

  const handleCollect = (paymentId: number) => {
    collectPaymentMutation.mutate(paymentId);
  };

  return (
    <div className="bg-black rounded-lg shadow overflow-hidden border border-gray-700">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 text-left">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                Borrower
              </th>
              <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                Principal
              </th>
              <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                Interest
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
          {payments.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-4 text-center text-gray-400">
                No payments found for the selected period.
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr 
                key={payment.id} 
                className={`hover:bg-gray-800 ${
                  payment.status === "collected" ? "bg-gray-800/50" : ""
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white mr-3">
                      <span>{payment.borrower.charAt(0)}</span>
                    </div>
                    <div className="text-white">{payment.borrower}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-white">
                  {format(new Date(payment.dueDate), "dd MMM yyyy")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                  ₹{payment.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                  ₹{payment.principal.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                  ₹{payment.interest.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    payment.status === "collected" 
                      ? "bg-green-100 text-green-800" 
                      : payment.status === "overdue"
                      ? "bg-red-100 text-red-800"
                      : payment.status === "due_soon"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {payment.status === "collected" 
                      ? "Collected" 
                      : payment.status === "overdue"
                      ? "Missed"
                      : payment.status === "due_soon"
                      ? "Due Soon"
                      : "Upcoming"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {payment.status === "collected" ? (
                    <Button variant="link" className="text-blue-400 hover:text-blue-300 text-sm font-medium h-auto p-0">
                      Receipt
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => handleCollect(payment.id)}
                      disabled={collectPaymentMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {collectPaymentMutation.isPending ? "Processing..." : "Collect"}
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <div className="bg-gray-800 px-6 py-3 flex items-center justify-between border-t border-gray-700">
      <div className="text-sm text-gray-300">
        Showing <span className="font-medium text-white">1</span> to{" "}
        <span className="font-medium text-white">{payments.length}</span> of{" "}
        <span className="font-medium text-white">{payments.length}</span> payments
      </div>
      {/* Pagination would go here in a real app with more data */}
    </div>
  </div>
  );
};

export default PaymentTable;
