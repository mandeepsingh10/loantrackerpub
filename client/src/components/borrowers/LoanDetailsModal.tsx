import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Eye,
  Plus,
  Edit,
  Trash2,
  Check,
  ChevronDown,
  CreditCard
} from "lucide-react";
import { Loan, Payment } from "@/types";

interface LoanDetailsModalProps {
  loan: Loan | null;
  loanNumber?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const LoanDetailsModal = ({ loan, loanNumber, isOpen, onClose }: LoanDetailsModalProps) => {
  const { toast } = useToast();

  // Payment collection dialog state
  const [collectionDialog, setCollectionDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [upiId, setUpiId] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Settlement dialog state
  const [settlementDialog, setSettlementDialog] = useState(false);
  const [settlementPayment, setSettlementPayment] = useState<Payment | null>(null);
  const [settlementDate, setSettlementDate] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);

  // Add payment dialogs state
  const [showAddSinglePayment, setShowAddSinglePayment] = useState(false);
  const [showAddBulkPayments, setShowAddBulkPayments] = useState(false);
  const [singlePaymentForm, setSinglePaymentForm] = useState({
    amount: "",
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    notes: ""
  });
  const [bulkPaymentForm, setBulkPaymentForm] = useState({
    months: 1,
    customAmount: "",
    customDueDate: format(new Date(), 'yyyy-MM-dd')
  });

  // Fetch payments for this specific loan
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments", "loan", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const response = await apiRequest("GET", `/api/payments/loan/${loan.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch payments");
      }
      const data = await response.json();
      
      // Sort payments by due date (earliest first)
      return data.sort((a: Payment, b: Payment) => {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    },
    enabled: isOpen && !!loan,
  });

  // Add single payment mutation
  const addSinglePaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/loans/${loan?.id}/payments/custom`, {
        amount: parseFloat(data.amount),
        dueDate: data.dueDate,
        notes: data.notes
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment added successfully.",
      });
      setShowAddSinglePayment(false);
      setSinglePaymentForm({
        amount: "",
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        notes: ""
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", "loan", loan?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add payment: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Add bulk payments mutation
  const addBulkPaymentsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", `/api/payments/bulk/${loan?.id}`, {
        months: data.months,
        customAmount: data.customAmount ? parseFloat(data.customAmount) : undefined,
        customDueDate: data.customDueDate
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully added ${data.length} payment(s) to the schedule.`,
      });
      setShowAddBulkPayments(false);
      setBulkPaymentForm({
        months: 1,
        customAmount: "",
        customDueDate: format(new Date(), 'yyyy-MM-dd')
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", "loan", loan?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add payments: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Collect payment mutation
  const collectPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const formattedData = {
        status: "collected",
        paidDate: data.paidDate || new Date().toISOString().split("T")[0],
        paidAmount: parseFloat(data.paidAmount),
        paymentMethod: data.paymentMethod,
        notes: data.notes || "",
      };
      
      const response = await apiRequest("POST", `/api/payments/${data.paymentId}/collect`, formattedData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment marked as collected.",
      });
      
      setCollectionDialog(false);
      setSelectedPayment(null);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
      setUpiId("");
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      
      queryClient.invalidateQueries({ queryKey: ["/api/payments", "loan", loan?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to mark payment as collected: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Settlement mutation
  const settlementMutation = useMutation({
    mutationFn: async () => {
      if (!settlementPayment || !loan) return;
      
      // Calculate the total amount to be paid (original paid amount + due amount)
      const totalPaidAmount = (settlementPayment.paidAmount || 0) + (settlementPayment.dueAmount || 0);
      
      const updateData = {
        status: 'collected',
        paidDate: settlementDate,
        paidAmount: totalPaidAmount,
        dueAmount: 0, // Clear the due amount
        paymentMethod: settlementPayment.paymentMethod || 'cash',
        notes: `Settlement: ${settlementNotes}` + (settlementPayment.notes ? ` | Original: ${settlementPayment.notes}` : '')
      };
      
      const response = await apiRequest('POST', `/api/payments/${settlementPayment.id}/collect`, updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Due Settled Successfully!",
        description: "Payment has been marked as fully settled.",
      });
      
      setSettlementDialog(false);
      setSettlementPayment(null);
      setSettlementDate("");
      setSettlementNotes("");
      
      queryClient.invalidateQueries({ queryKey: ["/api/payments", "loan", loan?.id] });
    },
    onError: (error) => {
      toast({
        title: "Settlement Failed",
        description: "Could not settle the due. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const response = await apiRequest("DELETE", `/api/payments/${paymentId}`);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Payment Deleted",
        description: "Payment has been successfully deleted.",
      });
      
      setDeleteDialog(false);
      setDeletePayment(null);
      
      queryClient.invalidateQueries({ queryKey: ["/api/payments", "loan", loan?.id] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed", 
        description: "Could not delete payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Clock className="h-5 w-5 text-blue-600" />;
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "defaulted":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
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

  const getActualPaymentStatus = (payment: Payment) => {
    if (payment.status === "collected") return "collected";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return "missed";
    } else if (dueDate.getTime() === today.getTime()) {
      return "due_today";
    } else {
      return "upcoming";
    }
  };

  const getPaymentStatusIcon = (payment: Payment) => {
    const status = getActualPaymentStatus(payment);
    switch (status) {
      case "collected":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "missed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "due_today":
        return <Clock className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getPaymentStatusColor = (payment: Payment) => {
    const status = getActualPaymentStatus(payment);
    switch (status) {
      case "collected":
        return "bg-green-100 text-green-800";
      case "missed":
        return "bg-red-100 text-red-800";
      case "due_today":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getPaymentStatusText = (payment: Payment) => {
    const status = getActualPaymentStatus(payment);
    switch (status) {
      case "collected":
        return "Collected";
      case "missed":
        return "Missed";
      case "due_today":
        return "Due Today";
      default:
        return "Upcoming";
    }
  };

  const handleCollectPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentAmount(payment.amount.toString());
    setPaymentMethod("cash");
    setPaymentNotes("");
    setUpiId("");
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setCollectionDialog(true);
  };

  const handleSubmitCollection = () => {
    if (!selectedPayment) return;
    
    const paidAmount = parseFloat(paymentAmount);
    
    // Prepare notes - include UPI ID if UPI payment method is selected
    let finalNotes = paymentNotes;
    if (paymentMethod === "upi" && upiId.trim()) {
      finalNotes = finalNotes ? `${paymentNotes}\nUPI ID: ${upiId}` : `UPI ID: ${upiId}`;
    }
    
    collectPaymentMutation.mutate({
      paymentId: selectedPayment.id,
      paidAmount: paidAmount,
      paidDate: paymentDate,
      paymentMethod,
      notes: finalNotes,
    });
  };

  const handleSettleDue = (payment: Payment) => {
    setSettlementPayment(payment);
    setSettlementDate(format(new Date(), "yyyy-MM-dd"));
    setSettlementNotes("");
    setSettlementDialog(true);
  };

  const handleSubmitSettlement = () => {
    if (!settlementPayment || !settlementDate) return;
    settlementMutation.mutate();
  };

  const handleEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentAmount(payment.paidAmount?.toString() || "");
    setPaymentMethod(payment.paymentMethod || "cash");
    setPaymentNotes(payment.notes || "");
    // Set the payment date from the existing payment's paidDate, or current date if not available
    if (payment.paidDate) {
      setPaymentDate(format(new Date(payment.paidDate), 'yyyy-MM-dd'));
    } else {
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    }
    setCollectionDialog(true);
  };

  const handleDeletePayment = (payment: Payment) => {
    setDeletePayment(payment);
    setDeleteDialog(true);
  };

  const confirmDeletePayment = () => {
    if (deletePayment) {
      deletePaymentMutation.mutate(deletePayment.id);
    }
  };

  const handleUpdateStatus = (status: string) => {
    // This function can be used to update loan status if needed
    console.log("Update status to:", status);
  };

  if (!loan) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle asChild>
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3">
                  {getStatusIcon(loan.status)}
                  <span>Payment Schedule - Loan {loanNumber || loan?.id}</span>
                </div>
                <div className="flex items-center gap-3 mr-8">
                  {(loan.loanStrategy === 'custom' || loan.loanStrategy === 'gold_silver') ? (
                    <Button 
                      size="sm"
                      onClick={() => setShowAddSinglePayment(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Payments
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowAddSinglePayment(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Single Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowAddBulkPayments(true)}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Add X Months
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-6">
            {paymentsLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-gray-500">Loading payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No payments found for this loan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Details</TableHead>
                      <TableHead>Dues</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: Payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {format(new Date(payment.dueDate), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentStatusIcon(payment)}
                            <Badge className={getPaymentStatusColor(payment)}>
                              {getPaymentStatusText(payment)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.paidAmount ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {formatCurrency(payment.paidAmount)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(payment.paidDate), "MMM d, yyyy")}
                              </div>
                              {payment.paymentMethod && (
                                <div className="text-xs text-gray-500 capitalize">
                                  {payment.paymentMethod.replace('_', ' ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">Not collected yet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.dueAmount > 0 ? (
                            <div className="text-orange-600 font-medium">
                              {formatCurrency(payment.dueAmount)}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {payment.status !== "collected" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCollectPayment(payment)}
                                  className="h-8 w-8 p-0 hover:!bg-black"
                                  title="Collect Payment"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                {(payment.dueAmount > 0 || getActualPaymentStatus(payment) === "missed") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSettleDue(payment)}
                                    className="h-8 px-2"
                                  >
                                    Settle
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditPayment(payment)}
                                className="h-8 w-8 p-0 hover:!bg-black"
                                title="Edit Payment"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePayment(payment)}
                              className="h-8 w-8 p-0 hover:!bg-black"
                              title="Delete Payment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Single Payment Dialog */}
      <Dialog open={showAddSinglePayment} onOpenChange={setShowAddSinglePayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Single Payment</DialogTitle>
            <DialogDescription>
              Add a custom payment to this loan. If the payment date is today or earlier, it will be marked as completed automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="single-amount">Payment Amount (₹)</Label>
              <Input
                id="single-amount"
                type="number"
                placeholder="Enter payment amount"
                value={singlePaymentForm.amount}
                onChange={(e) => setSinglePaymentForm({
                  ...singlePaymentForm, 
                  amount: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="single-payment-date">Payment Date</Label>
              <Input
                id="single-payment-date"
                type="date"
                value={singlePaymentForm.dueDate}
                onChange={(e) => setSinglePaymentForm({
                  ...singlePaymentForm, 
                  dueDate: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="single-notes">Notes (Optional)</Label>
              <Textarea
                id="single-notes"
                placeholder="Add any notes about this payment"
                value={singlePaymentForm.notes}
                onChange={(e) => setSinglePaymentForm({
                  ...singlePaymentForm, 
                  notes: e.target.value
                })}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (singlePaymentForm.amount && singlePaymentForm.dueDate) {
                  addSinglePaymentMutation.mutate(singlePaymentForm);
                }
              }}
              disabled={addSinglePaymentMutation.isPending || !singlePaymentForm.amount || !singlePaymentForm.dueDate}
            >
              {addSinglePaymentMutation.isPending ? "Adding..." : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bulk Payments Dialog */}
      <Dialog open={showAddBulkPayments} onOpenChange={setShowAddBulkPayments}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Multiple Payments</DialogTitle>
            <DialogDescription>
              Add multiple payments to this loan schedule. You can specify the number of months and optionally a custom amount.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-months">Number of Months</Label>
              <Input
                id="bulk-months"
                type="number"
                min="1"
                max="60"
                placeholder="Enter number of months"
                value={bulkPaymentForm.months}
                onChange={(e) => setBulkPaymentForm({
                  ...bulkPaymentForm, 
                  months: parseInt(e.target.value) || 1
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="bulk-custom-amount">Custom Amount (Optional)</Label>
              <Input
                id="bulk-custom-amount"
                type="number"
                placeholder="Leave empty to use loan's default EMI"
                value={bulkPaymentForm.customAmount}
                onChange={(e) => setBulkPaymentForm({
                  ...bulkPaymentForm, 
                  customAmount: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="bulk-start-date">Start Date</Label>
              <Input
                id="bulk-start-date"
                type="date"
                value={bulkPaymentForm.customDueDate}
                onChange={(e) => setBulkPaymentForm({
                  ...bulkPaymentForm, 
                  customDueDate: e.target.value
                })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (bulkPaymentForm.months > 0 && bulkPaymentForm.customDueDate) {
                  addBulkPaymentsMutation.mutate(bulkPaymentForm);
                }
              }}
              disabled={addBulkPaymentsMutation.isPending || bulkPaymentForm.months <= 0 || !bulkPaymentForm.customDueDate}
            >
              {addBulkPaymentsMutation.isPending ? "Adding..." : "Add Payments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Collection Dialog */}
      <Dialog open={collectionDialog} onOpenChange={setCollectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment Collection</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="amount">Amount to Pay</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount to pay"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="payment-date">Payment Date</Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="method">Payment Method</Label>
                <select
                  id="method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              {paymentMethod === "upi" && (
                <div>
                  <Label htmlFor="upiId">UPI ID</Label>
                  <Input
                    id="upiId"
                    type="text"
                    placeholder="Enter UPI ID (e.g., user@paytm)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional information"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSubmitCollection}
              disabled={collectPaymentMutation.isPending}
            >
              {collectPaymentMutation.isPending ? "Processing..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Dialog */}
      <Dialog open={settlementDialog} onOpenChange={setSettlementDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Due Payment</DialogTitle>
            <DialogDescription>
              {settlementPayment && (
                <>
                  Complete the settlement for {formatCurrency(settlementPayment.amount)} due on{" "}
                  {format(new Date(settlementPayment.dueDate), "MMM d, yyyy")}
                  <br />
                  <span className="text-red-600 font-medium mt-1 block">
                    Outstanding: {formatCurrency(settlementPayment.dueAmount || 0)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="settlement-date">Settlement Date</Label>
              <Input
                id="settlement-date"
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="settlement-notes">Notes</Label>
              <Textarea
                id="settlement-notes"
                placeholder="Add notes about the settlement (optional)"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSubmitSettlement}
              disabled={settlementMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {settlementMutation.isPending ? "Settling..." : "Settle Due"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Payment</DialogTitle>
            <DialogDescription>
              {deletePayment && (
                <>
                  Are you sure you want to permanently delete this payment?
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-sm text-gray-900">
                      <p><strong>Amount:</strong> {formatCurrency(deletePayment.amount)}</p>
                      <p><strong>Due Date:</strong> {format(new Date(deletePayment.dueDate), "MMM d, yyyy")}</p>
                      <p><strong>Status:</strong> <span className="capitalize">{deletePayment.status.replace('_', ' ')}</span></p>
                    </div>
                  </div>
                  <p className="text-red-600 font-medium mt-3">
                    ⚠️ This action cannot be undone.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={confirmDeletePayment}
              disabled={deletePaymentMutation.isPending}
              variant="destructive"
            >
              {deletePaymentMutation.isPending ? "Deleting..." : "Delete Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 