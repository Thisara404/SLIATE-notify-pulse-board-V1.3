
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, Calendar, Flag, Building2 } from "lucide-react";

interface NoticeFiltersProps {
  onFilterChange: (filters: { time: string; priority: string; category: string; department: string }) => void;
}

const NoticeFilters = ({ onFilterChange }: NoticeFiltersProps) => {
  const [filters, setFilters] = useState({
    time: "today",
    priority: "all",
    category: "all",
    department: "all"
  });

  const departments = [
    "IT",
    "Management",
    "Accountancy",
    "Tourism & Hospitality Management",
    "Business Administration"
  ];

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <Card className="mb-6 bg-white dark:bg-gray-800 border-sliate-accent/20">
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-sliate-accent" />
          <h3 className="font-semibold text-sliate-dark dark:text-white">Filter Notices</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-sliate-accent" />
              <label className="text-sm font-medium text-sliate-dark dark:text-white">Time Period</label>
            </div>
            <Select value={filters.time} onValueChange={(value) => handleFilterChange("time", value)}>
              <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Flag className="h-4 w-4 text-sliate-accent" />
              <label className="text-sm font-medium text-sliate-dark dark:text-white">Priority</label>
            </div>
            <Select value={filters.priority} onValueChange={(value) => handleFilterChange("priority", value)}>
              <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="low">Low Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-sliate-dark dark:text-white">Category</label>
            <Select value={filters.category} onValueChange={(value) => handleFilterChange("category", value)}>
              <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="events">Upcoming Events</SelectItem>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="administrative">Administrative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Building2 className="h-4 w-4 text-sliate-accent" />
              <label className="text-sm font-medium text-sliate-dark dark:text-white">Department</label>
            </div>
            <Select value={filters.department} onValueChange={(value) => handleFilterChange("department", value)}>
              <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NoticeFilters;
