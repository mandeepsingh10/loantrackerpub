import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
  isAdmin: boolean;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: null,
  role: null,
  isAdmin: false,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const { data: authStatus, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/status"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/auth/status", {
          credentials: "include",
        });
        if (!response.ok) {
          return { authenticated: false };
        }
        return await response.json();
      } catch (error) {
        console.error("Auth status error:", error);
        return { authenticated: false };
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (authStatus) {
      setIsAuthenticated(authStatus.authenticated);
      setUsername(authStatus.username || null);
      setRole(authStatus.role || null);
    }
  }, [authStatus]);

  const login = () => {
    refetch();
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsAuthenticated(false);
      setUsername(null);
      setRole(null);
      // Clear any cached data
      window.location.reload();
    }
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        username,
        role,
        isAdmin,
        login,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};