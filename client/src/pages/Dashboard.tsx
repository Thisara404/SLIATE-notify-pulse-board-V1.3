import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { 
  Plus, 
  Search, 
  FileText, 
  Clock, 
  Eye, 
  Users, 
  LogOut, 
  Settings,
  Filter,
  Edit,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { noticeService, Notice, NoticeFilters } from "@/services/noticeApi";
import { Pagination } from "@/components/ui/pagination";

const Dashboard = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<NoticeFilters>({
    page: 1,
    limit: 10,
    includeStats: true
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [stats, setStats] = useState({
    totalNotices: 0,
    pendingNotices: 0,
    totalViews: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchNotices();
    fetchStatistics();
  }, [filters]);

  const fetchNotices = async () => {
    try {
      setIsLoading(true);
      const updatedFilters = {
        ...filters,
        userId: user?.id,
        // We'll let the server handle this logic based on user role
        showOnlyOwnDrafts: true
      };
      
      const response = await noticeService.getAllNotices(updatedFilters);
      setNotices(response.data.notices);
      setPagination(response.data.pagination);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch notices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch notices. Please try again later.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await noticeService.getAllNotices({
        includeStats: true,
        limit: 1
      });
      
      if (response.data.statistics) {
        setStats({
          totalNotices: response.data.statistics.totalNotices || 0,
          pendingNotices: response.data.statistics.pendingNotices || 0,
          totalViews: response.data.statistics.totalViews || 0,
          activeUsers: response.data.statistics.activeUsers || 0
        });
      }
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out."
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Logout Error", 
        description: "An error occurred during logout.",
        variant: "destructive"
      });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prevFilters => ({
      ...prevFilters,
      search: searchQuery,
      page: 1
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      page
    }));
  };

  const handleStatusFilter = (status: string | null) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      status: status || undefined,
      page: 1
    }));
  };

  const handlePriorityFilter = (priority: string | null) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      priority: priority || undefined,
      page: 1
    }));
  };

  const handleDeleteNotice = async (id: number) => {
    if (!confirm("Are you sure you want to delete this notice? This action cannot be undone.")) {
      return;
    }

    try {
      await noticeService.deleteNotice(id);
      toast({
        title: "Notice Deleted",
        description: "The notice has been successfully deleted."
      });
      fetchNotices(); // Refresh notices list
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete notice",
        variant: "destructive"
      });
    }
  };

  const handlePublishNotice = async (id: number) => {
    try {
      await noticeService.publishNotice(id);
      toast({
        title: "Notice Published",
        description: "The notice has been successfully published."
      });
      fetchNotices(); // Refresh notices list
    } catch (error) {
      toast({
        title: "Publish Failed",
        description: error instanceof Error ? error.message : "Failed to publish notice",
        variant: "destructive"
      });
    }
  };

  const handleUnpublishNotice = async (id: number) => {
    try {
      await noticeService.unpublishNotice(id);
      toast({
        title: "Notice Unpublished",
        description: "The notice has been successfully unpublished."
      });
      fetchNotices(); // Refresh notices list
    } catch (error) {
      toast({
        title: "Unpublish Failed",
        description: error instanceof Error ? error.message : "Failed to unpublish notice",
        variant: "destructive"
      });
    }
  };

  const dashboardStats = [
    {
      title: "Total Notices",
      value: pagination.total.toString(),
      change: "",
      icon: FileText,
      color: "text-blue-600"
    },
    {
      title: "Pending Approval",
      value: notices.filter((notice) => notice.status === "draft").length.toString(),
      change: "",
      icon: Clock,
      color: "text-orange-600",
      hidden: !hasPermission('notice_approve')
    },
    {
      title: "Total Views",
      value: notices.reduce((acc, notice) => acc + (notice.viewCount || 0), 0).toString(),
      change: "",
      icon: Eye,
      color: "text-green-600"
    },
    {
      title: "Active Users",
      value: stats.activeUsers.toString(),
      change: "",
      icon: Users,
      color: "text-purple-600",
      hidden: !hasPermission('notice_approve')
    }
  ].filter(stat => !stat.hidden);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800">Published</Badge>;
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
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back to Notice Board</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-sliate-accent/30"></div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-sliate-dark dark:text-white font-medium">
                  {user?.full_name || user?.username}
                </span>
                <Badge className="bg-slate-600 text-white capitalize">
                  {user?.role?.replace('_', ' ')}
                </Badge>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                {hasPermission('notice_create') && (
                  <Button asChild className="bg-sliate-accent hover:bg-sliate-accent/90 text-white">
                    <Link to="/create-notice" className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>Create Notice</span>
                    </Link>
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="flex items-center space-x-2 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Message */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-sliate-dark dark:text-white">
            Welcome back, {user?.full_name || user?.username}!
          </h2>
          <p className="text-sliate-accent dark:text-gray-300">
            Here's what's happening with your notices today.
          </p>
        </div>

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
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold text-sliate-dark">{stat.value}</p>
                        {stat.change && (
                          <span className={`text-sm ${stat.color} font-medium`}>
                            {stat.change}
                          </span>
                        )}
                      </div>
                    </div>
                    <IconComponent className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters and Search */}
        <Card className="border-sliate-accent/20 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={filters.status === undefined ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handleStatusFilter(null)}
                >
                  All Statuses
                </Button>
                <Button 
                  variant={filters.status === 'published' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handleStatusFilter('published')}
                >
                  Published
                </Button>
                <Button 
                  variant={filters.status === 'draft' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handleStatusFilter('draft')}
                >
                  Draft
                </Button>
                
                <div className="h-6 w-px bg-sliate-accent/30 mx-2"></div>
                
                <Button 
                  variant={filters.priority === undefined ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handlePriorityFilter(null)}
                >
                  All Priorities
                </Button>
                <Button 
                  variant={filters.priority === 'high' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handlePriorityFilter('high')}
                >
                  High
                </Button>
                <Button 
                  variant={filters.priority === 'medium' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handlePriorityFilter('medium')}
                >
                  Medium
                </Button>
                <Button 
                  variant={filters.priority === 'low' ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => handlePriorityFilter('low')}
                >
                  Low
                </Button>
              </div>
              
              <form onSubmit={handleSearch} className="flex w-full md:w-80 space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search notices..." 
                    className="pl-10 border-sliate-accent/30"
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                </div>
                <Button type="submit">Search</Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Notices List */}
        <Card className="border-sliate-accent/20">
          <CardHeader>
            <CardTitle className="text-sliate-dark">
              Notices {filters.search ? `matching "${filters.search}"` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-sliate-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sliate-accent">Loading notices...</p>
              </div>
            ) : notices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sliate-accent">No notices found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notices.map((notice) => (
                  <div key={notice.id} className="flex items-center justify-between p-4 border border-sliate-accent/20 rounded-lg hover:bg-sliate-neutral/30 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-sliate-dark">{notice.title}</h3>
                        {getStatusBadge(notice.status)}
                        {getPriorityBadge(notice.priority)}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-sliate-accent">
                        <span>By {notice.creatorName || notice.creatorUsername}</span>
                        <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center space-x-1">
                          <Eye className="h-4 w-4" />
                          <span>{notice.viewCount || 0}</span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-sliate-accent hover:text-sliate-dark"
                        onClick={() => navigate(`/notice/${notice.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {hasPermission('notice_edit') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-sliate-accent hover:text-sliate-dark"
                          onClick={() => navigate(`/edit-notice/${notice.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {hasPermission('notice_approve') && notice.status === 'draft' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-green-600 hover:text-green-800"
                          onClick={() => handlePublishNotice(notice.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {hasPermission('notice_approve') && notice.status === 'published' && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-orange-600 hover:text-orange-800"
                          onClick={() => handleUnpublishNotice(notice.id)}
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {hasPermission('notice_delete') && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-800"
                          onClick={() => handleDeleteNotice(notice.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
