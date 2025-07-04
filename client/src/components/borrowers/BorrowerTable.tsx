import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye } from "lucide-react";
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
import { Borrower } from "@/types";
import BorrowerDetails from "./BorrowerDetails";

interface BorrowerTableProps {
  borrowers: Borrower[];
  searchQuery?: string;
}

const BorrowerTable = ({ borrowers, searchQuery = "" }: BorrowerTableProps) => {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
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

  // Fetch payments to detect defaulters
  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
  });

  // Function to check if a borrower is a defaulter (2+ consecutive missed payments)
  const isDefaulter = (borrowerId: number) => {
    if (!Array.isArray(payments)) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all payments for this borrower's loan
    const borrower = borrowers.find(b => b.id === borrowerId);
    if (!borrower || !borrower.loan || !borrower.loan.id) return false;
    
    const borrowerPayments = payments.filter((payment: any) => payment.loanId === borrower.loan!.id);
    
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

  const handleDeleteConfirm = () => {
    if (confirmDelete && deleteConfirmText.toLowerCase() === 'delete') {
      deleteMutation.mutate(confirmDelete);
      setConfirmDelete(null);
      setDeleteConfirmText("");
    }
  };

  const handleDeleteDialogClose = () => {
    setConfirmDelete(null);
    setDeleteConfirmText("");
  };

  return (
    <>
      <div className="bg-black rounded-lg shadow overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-left">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Borrower
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Guarantor
                </th>
                <th className="px-6 py-3 text-xs font-bold text-white uppercase tracking-wider">
                  Contact
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
              {borrowers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-300">
                    No borrowers found. Add your first borrower to get started.
                  </td>
                </tr>
              ) : (
                borrowers.map((borrower, index) => (
                  <tr key={borrower.id} className="hover:bg-[#111111]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-white">{borrower.id}</div>
                    </td>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {borrower.guarantorName ? highlightText(borrower.guarantorName, searchQuery) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-white">{highlightText(borrower.phone, searchQuery)}</div>
                        <div className="text-xs text-gray-300">{highlightText(borrower.address, searchQuery)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {borrower.loan ? (
                        <>
                          <div className="font-medium text-white">₹{borrower.loan.formattedAmount.toLocaleString()}</div>
                        </>
                      ) : (
                        <span className="text-gray-400">No loan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {borrower.loan ? (
                        <span className="font-medium text-white">
                          {borrower.loan.loanStrategy 
                            ? borrower.loan.loanStrategy.toUpperCase() 
                            : (borrower.loan.paymentType === 'interest_only' ? 'FLAT' : 'EMI')}
                        </span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {borrower.loan ? (
                        <span className="font-medium text-white">
                          {borrower.loan.loanStrategy === 'custom' || borrower.loan.loanStrategy === 'gold_silver'
                            ? 'NA'
                            : borrower.loan.loanStrategy === 'emi' 
                              ? `₹${(borrower.loan.customEmiAmount || 0).toLocaleString()}`
                              : `₹${(borrower.loan.flatMonthlyAmount || 0).toLocaleString()}`}
                        </span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-white">
                      {borrower.nextPayment || "-"}
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-900 px-6 py-3 flex items-center justify-between border-t border-gray-700">
          <div className="text-sm text-white/70">
            Showing <span className="font-medium text-white">1</span> to{" "}
            <span className="font-medium text-white">{borrowers.length}</span> of{" "}
            <span className="font-medium text-white">{borrowers.length}</span> results
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
    </>
  );
};

export default BorrowerTable;
