import { createContext, useState, ReactNode } from "react";

interface AppContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const AppContext = createContext<AppContextType>({
  searchQuery: "",
  setSearchQuery: () => {},
  sidebarOpen: true,
  setSidebarOpen: () => {},
});

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AppContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
