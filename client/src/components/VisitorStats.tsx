
import { Eye, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const VisitorStats = () => {
  const stats = [
    { label: "Today", value: "4,264", color: "text-green-600" },
    { label: "Yesterday", value: "5,427", color: "text-blue-600" },
    { label: "This Week", value: "9,691", color: "text-purple-600" },
    { label: "This Month", value: "121,943", color: "text-orange-600" },
    { label: "Last Month", value: "167,400", color: "text-red-600" },
    { label: "All Days", value: "8,515,683", color: "text-sliate-dark" },
  ];

  return (
    <Card className="mb-6 bg-gradient-to-r from-sliate-neutral to-sliate-light border-sliate-accent/20">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Eye className="h-5 w-5 text-sliate-accent" />
          <h3 className="font-semibold text-sliate-dark">Visitor Statistics</h3>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-xs text-sliate-accent font-medium">{stat.label}</p>
              <p className={`font-bold text-sm ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default VisitorStats;
