import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { 
  BarChart3, 
  Users, 
  Receipt, 
  FileText, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { useMobile } from "../../hooks/useMobile";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("/");
  const isMobile = useMobile();

  useEffect(() => {
    setActiveTab(location);
  }, [location]);

  return (
    <div 
      className={`bg-gray-900 text-white transition-all duration-300 flex flex-col min-h-screen h-full z-20 ${
        sidebarOpen ? 'w-64' : 'w-20'
      } ${
        isMobile ? 'fixed' : 'relative'
      } ${
        isMobile && !sidebarOpen ? '-translate-x-full' : ''
      }`}
      style={{ backgroundColor: '#111827', minHeight: '100vh' }}
    >
      <div className="p-4 flex items-center justify-between">
        <div className={`flex items-center ${sidebarOpen ? 'block' : 'hidden'}`}>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            LoanSight
          </h1>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          className="text-white p-1"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-3">
          <SidebarItem 
            to="/"
            icon={<BarChart3 size={20} />}
            label="Dashboard"
            active={activeTab === "/"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          
          <SidebarItem 
            to="/borrowers"
            icon={<Users size={20} />}
            label="Borrowers"
            active={activeTab === "/borrowers"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          
          <SidebarItem 
            to="/payments"
            icon={<Receipt size={20} />}
            label="Payments"
            active={activeTab === "/payments"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          
          <SidebarItem 
            to="/defaulters"
            icon={<AlertTriangle size={20} />}
            label="Defaulters"
            active={activeTab === "/defaulters"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          
          <SidebarItem 
            to="/reports"
            icon={<FileText size={20} />}
            label="Reports"
            active={activeTab === "/reports"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
          
          <SidebarItem 
            to="/settings"
            icon={<Settings size={20} />}
            label="Settings"
            active={activeTab === "/settings"}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </ul>
      </nav>
    </div>
  );
};

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const SidebarItem = ({ to, icon, label, active, sidebarOpen, setSidebarOpen }: SidebarItemProps) => {
  const isMobile = useMobile();
  
  const handleClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <li>
      <Link href={to}>
        <div 
          className={`flex items-center p-2 rounded hover:bg-slate-700 transition-colors ${
            active ? 'bg-slate-700' : ''
          } cursor-pointer`}
          onClick={handleClick}
        >
          <span className="w-6 text-center">{icon}</span>
          <span className={`${sidebarOpen ? 'ml-3' : 'hidden'}`}>{label}</span>
        </div>
      </Link>
    </li>
  );
};

export default Sidebar;
