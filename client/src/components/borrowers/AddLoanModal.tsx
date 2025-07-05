import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoanForm from "./LoanForm";

interface AddLoanModalProps {
  borrowerId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const AddLoanModal = ({ borrowerId, isOpen, onClose }: AddLoanModalProps) => {
  const { toast } = useToast();

  // Add loan mutation
  const loanMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending loan data to API:", data);
      const response = await apiRequest("POST", "/api/loans", data);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", borrowerId, "loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loans", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "Loan has been added successfully.",
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add loan: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Submit handler for loan form
  const onLoanSubmit = (data: any) => {
    console.log("Submitting loan data:", data);
    // Make sure the borrower ID is set
    data.borrowerId = borrowerId;
    loanMutation.mutate(data);
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-transparent">
          <DialogTitle>Add New Loan</DialogTitle>
        </DialogHeader>
        <div className="border-t border-gray-700 my-4"></div>
        
        <LoanForm 
          borrowerId={borrowerId}
          onSubmit={onLoanSubmit}
          onCancel={handleCancel}
          isSubmitting={loanMutation.isPending}
          isNewBorrower={false}
        />
      </DialogContent>
    </Dialog>
  );
}; 