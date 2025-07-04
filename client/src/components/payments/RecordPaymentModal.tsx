import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { calculateEMI } from "@/lib/utils";

const formSchema = z.object({
  borrowerId: z.string().min(1, { message: "Please select a borrower" }),
  paymentId: z.string().min(1, { message: "Please select a payment" }),
  paidDate: z.string().min(1, { message: "Payment date is required" }),
  paidAmount: z.coerce
    .number()
    .positive({ message: "Amount must be a positive number" }),
  paymentMethod: z.string().min(1, { message: "Please select a payment method" }),
  notes: z.string().optional(),
  useManualEmi: z.boolean().optional(),
  customEmi: z.coerce.number().positive().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RecordPaymentModal = ({ isOpen, onClose }: RecordPaymentModalProps) => {
  const { toast } = useToast();
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [dueAmount, setDueAmount] = useState<number>(0);
  const [showEmiCalculator, setShowEmiCalculator] = useState<boolean>(false);
  
  // EMI Calculator state
  const [loanAmount, setLoanAmount] = useState<number>(10000);
  const [interestRate, setInterestRate] = useState<number>(10);
  const [tenure, setTenure] = useState<number>(12);
  const [interestType, setInterestType] = useState<string>("annual");
  const [calculatedEmi, setCalculatedEmi] = useState<number>(0);

  // Get borrowers
  const { data: borrowers } = useQuery({
    queryKey: ["/api/borrowers"],
    enabled: isOpen,
  });

  // Get borrower's payments when a borrower is selected
  const { data: borrowerPayments = [] } = useQuery({
    queryKey: ["/api/payments", selectedBorrowerId && `borrowerId=${selectedBorrowerId}`],
    enabled: !!selectedBorrowerId && isOpen,
  });

  // Ensure borrowerPayments is an array before filtering
  const upcomingPayments = Array.isArray(borrowerPayments) 
    ? borrowerPayments.filter(
        (payment: any) => payment.status !== "collected"
      )
    : [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      borrowerId: "",
      paymentId: "",
      paidDate: new Date().toISOString().split("T")[0],
      paidAmount: 0,
      paymentMethod: "cash",
      notes: "",
      useManualEmi: false,
      customEmi: 0,
    },
  });

  // Update the form when a payment is selected
  useEffect(() => {
    if (selectedPaymentId && Array.isArray(borrowerPayments)) {
      const payment = borrowerPayments.find((p: any) => p.id.toString() === selectedPaymentId);
      if (payment) {
        setDueAmount(payment.amount);
        form.setValue("paidAmount", payment.amount);
      }
    }
  }, [selectedPaymentId, borrowerPayments, form]);
  
  // Calculate EMI when inputs change
  useEffect(() => {
    const emi = calculateEMI(loanAmount, interestRate, tenure, interestType);
    setCalculatedEmi(emi);
    if (form.getValues("useManualEmi")) {
      form.setValue("customEmi", emi);
      form.setValue("paidAmount", emi);
    }
  }, [loanAmount, interestRate, tenure, interestType, form]);

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", `/api/payments/${data.paymentId}/collect`, {
        status: "collected",
        paidDate: new Date(data.paidDate),
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/upcoming-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "Payment has been recorded successfully.",
      });
      
      form.reset();
      setSelectedBorrowerId(null);
      setSelectedPaymentId(null);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to record payment: ${error}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormValues) => {
    await recordPaymentMutation.mutateAsync(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Record Payment</DialogTitle>
          <Button
            onClick={onClose}
            variant="ghost"
            className="absolute right-4 top-4 rounded-full p-1 h-auto"
          >
            <X size={20} />
          </Button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="borrowerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Borrower</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedBorrowerId(value);
                      form.setValue("paymentId", "");
                      setSelectedPaymentId(null);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select borrower" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.isArray(borrowers) ? borrowers.map((borrower: any) => (
                        <SelectItem key={borrower.id} value={borrower.id.toString()}>
                          {borrower.name}
                        </SelectItem>
                      )) : null}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment For</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedPaymentId(value);
                    }}
                    defaultValue={field.value}
                    disabled={!selectedBorrowerId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {upcomingPayments?.map((payment) => (
                        <SelectItem key={payment.id} value={payment.id.toString()}>
                          {`Due: ${new Date(payment.dueDate).toLocaleDateString()} - ₹${payment.amount}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paidDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Amount Due</FormLabel>
                <Input
                  type="text"
                  value={`₹${dueAmount.toLocaleString()}`}
                  readOnly
                  className="bg-slate-50"
                />
              </FormItem>

              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Show remaining balance if partial payment */}
            {form.watch("paidAmount") > 0 && form.watch("paidAmount") < dueAmount && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-800">Remaining Balance:</span>
                  <span className="text-lg font-semibold text-orange-900">
                    ₹{(dueAmount - form.watch("paidAmount")).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-orange-700 mt-1">
                  This will be marked as a partial payment with outstanding balance.
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add payment notes (optional)"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="useManualEmi"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Use Manual EMI Calculator
                    </FormLabel>
                    <FormDescription>
                      Calculate a custom EMI amount instead of using the scheduled payment
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setShowEmiCalculator(checked);
                        if (!checked) {
                          // Reset to scheduled payment amount
                          if (selectedPaymentId && Array.isArray(borrowerPayments)) {
                            const payment = borrowerPayments.find((p: any) => p.id.toString() === selectedPaymentId);
                            if (payment) {
                              form.setValue("paidAmount", payment.amount);
                            }
                          }
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {showEmiCalculator && (
              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    <Calculator className="mr-2 h-4 w-4" />
                    EMI Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormItem>
                      <FormLabel>Loan Amount</FormLabel>
                      <Input
                        type="number"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                      />
                    </FormItem>
                    
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <Input
                        type="number"
                        value={interestRate}
                        onChange={(e) => setInterestRate(Number(e.target.value))}
                        step="0.01"
                      />
                    </FormItem>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormItem>
                      <FormLabel>Loan Tenure (months)</FormLabel>
                      <Input
                        type="number"
                        value={tenure}
                        onChange={(e) => setTenure(Number(e.target.value))}
                        min="1"
                      />
                    </FormItem>
                    
                    <FormItem>
                      <FormLabel>Interest Type</FormLabel>
                      <Select
                        value={interestType}
                        onValueChange={setInterestType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select interest type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="flat">Flat</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  </div>
                  
                  <div className="bg-slate-100 p-3 rounded-md text-center">
                    <FormLabel>Calculated EMI</FormLabel>
                    <p className="text-2xl font-semibold">₹{calculatedEmi.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  </div>
                  
                  <Button 
                    type="button" 
                    className="w-full"
                    onClick={() => {
                      form.setValue("paidAmount", calculatedEmi);
                      form.setValue("customEmi", calculatedEmi);
                    }}
                  >
                    Use This Amount
                  </Button>
                </CardContent>
              </Card>
            )}

            <Separator className="my-4" />

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? "Processing..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentModal;
