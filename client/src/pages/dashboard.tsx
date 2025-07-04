import { useQuery } from "@tanstack/react-query";
import StatCard from "@/components/dashboard/StatCard";
import RecentLoans from "@/components/dashboard/RecentLoans";
import RecentDefaulters from "@/components/dashboard/RecentDefaulters";
import { BarChart3, Wallet, TriangleAlert, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toFixed(0)}`;
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsLoading ? (
          <>
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Loans"
              value={stats?.totalLoans || 0}
              icon={<Wallet className="text-primary" size={24} />}
              trend={{ value: 8, direction: "up", label: "since last month" }}
            />
            
            <StatCard
              title="Active Loans"
              value={stats?.activeLoans || 0}
              icon={<BarChart3 className="text-success" size={24} />}
              trend={{ value: 5, direction: "up", label: "since last month" }}
            />
            
            <StatCard
              title="Overdue Payments"
              value={stats?.overduePayments || 0}
              icon={<TriangleAlert className="text-warning" size={24} />}
              trend={{ value: 12, direction: "up", label: "since last month", negative: true }}
            />
            
            <StatCard
              title="Total Amount"
              value={formatAmount(stats?.totalAmount || 0)}
              icon={<TrendingUp className="text-accent" size={24} />}
              trend={{ value: 15, direction: "up", label: "since last month" }}
              isAmount
            />
          </>
        )}
      </div>
      
      <div className="w-full space-y-6">
        <RecentLoans />
        <RecentDefaulters />
      </div>
    </div>
  );
};

export default Dashboard;
