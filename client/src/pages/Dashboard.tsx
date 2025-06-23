
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock,
  Users,
  FileText,
  TrendingUp
} from "lucide-react";

const Dashboard = () => {
  const [userRole] = useState<"lecturer" | "admin" | "superadmin">("admin");

  const dashboardStats = [
    {
      title: "Total Notices",
      value: "48",
      change: "+12%",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Pending Approval",
      value: "8",
      change: "+3",
      icon: Clock,
      color: "text-orange-600"
    },
    {
      title: "Today's Views",
      value: "4,264",
      change: "+18%",
      icon: Eye,
      color: "text-green-600"
    },
    {
      title: "Active Users",
      value: "156",
      change: "+5%",
      icon: Users,
      color: "text-purple-600"
    }
  ];

  const recentNotices = [
    {
      id: "1",
      title: "Final Examination Schedule",
      status: "published",
      priority: "high",
      author: "Dr. Silva",
      date: "2024-01-08",
      views: 1247
    },
    {
      id: "2", 
      title: "Workshop on Emerging Technologies",
      status: "pending",
      priority: "medium",
      author: "Prof. Perera",
      date: "2024-01-07",
      views: 0
    },
    {
      id: "3",
      title: "Library Hours Extension",
      status: "published",
      priority: "low",
      author: "Admin Office",
      date: "2024-01-06", 
      views: 456
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-red-100 text-red-800">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "low":
        return <Badge className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-sliate-accent/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild className="text-sliate-accent dark:text-gray-300">
                <Link to="/" className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Notice Board</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-sliate-accent/30"></div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge className="bg-sliate-dark text-white capitalize">
                {userRole}
              </Badge>
              <Button asChild className="bg-sliate-accent hover:bg-sliate-accent/90 text-white">
                <Link to="/create-notice" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Notice</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card key={index} className="border-sliate-accent/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-sliate-accent">{stat.title}</p>
                      <p className="text-2xl font-bold text-sliate-dark">{stat.value}</p>
                      <p className="text-xs text-green-600 font-medium">{stat.change}</p>
                    </div>
                    <IconComponent className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Notices */}
        <Card className="border-sliate-accent/20">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sliate-dark">Recent Notices</span>
              <Button variant="outline" size="sm" className="border-sliate-accent text-sliate-accent">
                View All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentNotices.map((notice) => (
                <div key={notice.id} className="flex items-center justify-between p-4 border border-sliate-accent/20 rounded-lg hover:bg-sliate-neutral/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-sliate-dark">{notice.title}</h3>
                      {getStatusBadge(notice.status)}
                      {getPriorityBadge(notice.priority)}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-sliate-accent">
                      <span>By {notice.author}</span>
                      <span>{notice.date}</span>
                      <span className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{notice.views}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" className="text-sliate-accent hover:text-sliate-dark">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-sliate-accent hover:text-sliate-dark">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {(userRole === "admin" || userRole === "superadmin") && (
                      <>
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800">
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
