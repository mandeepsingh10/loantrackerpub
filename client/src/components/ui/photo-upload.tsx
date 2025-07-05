import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoChange: (file: File | null, photoUrl?: string) => void;
  className?: string;
}

const PhotoUpload = ({ currentPhotoUrl, onPhotoChange, className = "" }: PhotoUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPhotoChange(file, url);
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onPhotoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Borrower Photo</h3>
      </div>
      
      <div className="flex flex-col items-center space-y-3">
        {/* Photo Preview */}
        <div className="relative">
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Borrower photo"
                className="w-32 h-32 rounded-full object-cover border-2 border-gray-600"
              />
              <button
                onClick={handleRemovePhoto}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                title="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 flex items-center justify-center">
              <User className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex flex-col items-center space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            {previewUrl ? "Change Photo" : "Upload Photo"}
          </Button>
          
          <p className="text-xs text-gray-400 text-center">
            JPG, PNG up to 5MB
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default PhotoUpload; 