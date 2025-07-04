import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const lowercaseStatus = status.toLowerCase();
  
  // Set colors based on status
  const statusStyles = {
    "active": "bg-green-100 text-green-800",
    "current": "bg-green-100 text-green-800",
    "overdue": "bg-orange-100 text-orange-800",
    "defaulter": "bg-red-600 text-white font-bold",
    "missed": "bg-red-100 text-red-800",
    "due soon": "bg-yellow-100 text-yellow-800",
    "upcoming": "bg-yellow-100 text-yellow-800",
    "collected": "bg-green-100 text-green-800",
    "completed": "bg-green-100 text-green-800",
    "no loan": "bg-slate-100 text-slate-800",
    "due_soon": "bg-yellow-100 text-yellow-800"
  };

  const getStatusColor = () => {
    return statusStyles[lowercaseStatus as keyof typeof statusStyles] || "bg-slate-100 text-slate-800";
  };

  // Format status text for display
  const formatStatusText = () => {
    if (lowercaseStatus === "due_soon") return "Due Soon";
    
    // Convert to title case
    return status.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      getStatusColor(),
      className
    )}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current"></span>
      {formatStatusText()}
    </span>
  );
};

export default StatusBadge;
