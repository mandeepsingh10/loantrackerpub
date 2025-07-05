import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, User, X, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import PhotoUpload from "@/components/ui/photo-upload";

const editBorrowerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(1, "Address is required"),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
  guarantorAddress: z.string().optional(),
});

type EditBorrowerFormValues = z.infer<typeof editBorrowerSchema>;

export default function EditBorrower() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const borrowerId = parseInt(id || "0");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Fetch borrower details
  const { data: borrower, isLoading } = useQuery({
    queryKey: ["/api/borrowers", borrowerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/borrowers/${borrowerId}`);
      return await res.json();
    },
    enabled: !!borrowerId,
  });

  // Fetch loan details for this borrower
  const { data: loans } = useQuery({
    queryKey: ["/api/loans/borrower", borrowerId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/loans/borrower/${borrowerId}`);
      return await res.json();
    },
    enabled: !!borrowerId,
  });

  const form = useForm<EditBorrowerFormValues>({
    resolver: zodResolver(editBorrowerSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      idType: "",
      idNumber: "",
      guarantorName: "",
      guarantorPhone: "",
      guarantorAddress: "",
    },
  });

  // Update form when borrower data loads
  useEffect(() => {
    if (borrower) {
      form.reset({
        name: borrower.name || "",
        phone: borrower.phone || "",
        address: borrower.address || "",
        idType: borrower.idType || "",
        idNumber: borrower.idNumber || "",
        guarantorName: borrower.guarantorName || "",
        guarantorPhone: borrower.guarantorPhone || "",
        guarantorAddress: borrower.guarantorAddress || "",
      });
      
      if (borrower.photoUrl) {
        setPhotoPreviewUrl(borrower.photoUrl);
      }
    }
  }, [borrower, form]);

  // Update borrower mutation
  const updateBorrowerMutation = useMutation({
    mutationFn: async (data: EditBorrowerFormValues) => {
      let photoUrl = borrower?.photoUrl || null;
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append('photo', selectedPhoto);
        
        const photoResponse = await apiRequest("POST", "/api/upload/photo", formData);
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          photoUrl = photoData.photoUrl;
        }
      }
      
      const borrowerData = {
        ...data,
        photoUrl
      };
      
      const response = await apiRequest("PUT", `/api/borrowers/${borrowerId}`, borrowerData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Borrower Updated",
        description: "Borrower details have been successfully updated.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/borrowers"], exact: false });
      navigate("/borrowers");
    },
    onError: (error) => {
      console.error("Update borrower error:", error);
      toast({
        title: "Update Failed",
        description: "Could not update borrower. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditBorrowerFormValues) => {
    updateBorrowerMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <div className="text-lg">Loading borrower details...</div>
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="min-h-screen bg-black text-white flex justify-center items-center">
        <div className="text-lg text-red-400">Borrower not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/borrowers")}
              className="flex items-center gap-2 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Borrowers
            </Button>
            <div className="flex items-center gap-2">
              <User className="h-6 w-6 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">Edit Borrower</h1>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/borrowers")}
            className="flex items-center gap-2 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 -mt-4">
        {/* Loan Information */}
        {loans && loans.length > 0 && (
          <Card className="max-w-3xl mx-auto mb-4 bg-gray-900 border-gray-700">
            <div className="bg-gray-800 border-b border-gray-700 py-3 px-4">
              <div className="text-white text-lg font-semibold flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Loan Information
              </div>
            </div>
            <CardContent className="p-4">
              {loans.map((loan: any, index: number) => (
                <div key={loan.id} className={`${index > 0 ? 'border-t border-gray-700 pt-3 mt-3' : ''}`}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-gray-400 text-sm">Loan Amount</Label>
                      <p className="text-white font-medium">₹{loan.amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Loan Type</Label>
                      <p className="text-white font-medium">
                        {loan.loanStrategy ? loan.loanStrategy.toUpperCase() : 'EMI'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Start Date</Label>
                      <p className="text-white font-medium">{new Date(loan.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">
                        {loan.loanStrategy === 'emi' ? 'EMI Amount' : 'Monthly Amount'}
                      </Label>
                      <p className="text-white font-medium">
                        ₹{(loan.customEmiAmount || loan.flatMonthlyAmount)?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Borrower Form */}
        <Card className="max-w-3xl mx-auto bg-gray-900 border-gray-700">
          <div className="bg-gray-800 border-b border-gray-700 py-3 px-4">
            <div className="text-white text-lg font-semibold">Update Borrower Information</div>
          </div>
          <CardContent className="p-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Photo Upload */}
              <PhotoUpload
                currentPhotoUrl={borrower?.photoUrl}
                onPhotoChange={(file, previewUrl) => {
                  setSelectedPhoto(file);
                  setPhotoPreviewUrl(previewUrl || null);
                }}
              />

              {/* Basic Information */}
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name" className="text-white">Full Name *</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    className="mt-1 bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter borrower's full name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-white">Phone Number *</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    className="mt-1 bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter phone number"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="address" className="text-white">Address *</Label>
                  <Textarea
                    id="address"
                    {...form.register("address")}
                    className="mt-1 bg-gray-800 border-gray-600 text-white"
                    placeholder="Enter complete address"
                    rows={3}
                  />
                  {form.formState.errors.address && (
                    <p className="text-red-400 text-sm mt-1">
                      {form.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="idType" className="text-white">ID Type</Label>
                    <select
                      id="idType"
                      {...form.register("idType")}
                      className="flex h-10 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                    >
                      <option value="" className="bg-gray-800 text-white">Select ID Type</option>
                      <option value="aadhaar" className="bg-gray-800 text-white">Aadhaar Card</option>
                      <option value="pan" className="bg-gray-800 text-white">PAN Card</option>
                      <option value="passport" className="bg-gray-800 text-white">Passport</option>
                      <option value="voter_id" className="bg-gray-800 text-white">Voter ID</option>
                      <option value="driving_license" className="bg-gray-800 text-white">Driving License</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="idNumber" className="text-white">ID Number</Label>
                    <div className="mt-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white opacity-60">
                      {borrower?.idNumber || 'Not set'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">ID number cannot be changed</p>
                  </div>
                </div>
              </div>

              {/* Guarantor Section */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-medium text-white mb-3">Guarantor Details (Optional)</h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="guarantorName" className="text-white">Guarantor Name</Label>
                    <Input
                      id="guarantorName"
                      {...form.register("guarantorName")}
                      className="mt-1 bg-gray-800 border-gray-600 text-white"
                      placeholder="Enter guarantor's full name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="guarantorPhone" className="text-white">Guarantor Phone</Label>
                    <Input
                      id="guarantorPhone"
                      {...form.register("guarantorPhone")}
                      className="mt-1 bg-gray-800 border-gray-600 text-white"
                      placeholder="Enter guarantor's phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="guarantorAddress" className="text-white">Guarantor Address</Label>
                    <Textarea
                      id="guarantorAddress"
                      {...form.register("guarantorAddress")}
                      className="mt-1 bg-gray-800 border-gray-600 text-white"
                      placeholder="Enter guarantor's complete address"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/borrowers")}
                  className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateBorrowerMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateBorrowerMutation.isPending ? "Updating..." : "Update Borrower"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}