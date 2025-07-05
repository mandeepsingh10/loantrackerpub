import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Camera, Upload, Eye, MoreVertical } from "lucide-react";

// Import the LoanForm component
import LoanForm from "./LoanForm";

// Borrower form schema
const borrowerFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  phone: z.string().min(1, { message: "Phone number is required" }),
  address: z.string().min(1, { message: "Address is required" }),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorAddress: z.string().optional(),
  notes: z.string().optional(),
});

type BorrowerFormValues = z.infer<typeof borrowerFormSchema>;

interface NewBorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewBorrowerModal = ({ isOpen, onClose }: NewBorrowerModalProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<"borrower" | "loan">("borrower");
  const [newBorrowerId, setNewBorrowerId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // No need for next ID - let database auto-generate

  // Borrower form
  const borrowerForm = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      documentType: "aadhaar",
      documentNumber: "",
      guarantorName: "",
      guarantorPhone: "",
      guarantorAddress: "",
      notes: "",
    },
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      borrowerForm.reset();
      setStep("borrower");
      setNewBorrowerId(null);
      setSelectedPhoto(null);
      setPhotoPreviewUrl(null);
    }
  }, [isOpen, borrowerForm]);

  // Add borrower mutation
  const borrowerMutation = useMutation({
    mutationFn: async (data: BorrowerFormValues) => {
      console.log("Frontend sending to API:", data);
      
      // If there's a photo, upload it first
      let photoUrl = null;
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append('photo', selectedPhoto);
        
        const photoResponse = await apiRequest("POST", "/api/upload/photo", formData);
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          photoUrl = photoData.photoUrl;
        }
      }
      
      // Add photo URL to borrower data
      const borrowerData = {
        ...data,
        photoUrl
      };
      
      const response = await apiRequest("POST", "/api/borrowers", borrowerData);
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("Borrower created successfully:", data);
      toast({
        title: "Success",
        description: `Borrower created successfully with ID ${data.id}. Now add loan details.`,
      });
      // Save the new borrower ID and set it in the loan form
      setNewBorrowerId(data.id);
      // Move to the loan step
      setStep("loan");
    },
    onError: (error) => {
      console.error("Error creating borrower:", error);
      toast({
        title: "Error",
        description: `Failed to create borrower: ${error}`,
        variant: "destructive",
      });
    },
  });

  // Delete borrower mutation
  const deleteBorrowerMutation = useMutation({
    mutationFn: async (borrowerId: number) => {
      const response = await apiRequest("DELETE", `/api/borrowers/${borrowerId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      toast({
        title: "Success",
        description: "Borrower deleted successfully.",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error("Error deleting borrower:", error);
      toast({
        title: "Error",
        description: "Failed to delete borrower.",
        variant: "destructive",
      });
    },
  });

  // Add loan mutation
  const loanMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Sending loan data to API:", data);
      const response = await apiRequest("POST", "/api/loans", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "Loan has been added successfully.",
      });
      
      // Reset state and close modal
      borrowerForm.reset();
      setStep("borrower");
      setNewBorrowerId(null);
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

  // Submit handler for borrower form
  const onBorrowerSubmit = (data: BorrowerFormValues) => {
    console.log("Form submitted with data:", data);
    console.log("Notes field value:", data.notes);
    
    // Get all form values to verify
    const allFormValues = borrowerForm.getValues();
    console.log("All form values:", allFormValues);
    
    borrowerMutation.mutate(data);
  };

  // Submit handler for loan form
  const onLoanSubmit = (data: any) => {
    console.log("Submitting loan data:", data);
    // Make sure we have a borrower ID
    if (!newBorrowerId) {
      toast({
        title: "Error",
        description: "No borrower ID found. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Make sure the borrower ID is set
    data.borrowerId = newBorrowerId;
    loanMutation.mutate(data);
  };

  // Handle cancel/back button
  const handleCancel = () => {
    if (step === "loan") {
      // Go back to borrower form
      setStep("borrower");
    } else {
      // Just close the modal
      borrowerForm.reset();
      setStep("borrower");
      setNewBorrowerId(null);
      onClose();
    }
  };

  // Handle closing modal at loan step
  const handleCloseAtLoanStep = () => {
    if (step === "loan" && newBorrowerId) {
      setShowDeleteConfirm(true);
    } else {
      onClose();
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirmation = (shouldDelete: boolean) => {
    setShowDeleteConfirm(false);
    if (shouldDelete && newBorrowerId) {
      deleteBorrowerMutation.mutate(newBorrowerId);
    } else {
      onClose();
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleCloseAtLoanStep}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {step === "borrower" && (
              <div className="relative">
                {photoPreviewUrl ? (
                  // Show uploaded photo with dropdown menu
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer">
                        <img
                          src={photoPreviewUrl}
                          alt="Borrower photo"
                          className="w-8 h-8 rounded-full object-cover border border-gray-600"
                        />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => setShowPhotoPreview(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Photo
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Change Photo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  // Show camera icon with dropdown menu
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-500 cursor-pointer hover:border-gray-400 hover:bg-gray-700 transition-colors">
                        <Camera className="h-4 w-4 text-gray-400" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            )}
            <DialogTitle className="text-xl">
              {step === "borrower" ? "Add New Borrower" : "Add Loan Details"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {step === "borrower" ? (
          <Form {...borrowerForm}>
            <form onSubmit={borrowerForm.handleSubmit(onBorrowerSubmit)} className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-4">Personal Information</h4>
                  <div className="space-y-4">
                    <FormField
                      control={borrowerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={borrowerForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 XXXXX XXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={borrowerForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter address"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-4">Identification (Optional)</h4>
                  <div className="space-y-4">
                    <FormField
                      control={borrowerForm.control}
                      name="documentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                              <SelectItem value="pan">PAN Card</SelectItem>
                              <SelectItem value="voter">Voter ID</SelectItem>
                              <SelectItem value="driving">Driving License</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={borrowerForm.control}
                      name="documentNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Document Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter document number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-4">Guarantor Details (Optional)</h4>
                  <div className="space-y-4">
                    <FormField
                      control={borrowerForm.control}
                      name="guarantorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter guarantor name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={borrowerForm.control}
                      name="guarantorPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter guarantor phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={borrowerForm.control}
                      name="guarantorAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Address</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter guarantor address"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Notes Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-white">Notes</h3>
                <FormField
                  control={borrowerForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any notes about this borrower..."
                          rows={4}
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            console.log("Notes field changed:", e.target.value);
                          }}
                        />
                      </FormControl>
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
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={borrowerMutation.isPending}
                >
                  {borrowerMutation.isPending ? "Processing..." : "Next"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <LoanForm 
            borrowerId={newBorrowerId || 0}
            onSubmit={onLoanSubmit}
            onCancel={handleCancel}
            isSubmitting={loanMutation.isPending}
            isNewBorrower={true}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* Confirmation Dialog for Deleting Borrower */}
    <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Borrower?</DialogTitle>
          <DialogDescription>
            You've created a borrower but haven't added loan details. 
            Do you want to delete the created borrower as well?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => handleDeleteConfirmation(false)}
            disabled={deleteBorrowerMutation.isPending}
          >
            Keep Borrower
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleDeleteConfirmation(true)}
            disabled={deleteBorrowerMutation.isPending}
          >
            {deleteBorrowerMutation.isPending ? "Deleting..." : "Delete Borrower"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Photo Preview Modal */}
    <Dialog open={showPhotoPreview} onOpenChange={setShowPhotoPreview}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrower Photo</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <img
            src={photoPreviewUrl}
            alt="Borrower photo preview"
            className="max-w-full max-h-96 object-contain rounded-lg"
          />
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={() => setShowPhotoPreview(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default NewBorrowerModal;