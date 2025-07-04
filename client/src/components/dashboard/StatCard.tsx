import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend: {
    value: number;
    direction: "up" | "down";
    label: string;
    negative?: boolean;
  };
  isAmount?: boolean;
}

const StatCard = ({ title, value, icon, trend, isAmount = false }: StatCardProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <Card className="bg-black border-gray-700 hover:bg-[#111111] transition-colors duration-200 cursor-pointer">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            {isAmount && (
              <button
                onClick={toggleVisibility}
                className="text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded"
                title={isVisible ? "Hide amount" : "Show amount"}
              >
                {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
            <div className="text-white">{icon}</div>
          </div>
        </div>
        <p className="text-3xl font-bold text-white">
          {isAmount && !isVisible ? "••••••" : value}
        </p>
        <p className="text-sm text-gray-300 mt-2 flex items-center">
          <span 
            className={`inline-flex items-center ${
              trend.negative 
                ? "text-danger" 
                : trend.direction === "up" 
                  ? "text-success" 
                  : "text-danger"
            }`}
          >
            {trend.direction === "up" ? (
              <ArrowUp size={16} className="mr-1" />
            ) : (
              <ArrowDown size={16} className="mr-1" />
            )}
            {trend.value}%
          </span>
          <span className="ml-1">{trend.label}</span>
        </p>
      </CardContent>
    </Card>
  );
};

export default StatCard;
