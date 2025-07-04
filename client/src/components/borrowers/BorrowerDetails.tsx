import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, AlertCircle, Clock, Check, ChevronDown, Edit, Trash2, Save, X } from "lucide-react";
import { Payment } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

interface BorrowerDetailsProps {
  borrowerId: number;
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  readOnly?: boolean;
}

export const BorrowerDetails = ({ borrowerId, isOpen, onClose, fullScreen = false, readOnly = false }: BorrowerDetailsProps) => {
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [collectionDialog, setCollectionDialog] = useState(false);
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

  // Edit mode states
  const [editPersonalInfo, setEditPersonalInfo] = useState(false);
  const [editGuarantorInfo, setEditGuarantorInfo] = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState("");
  
  // Form data for editing
  const [personalForm, setPersonalForm] = useState({
    name: "",
    phone: "",
    address: "",
    documentType: "",
    documentNumber: "",
  });
  
  const [guarantorForm, setGuarantorForm] = useState({
    guarantorName: "",
    guarantorPhone: "",
    guarantorAddress: "",
  });

  // Custom payment dialog state for Custom and Gold & Silver loans
  const [showCustomPaymentDialog, setShowCustomPaymentDialog] = useState(false);
  const [customPaymentForm, setCustomPaymentForm] = useState({
    amount: "",
    dueDate: "",
    notes: ""
  });

  // Fetch borrower details
  const { data: borrower, isLoading: borrowerLoading } = useQuery({
    queryKey: ["/api/borrowers", borrowerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/borrowers/${borrowerId}`);
      const data = await res.json();
      console.log("Borrower data:", data);
      return data;
    },
    enabled: isOpen && borrowerId > 0,
  });

  // Fetch loan details
  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ["/api/loans", borrowerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/loans/borrower/${borrowerId}`);
      const data = await res.json();
      console.log("Loan data:", data);
      return data;
    },
    enabled: isOpen && borrowerId > 0,
  });

  // Fetch payment schedule
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments", borrowerId, loans],
    queryFn: async () => {
      // If we have loans, get payments for the first loan
      if (loans && loans.length > 0) {
        console.log("Fetching payments for loan:", loans[0].id);
        const res = await apiRequest("GET", `/api/payments/loan/${loans[0].id}`);
        const data = await res.json();
        console.log("Payment data:", data);
        
        // Deduplicate payments by due date to avoid showing duplicates
        const uniquePayments: Payment[] = [];
        const seenDueDates = new Set<string>();
        
        data.forEach((payment: Payment) => {
          // Create a key based on due date and status to avoid duplicates
          const key = `${payment.dueDate}_${payment.status}`;
          // Only add the payment if we haven't seen this due date before
          if (!seenDueDates.has(key)) {
            seenDueDates.add(key);
            uniquePayments.push(payment);
          }
        });
        
        // Sort payments by due date (earliest first)
        return uniquePayments.sort((a: Payment, b: Payment) => {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
      }
      console.log("No loans found for borrower:", borrowerId);
      return [];
    },
    enabled: isOpen && borrowerId > 0 && loans !== undefined,
  });

  // Initialize form data when borrower data loads
  useEffect(() => {
    if (borrower) {
      setPersonalForm({
        name: borrower.name || "",
        phone: borrower.phone || "",
        address: borrower.address || "",
        documentType: borrower.documentType || "",
        documentNumber: borrower.documentNumber || "",
      });
      setGuarantorForm({
        guarantorName: borrower.guarantorName || "",
        guarantorPhone: borrower.guarantorPhone || "",
        guarantorAddress: borrower.guarantorAddress || "",
      });
      setNotes(borrower.notes || "");
    }
  }, [borrower]);

  // Update borrower mutation
  const updateBorrowerMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Frontend sending update data:", data);
      // Exclude document number from the update data to keep it protected
      const { documentNumber, ...updateData } = data;
      const response = await apiRequest("PUT", `/api/borrowers/${borrowerId}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Borrower information updated successfully.",
      });
      setEditPersonalInfo(false);
      setEditGuarantorInfo(false);
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update borrower: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Dedicated notes update mutation
  const notesUpdateMutation = useMutation({
    mutationFn: async (data: { notes: string }) => {
      const response = await apiRequest("PUT", `/api/borrowers/${borrowerId}`, data);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notes updated successfully.",
      });
      setEditNotes(false);
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update notes: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Mark payment as collected mutation
  const collectPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      // Format the data properly according to the expected schema
      const formattedData = {
        status: "collected",
        paidDate: new Date().toISOString().split("T")[0], // String format yyyy-mm-dd
        paidAmount: parseFloat(data.paidAmount),
        paymentMethod: data.paymentMethod,
        notes: data.notes || "",
      };
      
      console.log(`Submitting payment collection:`, formattedData);
      
      const response = await apiRequest(
        "POST", 
        `/api/payments/${data.paymentId}/collect`, 
        formattedData
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment marked as collected.",
      });
      
      // Close dialog and reset form
      setCollectionDialog(false);
      setSelectedPayment(null);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
      setUpiId("");
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/upcoming-payments"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to mark payment as collected: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Custom payment creation mutation for Custom and Gold & Silver loans
  const createCustomPaymentMutation = useMutation({
    mutationFn: async ({ loanId, amount, dueDate, notes }: {
      loanId: number;
      amount: number;
      dueDate: string;
      notes?: string;
    }) => {
      const response = await apiRequest("POST", `/api/loans/${loanId}/payments/custom`, {
        amount,
        dueDate,
        notes: notes || ""
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      if (!responseText) {
        return null;
      }

      try {
        return JSON.parse(responseText);
      } catch (error) {
        console.error("Failed to parse response:", responseText);
        throw new Error("Invalid response format");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payment added successfully.",
      });
      
      setShowCustomPaymentDialog(false);
      setCustomPaymentForm({ amount: "", dueDate: "", notes: "" });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add payment: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Bulk create payments mutation
  const bulkCreatePaymentsMutation = useMutation({
    mutationFn: async ({ loanId, months, customAmount, customDueDate }: { 
      loanId: number; 
      months: number; 
      customAmount?: number; 
      customDueDate?: string; 
    }) => {
      try {
        const response = await apiRequest("POST", `/api/payments/bulk/${loanId}`, { 
          months, 
          customAmount, 
          customDueDate 
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        console.log("Raw response:", responseText);
        
        if (!responseText) {
          return []; // Return empty array for empty response
        }
        
        const data = JSON.parse(responseText);
        return data;
      } catch (error) {
        console.error("Bulk payment error details:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Bulk payment creation successful:", data);
      toast({
        title: "Success",
        description: `Successfully added ${data.length} payment(s) to the schedule.`,
      });
      
      // Invalidate relevant queries to refresh the payment list
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    },
    onError: (error) => {
      console.error("Bulk payment creation error:", error);
      toast({
        title: "Error",
        description: `Failed to create payments: ${error.message || error}`,
        variant: "destructive",
      });
    },
  });

  // Reset selected payment when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPayment(null);
    }
  }, [isOpen]);

  // Function to get the loan strategy display name
  const getLoanStrategyDisplay = (loan: any): string => {
    // First check the loanStrategy property (new approach)
    if (loan.loanStrategy) {
      return loan.loanStrategy.toUpperCase();
    }
    
    // Fall back to checking paymentType or interestType for backward compatibility
    if (loan.paymentType === "interest_only" || loan.interestType === "flat") {
      return "FLAT";
    }
    
    // Default to EMI
    return "EMI";
  };

  // Open payment collection dialog
  const handleCollectPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentAmount(payment.amount.toString());
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setCollectionDialog(true);
  };

  // Handle payment collection form submission
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
    
    // No automatic due entry creation - user will handle settlement manually
  };

  // Handle settlement dialog
  const handleSettleDue = (payment: Payment) => {
    setSettlementPayment(payment);
    setSettlementDate(format(new Date(), "yyyy-MM-dd"));
    setSettlementNotes("");
    setSettlementDialog(true);
  };

  // Settlement mutation
  const settlementMutation = useMutation({
    mutationFn: async () => {
      if (!settlementPayment || !loans || loans.length === 0) return;
      
      // Calculate the expected full amount based on loan strategy
      const expectedAmount = loans[0]?.loanStrategy === 'flat' 
        ? (loans[0]?.flatMonthlyAmount || 0)
        : (loans[0]?.customEmiAmount || settlementPayment.amount);
      
      const newPaidAmount = expectedAmount; // Complete the full payment
      
      const updateData = {
        status: 'collected',
        paidDate: settlementDate,
        paidAmount: newPaidAmount,
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
      
      // Close dialog and reset form
      setSettlementDialog(false);
      setSettlementPayment(null);
      setSettlementDate("");
      setSettlementNotes("");
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments", borrowerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
    },
    onError: (error) => {
      toast({
        title: "Settlement Failed",
        description: "Could not settle the due. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitSettlement = () => {
    if (!settlementDate) {
      toast({
        title: "Date Required",
        description: "Please select a settlement date.",
        variant: "destructive",
      });
      return;
    }
    
    settlementMutation.mutate();
  };

  // Handle edit payment
  const handleEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentAmount(payment.paidAmount?.toString() || "");
    setPaymentMethod(payment.paymentMethod || "cash");
    setPaymentNotes(payment.notes || "");
    setCollectionDialog(true);
  };

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      try {
        const response = await apiRequest("DELETE", `/api/payments/${paymentId}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        // Don't try to parse JSON if response might be empty
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        }
        
        return { success: true };
      } catch (error) {
        console.error("Delete payment API error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Payment Deleted",
        description: "Payment has been successfully deleted.",
      });
      
      // Force refresh all payment-related queries with exact matches
      queryClient.invalidateQueries({ queryKey: ["/api/payments"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], exact: false });
      
      // Force refetch all queries immediately
      queryClient.refetchQueries({ queryKey: ["/api/payments"], exact: false });
      queryClient.refetchQueries({ queryKey: ["/api/borrowers"], exact: false });
    },
    onError: (error) => {
      console.error("Delete payment mutation error:", error);
      toast({
        title: "Delete Failed", 
        description: "Could not delete payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle delete payment with custom dialog
  const handleDeletePayment = (payment: Payment) => {
    setDeletePayment(payment);
    setDeleteDialog(true);
  };

  // Confirm delete payment
  const confirmDeletePayment = () => {
    if (deletePayment) {
      deletePaymentMutation.mutate(deletePayment.id);
      setDeleteDialog(false);
      setDeletePayment(null);
    }
  };

  // Function to determine actual payment status based on due date and collection status
  const getActualPaymentStatus = (payment: Payment) => {
    if (payment.status === "collected") {
      return "collected";
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(payment.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return "missed"; // Payment is overdue and not collected
    } else if (dueDate.getTime() === today.getTime()) {
      return "due_today";
    } else {
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 3) {
        return "due_soon";
      }
      return "upcoming";
    }
  };

  // Status helper functions
  const getStatusIcon = (payment: Payment) => {
    const actualStatus = getActualPaymentStatus(payment);
    switch (actualStatus) {
      case "collected":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "missed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "due_today":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case "due_soon":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (payment: Payment) => {
    const actualStatus = getActualPaymentStatus(payment);
    switch (actualStatus) {
      case "collected":
        return "bg-green-100 text-green-800";
      case "missed":
        return "bg-red-100 text-red-800";
      case "due_today":
        return "bg-orange-100 text-orange-800";
      case "due_soon":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusText = (payment: Payment) => {
    const actualStatus = getActualPaymentStatus(payment);
    switch (actualStatus) {
      case "collected":
        return "Collected";
      case "missed":
        return "Missed";
      case "due_today":
        return "Due Today";
      case "due_soon":
        return "Due Soon";
      default:
        return "Upcoming";
    }
  };

  // Loading state
  const isLoading = borrowerLoading || loansLoading || paymentsLoading;
  
  // No data state
  if (!isLoading && (!borrower)) {
    const noDataContent = (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-300">No data available for this borrower</p>
      </div>
    );

    if (fullScreen) {
      return noDataContent;
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Borrower Details</DialogTitle>
          </DialogHeader>
          {noDataContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95vw] max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] bg-black border-gray-700">
          <DialogHeader className="bg-gray-900 -m-6 mb-6 p-6 border-b border-gray-700">
            <DialogTitle className="text-xl text-white">
              {borrower ? borrower.name : "Borrower Details"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(95vh-120px)] text-white p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-gray-300">Loading...</p>
              </div>
            ) : (
              <div className="space-y-4">
              {/* Borrower Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditPersonalInfo(!editPersonalInfo)}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                    >
                      {editPersonalInfo ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {editPersonalInfo ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Name</label>
                          <input
                            type="text"
                            value={personalForm.name}
                            onChange={(e) => setPersonalForm({...personalForm, name: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Phone</label>
                          <input
                            type="text"
                            value={personalForm.phone}
                            onChange={(e) => setPersonalForm({...personalForm, phone: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Address</label>
                          <textarea
                            value={personalForm.address}
                            onChange={(e) => setPersonalForm({...personalForm, address: e.target.value})}
                            rows={3}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Document Type</label>
                          <select
                            value={personalForm.documentType}
                            onChange={(e) => setPersonalForm({...personalForm, documentType: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Document Type</option>
                            <option value="aadhaar">Aadhaar Card</option>
                            <option value="pan">PAN Card</option>
                            <option value="voter">Voter ID</option>
                            <option value="driving">Driving License</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Document Number</label>
                          <input
                            type="text"
                            value={personalForm.documentNumber || ''}
                            onChange={(e) => setPersonalForm({...personalForm, documentNumber: e.target.value})}
                            placeholder="Enter document number"
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditPersonalInfo(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateBorrowerMutation.mutate({
                              name: personalForm.name,
                              phone: personalForm.phone,
                              address: personalForm.address,
                              documentType: personalForm.documentType,
                              documentNumber: personalForm.documentNumber
                            })}
                            disabled={updateBorrowerMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <dl className="space-y-2 text-sm font-mono">
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Name:</dt>
                          <dd className="text-white">{borrower.name}</dd>
                        </div>
                        
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Phone:</dt>
                          <dd className="text-white">{borrower.phone}</dd>
                        </div>
                        
                        <div className="flex">
                          <dt className="text-gray-400 w-32">ID Number:</dt>
                          <dd className="text-white">{borrower.id}</dd>
                        </div>
                        
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Address:</dt>
                          <dd className="text-white">{borrower.address}</dd>
                        </div>
                        
                        {borrower.documentType && (
                          <div className="flex">
                            <dt className="text-gray-400 w-32">Document Type:</dt>
                            <dd className="text-white capitalize">{borrower.documentType}</dd>
                          </div>
                        )}
                        
                        {borrower.documentNumber && (
                          <div className="flex">
                            <dt className="text-gray-400 w-32">Document Number:</dt>
                            <dd className="text-white">{borrower.documentNumber}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-lg">Guarantor Details</CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditGuarantorInfo(!editGuarantorInfo)}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                    >
                      {editGuarantorInfo ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {editGuarantorInfo ? (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Guarantor Name</label>
                          <input
                            type="text"
                            value={guarantorForm.guarantorName}
                            onChange={(e) => setGuarantorForm({...guarantorForm, guarantorName: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter guarantor name"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Guarantor Phone</label>
                          <input
                            type="text"
                            value={guarantorForm.guarantorPhone}
                            onChange={(e) => setGuarantorForm({...guarantorForm, guarantorPhone: e.target.value})}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter guarantor phone"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Guarantor Address</label>
                          <textarea
                            value={guarantorForm.guarantorAddress}
                            onChange={(e) => setGuarantorForm({...guarantorForm, guarantorAddress: e.target.value})}
                            rows={3}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter guarantor address"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditGuarantorInfo(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateBorrowerMutation.mutate({
                              guarantorName: guarantorForm.guarantorName,
                              guarantorPhone: guarantorForm.guarantorPhone,
                              guarantorAddress: guarantorForm.guarantorAddress
                            })}
                            disabled={updateBorrowerMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      borrower.guarantorName ? (
                        <dl className="grid grid-cols-4 gap-3 text-sm">
                          <dt className="col-span-1 font-medium text-gray-500">Name:</dt>
                          <dd className="col-span-3">{borrower.guarantorName}</dd>
                          
                          {borrower.guarantorPhone && (
                            <>
                              <dt className="col-span-1 font-medium text-gray-500">Phone:</dt>
                              <dd className="col-span-3">{borrower.guarantorPhone}</dd>
                            </>
                          )}
                          
                          {borrower.guarantorAddress && (
                            <>
                              <dt className="col-span-1 font-medium text-gray-500">Address:</dt>
                              <dd className="col-span-3">{borrower.guarantorAddress}</dd>
                            </>
                          )}
                        </dl>
                      ) : (
                        <p className="text-gray-500 text-sm">No guarantor information available</p>
                      )
                    )}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Loan Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loans && loans.length > 0 ? (
                      <dl className="space-y-2 text-sm font-mono">
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Loan Amount:</dt>
                          <dd className="text-white">{formatCurrency(loans[0].amount)}</dd>
                        </div>
                        
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Loan Type:</dt>
                          <dd className="text-white font-medium">
                            {loans[0]?.loanStrategy?.toUpperCase() || 'EMI'}
                          </dd>
                        </div>
                        
                        <div className="flex">
                          <dt className="text-gray-400 w-32">Start Date:</dt>
                          <dd className="text-white">
                            {format(new Date(loans[0].startDate), "MMM d, yyyy")}
                          </dd>
                        </div>

                        {loans[0].loanStrategy === "emi" && (
                          <>
                            <div className="flex">
                              <dt className="text-gray-400 w-32">Tenure:</dt>
                              <dd className="text-white">{loans[0].tenure || 0} months</dd>
                            </div>
                            
                            <div className="flex">
                              <dt className="text-gray-400 w-32">EMI Amount:</dt>
                              <dd className="text-white">
                                {formatCurrency(loans[0].customEmiAmount || 0)}
                              </dd>
                            </div>
                          </>
                        )}
                        
                        {loans[0].loanStrategy === "flat" && (
                          <div className="flex">
                            <dt className="text-gray-400 w-32">Monthly Amount:</dt>
                            <dd className="text-white">
                              {formatCurrency(loans[0].flatMonthlyAmount || 0)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <div className="p-4 text-gray-500 text-center">
                        No loan information available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Notes Card */}
              <Card className="bg-black border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-bold text-white">Notes</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditNotes(!editNotes)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {editNotes ? (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Add notes about this borrower..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white min-h-[120px]"
                        rows={5}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditNotes(false);
                            setNotes(borrower?.notes || "");
                          }}
                          className="border-gray-600 text-gray-400 hover:text-white"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            console.log("Saving notes:", notes);
                            notesUpdateMutation.mutate({ notes });
                          }}
                          disabled={notesUpdateMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[80px]">
                      {notes ? (
                        <p className="text-white text-sm whitespace-pre-wrap">{notes}</p>
                      ) : (
                        <p className="text-gray-500 text-sm italic">No notes added yet. Click the edit button to add notes.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />
              
              {/* Payment Schedule */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium">Payment Schedule</h3>
                  
                  {/* Add Payment options for all loans */}
                  {loans && loans.length > 0 && (
                    <>
                      {/* Show custom payment button for Custom and Gold & Silver loans */}
                      {(loans[0].loanStrategy === 'custom' || loans[0].loanStrategy === 'gold_silver') ? (
                        <Button 
                          size="sm" 
                          className="flex items-center"
                          onClick={() => setShowCustomPaymentDialog(true)}
                        >
                          + Add Payment
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" className="flex items-center">
                              <span className="mr-1">+ Add Payment</span>
                              <ChevronDown size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => bulkCreatePaymentsMutation.mutate({ loanId: loans[0].id, months: 1 })}
                            >
                              Add Single Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => bulkCreatePaymentsMutation.mutate({ loanId: loans[0].id, months: 3 })}
                            >
                              Add 3 Months
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => bulkCreatePaymentsMutation.mutate({ loanId: loans[0].id, months: 6 })}
                            >
                              Add 6 Months
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => bulkCreatePaymentsMutation.mutate({ loanId: loans[0].id, months: 9 })}
                            >
                              Add 9 Months
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => bulkCreatePaymentsMutation.mutate({ loanId: loans[0].id, months: 12 })}
                            >
                              Add 12 Months
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </>
                  )}
                </div>
                
                {loans && loans.length > 0 ? (
                  payments && payments.length > 0 ? (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Payment Details</TableHead>
                            <TableHead>Dues</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment: Payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {format(new Date(payment.dueDate), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{formatCurrency(payment.amount)}</TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-1">
                                  {(() => {
                                    if (payment.status === "collected") {
                                      return <CheckCircle className="h-4 w-4 text-green-600" />;
                                    }
                                    
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(payment.dueDate);
                                    dueDate.setHours(0, 0, 0, 0);
                                    
                                    if (dueDate < today) {
                                      return <AlertCircle className="h-4 w-4 text-red-600" />;
                                    } else {
                                      return <Clock className="h-4 w-4 text-blue-600" />;
                                    }
                                  })()}
                                  <Badge variant="outline" className={(() => {
                                    if (payment.status === "collected") {
                                      return "bg-green-100 text-green-800";
                                    }
                                    
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dueDate = new Date(payment.dueDate);
                                    dueDate.setHours(0, 0, 0, 0);
                                    
                                    if (dueDate < today) {
                                      return "bg-red-100 text-red-800";
                                    } else {
                                      return "bg-blue-100 text-blue-800";
                                    }
                                  })()}>
                                    {(() => {
                                      if (payment.status === "collected") {
                                        return "Collected";
                                      }
                                      
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      const dueDate = new Date(payment.dueDate);
                                      dueDate.setHours(0, 0, 0, 0);
                                      
                                      if (dueDate < today) {
                                        return "Missed";
                                      } else {
                                        return "Upcoming";
                                      }
                                    })()}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                {payment.status === "collected" ? (
                                  <div className="text-sm">
                                    <div>
                                      <span className="font-medium">Paid:</span>{" "}
                                      {payment.paidDate && format(new Date(payment.paidDate), "MMM d, yyyy")}
                                    </div>
                                    <div>
                                      <span className="font-medium">Amount:</span>{" "}
                                      {formatCurrency(payment.paidAmount || 0)}
                                    </div>
                                    {payment.paymentMethod && (
                                      <div className="capitalize">
                                        <span className="font-medium">Method:</span>{" "}
                                        {payment.paymentMethod}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-sm">Not collected yet</span>
                                )}
                              </TableCell>
                              
                              {/* Dues column for all loans */}
                              <TableCell>
                                {payment.status === "collected" && payment.paidAmount !== null ? (
                                  (() => {
                                    // Get expected amount based on loan strategy
                                    const expectedAmount = loans[0]?.loanStrategy === 'flat' 
                                      ? (loans[0]?.flatMonthlyAmount || 0)
                                      : (loans[0]?.customEmiAmount || payment.amount);
                                    const paidAmount = payment.paidAmount || 0;
                                    const difference = paidAmount - expectedAmount;
                                    
                                    if (difference === 0) {
                                      return <span className="text-gray-600">No dues</span>;
                                    } else if (difference < 0) {
                                      return (
                                        <span className="text-red-600 font-medium">
                                          {formatCurrency(Math.abs(difference))} due
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-green-600 font-medium">
                                          {formatCurrency(difference)} excess
                                        </span>
                                      );
                                    }
                                  })()
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  {payment.status !== "collected" && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 hover:bg-black hover:text-white"
                                            onClick={() => handleCollectPayment(payment)}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Mark as collected</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  
                                  {/* Show Settle button for payments with dues (all loan types) */}
                                  {payment.status === "collected" && 
                                   payment.paidAmount !== null && 
                                   (() => {
                                     const expectedAmount = loans[0]?.loanStrategy === 'flat' 
                                       ? (loans[0]?.flatMonthlyAmount || 0)
                                       : (loans[0]?.customEmiAmount || payment.amount);
                                     return payment.paidAmount < expectedAmount;
                                   })() && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 px-2 text-xs hover:bg-black hover:text-white"
                                      onClick={() => handleSettleDue(payment)}
                                    >
                                      Settle
                                    </Button>
                                  )}
                                  
                                  {/* Edit button for all payments */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 hover:bg-black hover:text-white"
                                          onClick={() => handleEditPayment(payment)}
                                        >
                                          <Edit className="h-5 w-5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Edit payment</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  
                                  {/* Delete button for all payments */}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 hover:bg-black hover:text-white"
                                          onClick={() => handleDeletePayment(payment)}
                                        >
                                          <Trash2 className="h-5 w-5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Delete payment</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-32 text-gray-500 bg-gray-50 border rounded-md">
                      Payment schedule is being generated. Please check back in a moment.
                    </div>
                  )
                ) : (
                  <div className="flex justify-center items-center h-32 text-gray-500 bg-gray-50 border rounded-md">
                    Borrower has no active loan. Add a loan first to see the payment schedule.
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
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
                <Label htmlFor="amount">Payment Amount</Label>
                <Input
                  id="amount"
                  type="text"
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
              {settlementPayment && loans && loans.length > 0 && (
                <>
                  Complete the settlement for {formatCurrency(settlementPayment.amount)} due on{" "}
                  {format(new Date(settlementPayment.dueDate), "MMM d, yyyy")}
                  <br />
                  <span className="text-red-600 font-medium mt-1 block">
                    Outstanding: {formatCurrency((() => {
                      const expectedAmount = loans[0]?.loanStrategy === 'flat' 
                        ? (loans[0]?.flatMonthlyAmount || 0)
                        : (loans[0]?.customEmiAmount || settlementPayment.amount);
                      return expectedAmount - (settlementPayment.paidAmount || 0);
                    })())}
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

      {/* Custom Payment Dialog for Custom and Gold & Silver loans */}
      <Dialog open={showCustomPaymentDialog} onOpenChange={setShowCustomPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Payment</DialogTitle>
            <DialogDescription>
              Enter the amount and payment date for the new payment. If the payment date is today or earlier, it will be marked as completed automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-amount">Payment Amount (₹)</Label>
              <Input
                id="custom-amount"
                type="number"
                placeholder="Enter payment amount"
                value={customPaymentForm.amount}
                onChange={(e) => setCustomPaymentForm({
                  ...customPaymentForm, 
                  amount: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="custom-payment-date">Payment Date</Label>
              <Input
                id="custom-payment-date"
                type="date"
                value={customPaymentForm.dueDate}
                onChange={(e) => setCustomPaymentForm({
                  ...customPaymentForm, 
                  dueDate: e.target.value
                })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="custom-notes">Notes (Optional)</Label>
              <Textarea
                id="custom-notes"
                placeholder="Add any notes about this payment"
                value={customPaymentForm.notes}
                onChange={(e) => setCustomPaymentForm({
                  ...customPaymentForm, 
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
              type="button"
              onClick={() => {
                if (loans && loans.length > 0 && customPaymentForm.amount && customPaymentForm.dueDate) {
                  createCustomPaymentMutation.mutate({
                    loanId: loans[0].id,
                    amount: parseFloat(customPaymentForm.amount),
                    dueDate: customPaymentForm.dueDate,
                    notes: customPaymentForm.notes
                  });
                }
              }}
              disabled={createCustomPaymentMutation.isPending || !customPaymentForm.amount || !customPaymentForm.dueDate}
            >
              {createCustomPaymentMutation.isPending ? "Adding..." : "Add Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BorrowerDetails;