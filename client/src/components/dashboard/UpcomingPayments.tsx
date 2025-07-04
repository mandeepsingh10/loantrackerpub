import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const UpcomingPayments = () => {
  const { toast } = useToast();
  const { data: upcomingPayments, isLoading } = useQuery({
    queryKey: ["/api/dashboard/upcoming-payments"],
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      const paidDate = new Date();
      return apiRequest("POST", `/api/payments/${paymentId}/collect`, {
        status: "collected",
        paidDate,
        paidAmount: null, // Will be set to the full amount
        paymentMethod: "Cash",
        notes: "Collected via dashboard",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/upcoming-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Payment Collected",
        description: "The payment has been marked as collected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to collect payment: ${error}`,
        variant: "destructive",
      });
    },
  });

  const handleCollect = (paymentId: number) => {
    collectPaymentMutation.mutate(paymentId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Payments</CardTitle>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-0">
        <CardTitle>Upcoming Payments</CardTitle>
        <Link href="/payments">
          <Button variant="link" className="text-primary font-medium">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {upcomingPayments?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">No upcoming payments</p>
            </div>
          ) : (
            upcomingPayments?.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:shadow transition-shadow duration-200"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-4">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <p className="font-medium">{payment.borrower}</p>
                    <p className="text-sm text-slate-500">₹{payment.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {format(new Date(payment.dueDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {payment.daysLeft > 0
                      ? `${payment.daysLeft} days left`
                      : "Overdue"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="ml-4"
                  onClick={() => handleCollect(payment.id)}
                  disabled={collectPaymentMutation.isPending}
                >
                  {collectPaymentMutation.isPending ? "Processing..." : "Collect"}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UpcomingPayments;
