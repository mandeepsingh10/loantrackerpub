import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { 
  Plus, 
  Eye, 
  Trash2,
  DollarSign, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Loan } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/providers/AuthProvider";
import { apiRequest } from "@/lib/queryClient";

interface LoanHistoryProps {
  borrowerId: number;
  onAddLoan: () => void;
  onViewLoan: (loan: Loan, loanNumber?: number) => void;
}

export const LoanHistory = ({ borrowerId, onAddLoan, onViewLoan }: LoanHistoryProps) => {
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "all">("active");
  const [confirmDeleteLoan, setConfirmDeleteLoan] = useState<number | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Fetch all loans for this borrower
  const { data: loans = [], isLoading, error } = useQuery({
    queryKey: ["/api/borrowers", borrowerId, "loans"],
    queryFn: async () => {
      console.log("Fetching loans for borrower:", borrowerId);
      const response = await apiRequest("GET", `/api/borrowers/${borrowerId}/loans`);
      if (!response.ok) {
        throw new Error("Failed to fetch loans");
      }
      let data = await response.json();
      // Patch: ensure each loan has status and borrowerName
      data = data.map((loan: any) => ({
        ...loan,
        status: loan.status || "active",
        borrowerName: loan.borrowerName || ""
      }));
      // Sort loans by ID (oldest first) for sequential numbering
      data = data.sort((a: any, b: any) => {
        return a.id - b.id;
      });
      console.log("Loans data received:", data);
      return data;
    },
  });

  // Delete loan mutation
  const deleteLoanMutation = useMutation({
    mutationFn: async (loanId: number) => {
      await apiRequest("DELETE", `/api/loans/${loanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", borrowerId, "loans"] });
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

  // Filter loans based on active tab
  const getFilteredLoans = () => {
    switch (activeTab) {
      case "active":
        return loans.filter((loan: Loan) => loan.status === "active");
      case "completed":
        return loans.filter((loan: Loan) => loan.status === "completed");
      case "all":
        return loans;
      default:
        return loans;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "defaulted":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "defaulted":
        return <Badge className="bg-red-100 text-red-800">Defaulted</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
    }
  };

  const getLoanStrategyDisplay = (strategy: string) => {
    switch (strategy) {
      case "emi":
        return "EMI";
      case "flat":
        return "Flat";
      case "custom":
        return "Custom";
      case "gold_silver":
        return "Gold/Silver";
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

  const handleDeleteLoanConfirm = () => {
    if (confirmDeleteLoan && deleteConfirmText.toLowerCase() === 'delete') {
      deleteLoanMutation.mutate(confirmDeleteLoan);
      setConfirmDeleteLoan(null);
      setDeleteConfirmText("");
    }
  };

  const handleDeleteDialogClose = () => {
    setConfirmDeleteLoan(null);
    setDeleteConfirmText("");
  };

  const filteredLoans = getFilteredLoans();
  console.log("All loans:", loans);
  console.log("Filtered loans:", filteredLoans);
  console.log("Active tab:", activeTab);
  console.log("isAdmin:", isAdmin);

  if (error) {
    console.error("LoanHistory error:", error);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-red-500">Error loading loans: {String(error.message || error)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading loans...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Loan History</CardTitle>
        <div className="text-xs text-gray-500">Debug: isAdmin = {isAdmin ? 'true' : 'false'}</div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active ({loans.filter((l: Loan) => l.status === "active").length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({loans.filter((l: Loan) => l.status === "completed").length})</TabsTrigger>
            <TabsTrigger value="all">All ({loans.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-4">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {activeTab === "active" && "No active loans"}
                  {activeTab === "completed" && "No completed loans"}
                  {activeTab === "all" && "No loans found"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLoans.map((loan: Loan, index: number) => (
                  <div
                    key={loan.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(loan.status)}
                        <div>
                          <h3 className="font-medium">Loan {index + 1}</h3>
                          <p className="text-sm text-gray-500">
                            Started {format(new Date(loan.startDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-center">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{formatCurrency(loan.amount)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{getLoanStrategyDisplay(loan.loanStrategy)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>{loan.tenure ? `${loan.tenure} months` : 'NA'}</span>
                      </div>
                      <div className="flex items-center space-x-2 justify-between md:justify-end w-full">
                        <span className="text-gray-500">Next:</span>
                        <span className="font-medium">{loan.nextPayment}</span>
                        <span className="flex-1"></span>
                        {activeTab === "all" && getStatusBadge(loan.status)}
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewLoan(loan, index + 1)}
                            className="flex items-center"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDeleteLoan(loan.id)}
                              className="flex items-center text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

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
    </Card>
  );
}; 