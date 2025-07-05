import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Eye, 
  DollarSign, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Loan } from "@/types";

interface LoanHistoryProps {
  borrowerId: number;
  onAddLoan: () => void;
  onViewLoan: (loan: Loan) => void;
}

export const LoanHistory = ({ borrowerId, onAddLoan, onViewLoan }: LoanHistoryProps) => {
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "all">("active");

  // Fetch all loans for this borrower
  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["/api/borrowers", borrowerId, "loans"],
    queryFn: async () => {
      console.log("Fetching loans for borrower:", borrowerId);
      const response = await apiRequest("GET", `/api/borrowers/${borrowerId}/loans`);
      if (!response.ok) {
        throw new Error("Failed to fetch loans");
      }
      const data = await response.json();
      console.log("Loans data received:", data);
      return data;
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

  const filteredLoans = getFilteredLoans();
  console.log("All loans:", loans);
  console.log("Filtered loans:", filteredLoans);
  console.log("Active tab:", activeTab);

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
                {filteredLoans.map((loan: Loan) => (
                  <div
                    key={loan.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(loan.status)}
                        <div>
                          <h3 className="font-medium">Loan #{loan.id}</h3>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewLoan(loan)}
                          className="flex items-center ml-2"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}; 