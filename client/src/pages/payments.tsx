import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, CheckCircle, User, Phone, Calendar, AlertTriangle, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";
import { format } from "date-fns";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Payments = () => {
  const [activeTab, setActiveTab] = useState<"upcoming" | "collected" | "missed">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return "2025-06";
  });
  const [selectedBorrower, setSelectedBorrower] = useState<number | null>(null);
  const [showAllData, setShowAllData] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
  });

  const { data: borrowers = [] } = useQuery({
    queryKey: ["/api/borrowers"],
  });

  // Generate missed payments with borrower and guarantor details
  const getMissedPayments = () => {
    if (!Array.isArray(payments) || !Array.isArray(borrowers)) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const missedPayments: any[] = [];
    
    payments.forEach((payment: any) => {
      if (payment.status === "collected") return;
      
      const dueDate = new Date(payment.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate >= today) return; // Not overdue yet
      
      const borrower = borrowers.find((b: any) => {
        // Find borrower by matching payment's loan to borrower's loan
        return b.loan?.id === payment.loanId;
      });
      
      if (!borrower) return;
      
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      missedPayments.push({
        borrowerId: borrower.id,
        borrowerName: borrower.name,
        borrowerPhone: borrower.phone,
        borrowerAddress: borrower.address,
        guarantorName: borrower.guarantorName || 'N/A',
        guarantorPhone: borrower.guarantorPhone || 'N/A',
        guarantorAddress: borrower.guarantorAddress || 'N/A',
        amount: payment.amount,
        dueDate: payment.dueDate,
        daysOverdue: daysOverdue,
        paymentId: payment.id
      });
    });
    
    return missedPayments.sort((a, b) => b.daysOverdue - a.daysOverdue);
  };

  const missedPayments = getMissedPayments();

  const filteredPayments = Array.isArray(payments) ? payments.filter((payment: any) => {
    const matchesSearch = searchQuery === "" || 
      payment.borrower?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    
    let matchesTab = false;
    if (activeTab === "upcoming") {
      matchesTab = payment.status !== "collected";
    } else if (activeTab === "collected") {
      matchesTab = payment.status === "collected";
    } else if (activeTab === "missed") {
      // For missed tab, we'll use the separate missedPayments array
      return false;
    }
    
    // Only filter by month if showAllData is false
    let matchesMonth = true;
    if (!showAllData) {
      const paymentDate = new Date(payment.dueDate);
      const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = paymentMonth === selectedMonth;
    }
    
    return matchesSearch && matchesTab && matchesMonth;
  }) : [];

  const filteredMissedPayments = missedPayments.filter((payment: any) => {
    const matchesSearch = searchQuery === "" || 
      payment.borrowerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.borrowerPhone?.includes(searchQuery) ||
      payment.guarantorName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Only filter by month if showAllData is false
    let matchesMonth = true;
    if (!showAllData) {
      const paymentDate = new Date(payment.dueDate);
      const paymentMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      matchesMonth = paymentMonth === selectedMonth;
    }
    
    return matchesSearch && matchesMonth;
  });

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Include 6 months in the past and 6 months in the future
    for (let i = -6; i < 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, "MMMM yyyy");
      options.push({ value, label });
    }
    
    return options;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "collected":
        return <Badge className="bg-green-100 text-green-800">Collected</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case "due_soon":
        return <Badge className="bg-yellow-100 text-yellow-800">Due Soon</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-64 bg-white border-r border-gray-200 p-4 animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-black">
      <div className="w-64 bg-black border-r border-gray-700 p-4 ios-payments-table-sidebar">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Categories</h2>
        
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === "upcoming" 
                ? "bg-blue-900 text-blue-300 font-medium" 
                : "text-white hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Upcoming Payments</span>
            </div>
            <div className="text-sm text-white/70 mt-1">
              {Array.isArray(payments) ? payments.filter((p: any) => p.status !== "collected").length : 0} payments
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab("missed")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === "missed" 
                ? "bg-red-900 text-red-300 font-medium" 
                : "text-white hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Missed Payments</span>
            </div>
            <div className="text-sm text-white/70 mt-1">
              {missedPayments.length} overdue payments
            </div>
          </button>

          <button
            onClick={() => setActiveTab("collected")}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              activeTab === "collected" 
                ? "bg-green-900 text-green-300 font-medium" 
                : "text-white hover:bg-gray-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Collected Payments</span>
            </div>
            <div className="text-sm text-white/70 mt-1">
              {Array.isArray(payments) ? payments.filter((p: any) => p.status === "collected").length : 0} payments
            </div>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 bg-black">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white capitalize">
            {activeTab} Payments
          </h1>
        </div>

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Input
                type="text"
                placeholder="Search by borrower name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            </div>
            
            <div className="flex items-center space-x-4 flex-shrink-0">
              {/* Data View Toggle */}
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium whitespace-nowrap transition-colors ${
                    showAllData ? 'text-blue-400 font-semibold' : 'text-gray-500'
                  }`}>
                    All
                  </span>
                  <Switch
                    id="data-toggle"
                    checked={!showAllData}
                    onCheckedChange={(checked) => setShowAllData(!checked)}
                    className="data-toggle"
                  />
                  <span className={`text-sm font-medium whitespace-nowrap transition-colors ${
                    !showAllData ? 'text-blue-400 font-semibold' : 'text-gray-500'
                  }`}>
                    Month
                  </span>
                </div>
                {showAllData && (
                  <div className="text-xs text-gray-400">
                    Showing all payments
                  </div>
                )}
              </div>
              
              {/* Month Selector - only show when not showing all data */}
              {!showAllData && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-44 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <Card className="ios-payments-table">
          <CardContent className="p-0">
            {activeTab === "missed" ? (
              filteredMissedPayments && filteredMissedPayments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower Details</TableHead>
                      <TableHead>Guarantor Details</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMissedPayments.map((payment: any, index: number) => (
                      <TableRow key={`${payment.borrowerId}-${payment.dueDate}-${index}`}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white mr-3">
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{payment.borrowerName}</div>
                              <div className="text-sm text-gray-300 flex items-center mt-1">
                                <Phone className="h-3 w-3 mr-1" />
                                {payment.borrowerPhone}
                              </div>
                              <div className="text-sm text-gray-400 flex items-center mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {payment.borrowerAddress}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm font-medium text-white">{payment.guarantorName}</div>
                            <div className="text-sm text-gray-300 flex items-center mt-1">
                              <Phone className="h-3 w-3 mr-1" />
                              {payment.guarantorPhone}
                            </div>
                            <div className="text-sm text-gray-400 flex items-center mt-1">
                              <MapPin className="h-3 w-3 mr-1" />
                              {payment.guarantorAddress}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-white">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-white">
                          {formatDate(payment.dueDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {payment.daysOverdue} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-600 text-white hover:bg-gray-800"
                            onClick={() => setSelectedBorrower(payment.borrowerId)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No missed payments found</p>
                </div>
              )
            ) : (
              filteredPayments && filteredPayments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Contact Details</TableHead>
                      <TableHead>Loan Type</TableHead>
                      <TableHead className="w-36">Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-white">{payment.borrower || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-300">{payment.phone || "No contact"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-600 text-white">
                          {payment.loanType || "EMI"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-white">
                            {format(new Date(payment.dueDate), "MMM d, yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-white">
                          {formatCurrency(payment.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <div className="mb-2">
                  {activeTab === "upcoming" ? (
                    <Clock className="h-12 w-12 mx-auto text-gray-400" />
                  ) : (
                    <CheckCircle className="h-12 w-12 mx-auto text-gray-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-white mb-1">
                  No {activeTab} payments
                </h3>
                <p className="text-gray-400">
                  {searchQuery 
                    ? "No payments found matching your search." 
                    : `No ${activeTab} payments at this time.`
                  }
                </p>
              </div>
            )
          )}
          </CardContent>
        </Card>
      </div>

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
};

export default Payments;