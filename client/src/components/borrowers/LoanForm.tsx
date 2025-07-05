import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Calculator } from "lucide-react";

// Loan form schema with basic validation
const loanFormSchema = z.object({
  borrowerId: z.number(),
  amount: z.string().min(1, { message: "Loan amount is required" }),
  loanStrategy: z.enum(["emi", "flat", "custom", "gold_silver"], { 
    required_error: "Please select a loan strategy" 
  }),
  startDate: z.string().min(1, { message: "Start date is required" }),
  
  // Guarantor fields - optional when creating new borrower
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorAddress: z.string().optional(),
  
  // Loan notes
  notes: z.string().optional(),
  
  // EMI-specific fields
  tenure: z.string().optional(),
  customEmiAmount: z.string().optional(),
  
  // FLAT-specific fields
  flatMonthlyAmount: z.string().optional(),
  
  // CUSTOM-specific fields
  customDueDate: z.string().optional(),
  customPaymentAmount: z.string().optional(),
  
  // GOLD_SILVER-specific fields
  pmType: z.string().optional(),
  metalWeight: z.string().optional(),
  purity: z.string().optional(),
  netWeight: z.string().optional(),
  amountPaid: z.string().optional(),
  goldSilverNotes: z.string().optional(),
  goldSilverDueDate: z.string().optional(),
  goldSilverPaymentAmount: z.string().optional(),
})
// Add conditional validation based on loan strategy
.refine(
  (data) => {
    if (data.loanStrategy === "emi") {
      return data.customEmiAmount && data.customEmiAmount.trim() !== "" && 
             data.tenure && data.tenure.trim() !== "";
    }
    return true;
  },
  {
    message: "EMI amount and tenure are required for EMI strategy",
    path: ["customEmiAmount"],
  }
)
.refine(
  (data) => {
    if (data.loanStrategy === "flat") {
      return data.flatMonthlyAmount && data.flatMonthlyAmount.trim() !== "";
    }
    return true;
  },
  {
    message: "Monthly payment amount is required for FLAT strategy",
    path: ["flatMonthlyAmount"],
  }
)
.refine(
  (data) => {
    if (data.loanStrategy === "gold_silver") {
      return data.pmType && data.pmType.trim() !== "" && 
             data.metalWeight && data.metalWeight.trim() !== "" &&
             data.purity && data.purity.trim() !== "";
    }
    return true;
  },
  {
    message: "PM Type, Weight, and Purity are required for Gold & Silver strategy",
    path: ["pmType"],
  }
);

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  borrowerId: number;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  isNewBorrower?: boolean; // New prop to indicate if this is for a new borrower
}

