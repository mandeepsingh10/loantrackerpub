import { useParams, useLocation } from "wouter";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BorrowerDetails } from "@/components/borrowers/BorrowerDetails";

export default function BorrowerDetailsPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const borrowerId = parseInt(id || "0");

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Full-screen header with navigation */}
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
            <h1 className="text-2xl font-bold text-white">Borrower Details & Payments</h1>
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

      {/* Main content */}
      <div className="bg-black text-white">
        <BorrowerDetails 
          borrowerId={borrowerId} 
          isOpen={true} 
          onClose={() => navigate("/borrowers")}
          fullScreen={true}
        />
      </div>
    </div>
  );
}