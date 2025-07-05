import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Download, 
  Upload,
  Database, 
  CheckCircle,
  AlertCircle,
  Trash2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/providers/AuthProvider";

const Settings = () => {
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      const photoText = data.metadata.totalPhotos > 0 ? 
        `, ${data.metadata.totalPhotos} photos (${(data.metadata.totalPhotoSize / 1024 / 1024).toFixed(1)} MB)` : '';
      const userText = data.metadata.totalUsers > 0 ? `, ${data.metadata.totalUsers} users` : '';
      
      toast({
        title: "Backup Created Successfully",
        description: `Backup contains ${data.metadata.totalBorrowers} borrowers, ${data.metadata.totalLoans} loans, ${data.metadata.totalPayments} payments${photoText}${userText}.`,
      });
      
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loan-management-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: () => {
      toast({
        title: "Backup Failed",
        description: "There was an error creating the backup. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Restore data mutation with progress tracking
  const restoreDataMutation = useMutation({
    mutationFn: async (backupData: any) => {
      setIsRestoring(true);
      setRestoreProgress(10);
      
      // Simulate progress steps
      const updateProgress = (step: number) => {
        setRestoreProgress(step);
      };
      
      updateProgress(20);
      
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      });
      
      updateProgress(60);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      updateProgress(80);
      const result = await response.json();
      updateProgress(100);
      
      return result;
    },
    onSuccess: (data) => {
      setTimeout(() => {
        setIsRestoring(false);
        setRestoreProgress(0);
        const photoText = data.stats.photos > 0 ? 
          `, ${data.stats.photos} photos (${(data.stats.photoSize / 1024 / 1024).toFixed(1)} MB)` : '';
        const userText = data.stats.users > 0 ? `, ${data.stats.users} users` : '';
        
        toast({
          title: "Data Restored Successfully",
          description: `Restored ${data.stats.borrowers} borrowers, ${data.stats.loans} loans, ${data.stats.payments} payments${photoText}${userText}.`,
        });
        // Refresh all data
        queryClient.invalidateQueries();
      }, 500);
    },
    onError: (error) => {
      setIsRestoring(false);
      setRestoreProgress(0);
      toast({
        title: "Restore Failed",
        description: `Failed to restore data: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Delete all data mutation
  const deleteAllDataMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest('DELETE', '/api/database/delete-all', {
        password: password
      });
      return response;
    },
    onSuccess: () => {
      setIsDeleting(false);
      setAdminPassword("");
      setShowPasswordDialog(false);
      toast({
        title: "Database Cleaned Successfully",
        description: "All data has been permanently deleted from the database.",
      });
      // Refresh all data
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      setIsDeleting(false);
      toast({
        title: "Delete Failed",
        description: `Failed to delete data: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Handle delete all data - show confirmation dialog first
  const handleDeleteAllData = () => {
    setShowConfirmationDialog(true);
  };

  // Proceed to password confirmation
  const proceedToPasswordConfirmation = () => {
    setShowConfirmationDialog(false);
    setShowPasswordDialog(true);
  };

  // Confirm deletion with password
  const confirmDeleteWithPassword = () => {
    if (!adminPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your admin password to confirm.",
        variant: "destructive",
      });
      return;
    }
    setIsDeleting(true);
    deleteAllDataMutation.mutate(adminPassword);
  };

  // Handle file upload for restore
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backupData = JSON.parse(e.target?.result as string);
          if (backupData.data && backupData.metadata) {
            restoreDataMutation.mutate(backupData);
          } else {
            toast({
              title: "Invalid Backup File",
              description: "The selected file is not a valid backup file.",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "File Read Error",
            description: "Could not read the backup file. Please ensure it's a valid JSON file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };





  const handleCreateBackup = () => {
    createBackupMutation.mutate();
  };



  return (
    <div className="p-6 space-y-6">

      {/* Backup Section */}
      <Card className="bg-black border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Database className="h-5 w-5" />
            <span>Backup</span>
          </CardTitle>
          <p className="text-white/70">
            Backup your database and all loan management data to ensure you never lose important information.
          </p>
        </CardHeader>
                <CardContent className="space-y-6">
          <div className="p-4 border border-green-600 rounded-lg bg-green-900/20">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <h4 className="font-medium text-green-300">What's Included in Backups</h4>
            </div>
            <p className="text-xs text-green-200 mb-2">
              💾 Backup files are self-contained and include all photos embedded as base64 data. Photo URLs are preserved and will work correctly after restore.
            </p>
            <ul className="text-sm text-green-200 space-y-1">
              <li>• All borrower information and contact details</li>
              <li>• Complete loan records and payment schedules</li>
              <li>• Payment history and collection status</li>
              <li>• Interest calculations and EMI details</li>
              <li>• Database structure and relationships</li>
              <li>• Borrower photos and documents (embedded in backup)</li>
              <li>• User accounts and permissions</li>
              <li>• Loan-specific guarantor information</li>
              <li>• Multiple loan strategies (EMI, FLAT, Custom, Gold & Silver)</li>
              <li>• Payment notes and collection methods</li>
            </ul>
          </div>

          <div className="p-4 border border-white/20 rounded-lg bg-black">
            <h4 className="font-medium text-white mb-2">Manual Backup</h4>
            <p className="text-sm text-white/70 mb-4">
              Create a complete, self-contained backup of all your data including photos, database structure, and content. 
              This backup can be restored on any new instance without requiring existing files.
            </p>
            <Button 
              onClick={handleCreateBackup}
              disabled={createBackupMutation.isPending}
              className="flex items-center space-x-2 bg-blue-800 text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span>
                {createBackupMutation.isPending ? "Creating Backup..." : "Create Backup Now"}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Restore Section */}
      <Card className="bg-black border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Upload className="h-5 w-5" />
            <span>Data Restore</span>
          </CardTitle>
          <p className="text-white/70">
            Restore your complete database from a previously created backup file to recover all your loan management data.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border border-blue-600 rounded-lg bg-blue-900/20">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <h4 className="font-medium text-blue-300">Important Notice</h4>
            </div>
            <p className="text-sm text-blue-200">
              Restoring data will replace all existing information. Make sure to create a backup of your current data before proceeding.
            </p>
          </div>

          <div className="p-4 border border-white/20 rounded-lg bg-black">
            <h4 className="font-medium text-white mb-2">Upload Backup File</h4>
            <p className="text-sm text-white/70 mb-4">
              Select a backup file (.json) that was previously created from this application to restore your data.
            </p>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="backup-file" className="text-white">
                  Choose Backup File
                </Label>
                <Input
                  id="backup-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="mt-1 bg-black border-white/20 text-white"
                />
              </div>
              
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={restoreDataMutation.isPending}
                className="flex items-center space-x-2 bg-green-800 text-white hover:bg-green-700"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {restoreDataMutation.isPending ? "Restoring Data..." : "Select Backup File"}
                </span>
              </Button>
              
              {/* Progress Bar for Restore */}
              {isRestoring && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">Restoring data...</span>
                    <span className="text-white">{restoreProgress}%</span>
                  </div>
                  <Progress 
                    value={restoreProgress} 
                    className="w-full bg-black"
                  />
                  <p className="text-xs text-white/70">
                    {restoreProgress < 30 && "Preparing restoration..."}
                    {restoreProgress >= 30 && restoreProgress < 70 && "Processing backup data..."}
                    {restoreProgress >= 70 && restoreProgress < 95 && "Updating database..."}
                    {restoreProgress >= 95 && "Finalizing..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Cleanup Section - Admin Only */}
      {isAdmin && (
        <Card className="bg-black border-red-600/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Trash2 className="h-5 w-5 text-red-500" />
            <span>Database Cleanup</span>
          </CardTitle>
          <p className="text-white/70">
            Permanently delete all data from the database and reset the system to its initial state.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border border-red-600 rounded-lg bg-red-900/20">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <h4 className="font-medium text-red-300">⚠️ DANGER ZONE ⚠️</h4>
            </div>
            <p className="text-sm text-red-200 mb-2">
              This action will permanently delete ALL data including:
            </p>
            <ul className="text-sm text-red-200 space-y-1 list-disc list-inside">
              <li>All borrower information and contact details</li>
              <li>Complete loan records and payment schedules</li>
              <li>Payment history and collection status</li>
              <li>Interest calculations and EMI details</li>
              <li>Database ID sequences will be reset</li>
            </ul>
            <p className="text-sm text-red-200 mt-2 font-semibold">
              This action cannot be undone! Make sure to create a backup first.
            </p>
          </div>

          <div className="p-4 border border-white/20 rounded-lg bg-black">
            <h4 className="font-medium text-white mb-2">Initiate Database Cleanup</h4>
            <p className="text-sm text-white/70 mb-4">
              Click the button below to start the database cleanup process. You will be asked to confirm this action.
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={handleDeleteAllData}
                disabled={isDeleting}
                className="flex items-center space-x-2 bg-red-800 text-white hover:bg-red-700 disabled:bg-gray-600"
              >
                <Trash2 className="h-4 w-4" />
                <span>
                  {isDeleting ? "Deleting All Data..." : "Delete All Data"}
                </span>
              </Button>
              
              {isDeleting && (
                <div className="space-y-2">
                  <p className="text-sm text-red-400">
                    🔥 Permanently deleting all database records...
                  </p>
                  <p className="text-xs text-white/70">
                    This process may take a few moments to complete.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <DialogContent className="bg-black border-red-600/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>⚠️ Delete All Data?</span>
            </DialogTitle>
            <DialogDescription className="text-white/70">
              This action will permanently delete ALL data from your loan management system.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 border border-red-600 rounded-lg bg-red-900/20">
              <h4 className="font-medium text-red-300 mb-2">What will be deleted:</h4>
              <ul className="text-sm text-red-200 space-y-1 list-disc list-inside">
                <li>All borrower information and contact details</li>
                <li>Complete loan records and payment schedules</li>
                <li>Payment history and collection status</li>
                <li>Interest calculations and EMI details</li>
              </ul>
            </div>
            
            <div className="p-4 border border-yellow-600 rounded-lg bg-yellow-900/20">
              <h4 className="font-medium text-yellow-300 mb-2">📋 Before proceeding:</h4>
              <p className="text-sm text-yellow-200">
                Have you created a backup of your data? This action cannot be undone!
              </p>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmationDialog(false)}
              className="border-gray-600 text-white hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={proceedToPasswordConfirmation}
              className="bg-red-800 text-white hover:bg-red-700"
            >
              Yes, I want to delete all data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-black border-red-600/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center space-x-2">
              <Trash2 className="h-5 w-5" />
              <span>Enter Your Password</span>
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Enter your password to confirm this destructive action.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirm-password" className="text-white">
                Your Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 bg-black border-white/20 text-white"
                disabled={isDeleting}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPasswordDialog(false);
                setAdminPassword("");
              }}
              className="border-gray-600 text-white hover:bg-gray-800"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDeleteWithPassword}
              disabled={isDeleting || !adminPassword.trim()}
              className="bg-red-800 text-white hover:bg-red-700 disabled:bg-gray-600"
            >
              {isDeleting ? "Deleting..." : "Delete All Data"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Settings;