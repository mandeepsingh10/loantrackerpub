import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Dashboard from "./pages/dashboard";
import Borrowers from "./pages/borrowers";
import EditBorrower from "./pages/edit-borrower";
import Payments from "./pages/payments";
import DefaultersNew from "./pages/defaulters-new";
import Reports from "./pages/reports";
import Settings from "./pages/settings";
import LoginPage from "./pages/login";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { useMobile } from "./hooks/useMobile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/borrowers" component={Borrowers} />
      <Route path="/edit-borrower/:id" component={EditBorrower} />
      <Route path="/payments" component={Payments} />
      <Route path="/defaulters" component={DefaultersNew} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useMobile();

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <div className="h-screen flex bg-black overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="bg-black flex-1 overflow-auto">
          <Router />
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