const LoanForm = ({ borrowerId, onSubmit, onCancel, isSubmitting, isNewBorrower }: LoanFormProps) => {
  const [loanStrategy, setLoanStrategy] = useState<"emi" | "flat" | "custom" | "gold_silver">("emi");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorValues, setCalculatorValues] = useState({
    principal: "",
    interestRate: "",
    tenure: "",
    calculatedEMI: 0
  });
  
  // Gold & Silver calculation values
  const [goldSilverValues, setGoldSilverValues] = useState({
    metalWeight: "",
    purity: "",
    netWeight: 0
  });

  // Pure EMI calculation function (no side effects)
  const calculateEMI = () => {
    const principal = parseFloat(calculatorValues.principal);
    const annualRate = parseFloat(calculatorValues.interestRate);
    const tenureMonths = parseFloat(calculatorValues.tenure);

    if (principal > 0 && annualRate >= 0 && tenureMonths > 0) {
      if (annualRate === 0) {
        // Simple division if no interest
        return principal / tenureMonths;
      } else {
        // Standard EMI formula
        const monthlyRate = annualRate / (12 * 100);
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
               (Math.pow(1 + monthlyRate, tenureMonths) - 1);
      }
    }
    return 0;
  };

  // Auto-calculate when values change
  const handleCalculatorChange = (field: string, value: string) => {
    // Update the specific field first
    setCalculatorValues(prev => {
      const newValues = { ...prev, [field]: value };
      
      // Calculate EMI with new values
      const principal = parseFloat(newValues.principal || "0");
      const annualRate = parseFloat(newValues.interestRate || "0");
      const tenureMonths = parseFloat(newValues.tenure || "0");

      let calculatedEMI = 0;
      if (principal > 0 && annualRate >= 0 && tenureMonths > 0) {
        if (annualRate === 0) {
          calculatedEMI = principal / tenureMonths;
        } else {
          const monthlyRate = annualRate / (12 * 100);
          calculatedEMI = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / 
                         (Math.pow(1 + monthlyRate, tenureMonths) - 1);
        }
      }
      
      return { ...newValues, calculatedEMI };
    });
  };

  // Real-time net weight calculation for Gold & Silver
  const handleGoldSilverChange = (field: string, value: string) => {
    setGoldSilverValues(prev => {
      const newValues = { ...prev, [field]: value };
      
      // Calculate net weight: metalWeight * (purity / 100)
      const metalWeight = parseFloat(newValues.metalWeight || "0");
      const purity = parseFloat(newValues.purity || "0");
      
      let netWeight = 0;
      if (metalWeight > 0 && purity > 0 && purity <= 100) {
        netWeight = metalWeight * (purity / 100);
      }
      
      return { ...newValues, netWeight };
    });
    
    // Also update the form field
    form.setValue("netWeight", goldSilverValues.netWeight.toFixed(3));
  };
  
  // Initialize form with default values
  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      borrowerId: borrowerId,
      amount: "10000",
      loanStrategy: "emi",
      startDate: new Date().toISOString().split("T")[0],
      guarantorName: isNewBorrower ? undefined : "",
      guarantorPhone: isNewBorrower ? undefined : "",
      guarantorAddress: isNewBorrower ? undefined : "",
      notes: "",
      tenure: "12",
      customEmiAmount: "1000",
      flatMonthlyAmount: "1000",
      pmType: "",
      metalWeight: "",
      purity: "",
      netWeight: "",
      goldSilverNotes: "",
    },
  });

  const handleSubmit = (values: LoanFormValues) => {
    console.log("Raw form values received:", values);
    console.log("Form errors:", form.formState.errors);
    
    // Debug Gold & Silver specific fields
    if (values.loanStrategy === "gold_silver") {
      console.log("Gold & Silver payment fields:", {
        goldSilverDueDate: values.goldSilverDueDate,
        goldSilverPaymentAmount: values.goldSilverPaymentAmount
      });
    }
    // Convert string values to numbers for submission
    const formattedData = {
      borrowerId: values.borrowerId,
      amount: parseFloat(values.amount),
      loanStrategy: values.loanStrategy,
      startDate: values.startDate,
      guarantorName: values.guarantorName,
      guarantorPhone: values.guarantorPhone,
      guarantorAddress: values.guarantorAddress,
      notes: values.notes || "",
    };
    
    // Add strategy-specific fields
    if (values.loanStrategy === "emi") {
      Object.assign(formattedData, {
        tenure: parseInt(values.tenure || "0", 10),
        customEmiAmount: parseFloat(values.customEmiAmount || "0"),
        // Set default values for interest - no longer user configurable
        interestType: "annual",
        interestRate: 0, // Zero interest
        paymentType: "principal_interest" // Default value for backward compatibility
      });
    } else if (values.loanStrategy === "flat") {
      Object.assign(formattedData, {
        flatMonthlyAmount: parseFloat(values.flatMonthlyAmount || "0")
      });
    } else if (values.loanStrategy === "custom") {
      Object.assign(formattedData, {
        // No first payment fields for custom loans
      });
    } else if (values.loanStrategy === "gold_silver") {
      Object.assign(formattedData, {
        pmType: values.pmType,
        metalWeight: parseFloat(values.metalWeight || "0"),
        purity: parseFloat(values.purity || "0"),
        netWeight: parseFloat(values.netWeight || "0"),
        goldSilverNotes: values.goldSilverNotes || ""
      });
    }
    
    console.log("Submitting formatted loan data:", formattedData);
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-white mb-4">Loan Details</h4>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loanStrategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Strategy</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setLoanStrategy(value as "emi" | "flat" | "custom" | "gold_silver");
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="emi">EMI</SelectItem>
                        <SelectItem value="flat">FLAT</SelectItem>
                        <SelectItem value="custom">CUSTOM</SelectItem>
                        <SelectItem value="gold_silver">GOLD & SILVER</SelectItem>
                      </SelectContent>
                    </Select>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Start Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {!isNewBorrower && (
            <div>
              <h4 className="font-medium text-white mb-4">Guarantor Information</h4>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="guarantorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guarantor Name</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter guarantor name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guarantorPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guarantor Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter guarantor phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="guarantorAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guarantor Address</FormLabel>
                      <FormControl>
                        <textarea
                          rows={3}
                          placeholder="Enter guarantor address"
                          {...field}
                          className="w-full px-3 py-2 text-white bg-black border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium text-white mb-4">Payment Information</h4>
            <div className="space-y-4">
              {loanStrategy === "emi" && (
                <>
                  <FormField
                    control={form.control}
                    name="tenure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Tenure (Months)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Enter months"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customEmiAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EMI Amount (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Enter monthly EMI"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the fixed monthly payment amount.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* EMI Calculator Toggle */}
                  <div className="flex items-center space-x-3 py-3">
                    <Switch
                      id="show-calculator"
                      checked={showCalculator}
                      onCheckedChange={setShowCalculator}
                    />
                    <label
                      htmlFor="show-calculator"
                      className="text-sm font-medium text-white cursor-pointer flex items-center gap-2"
                    >
                      <Calculator className="h-4 w-4" />
                      Use EMI Calculator
                    </label>
                  </div>

                  {/* EMI Calculator - shown below toggle when enabled */}
                  {showCalculator && (
                    <Card className="bg-black border-2 border-gray-700 shadow-lg w-full">
                      <CardHeader className="bg-black text-white pb-3">
                        <CardTitle className="text-base flex items-center gap-3 font-semibold">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <Calculator className="h-5 w-5" />
                          </div>
                          EMI Calculator
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 bg-black">
                        {/* Horizontal Layout with maximum space */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 items-end w-full">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-white block">
                              Principal Amount (₹)
                            </label>
                            <Input
                              type="number"
                              placeholder="Enter loan amount"
                              value={calculatorValues.principal}
                              onChange={(e) => handleCalculatorChange('principal', e.target.value)}
                              className="h-11 text-base border-2 border-gray-600 focus:border-white bg-gray-900 text-white placeholder:text-gray-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-white block">
                              Interest Rate (%)
                            </label>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="Enter rate"
                              value={calculatorValues.interestRate}
                              onChange={(e) => handleCalculatorChange('interestRate', e.target.value)}
                              className="h-11 text-base border-2 border-gray-600 focus:border-white bg-gray-900 text-white placeholder:text-gray-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-white block">
                              Tenure (Months)
                            </label>
                            <Input
                              type="number"
                              placeholder="Enter months"
                              value={calculatorValues.tenure}
                              onChange={(e) => handleCalculatorChange('tenure', e.target.value)}
                              className="h-11 text-base border-2 border-gray-600 focus:border-white bg-gray-900 text-white placeholder:text-gray-400"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-white block">
                              Calculated EMI
                            </label>
                            <div className="h-11 px-3 py-2 text-base font-bold bg-gray-900 border-2 border-green-500 text-green-400 rounded-md flex items-center">
                              {calculatorValues.principal && calculatorValues.interestRate && calculatorValues.tenure 
                                ? `₹${Math.round(calculateEMI()).toLocaleString()}`
                                : '₹0'
                              }
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {loanStrategy === "flat" && (
                <FormField
                  control={form.control}
                  name="flatMonthlyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Payment Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter monthly payment"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The fixed amount the borrower will pay each month without a fixed end date.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {loanStrategy === "custom" && (
                <div className="text-center p-4 bg-gray-800 border border-gray-600 rounded-lg">
                  <p className="text-gray-300">
                    For custom loans, payments will be added manually after loan creation.
                  </p>
                </div>
              )}

              {loanStrategy === "gold_silver" && (
                <>
                  <FormField
                    control={form.control}
                    name="pmType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precious Metal Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select metal type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gold">Gold</SelectItem>
                            <SelectItem value="silver">Silver</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="metalWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Metal weight (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Enter weight"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleGoldSilverChange('metalWeight', e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="purity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purity (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Enter purity"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                handleGoldSilverChange('purity', e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="netWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Net weight (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="Auto-calculated"
                              value={goldSilverValues.netWeight.toFixed(3)}
                              readOnly
                              className="cursor-not-allowed opacity-75"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="text-center p-4 bg-gray-800 border border-gray-600 rounded-lg">
                    <p className="text-gray-300">
                      For gold & silver loans, payments will be added manually after loan creation.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {loanStrategy === "gold_silver" && (
          <div className="mt-6">
            <FormField
              control={form.control}
              name="goldSilverNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-bold text-white">Gold & Silver Notes</FormLabel>
                  <FormControl>
                    <textarea
                      rows={4}
                      placeholder="Additional notes about the gold/silver collateral, terms, conditions, or any special agreements..."
                      {...field}
                      className="w-full px-3 py-2 text-white bg-black border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                    />
                  </FormControl>
                  <FormDescription>
                    Any additional information about the gold/silver collateral, market rates, or special terms
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="mt-6">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-bold text-white">Loan Notes</FormLabel>
                <FormControl>
                  <textarea
                    rows={4}
                    placeholder="Enter any additional notes about this loan, terms, conditions, or special agreements..."
                    {...field}
                    className="w-full px-3 py-2 text-white bg-black border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400"
                  />
                </FormControl>
                <FormDescription>
                  Optional notes about the loan terms, conditions, or any special agreements
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="my-4" />

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : "Create Loan"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default LoanForm;