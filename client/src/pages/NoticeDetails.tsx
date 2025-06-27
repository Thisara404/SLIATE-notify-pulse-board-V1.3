import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  Edit,
  Eye,
  Flag,
  Trash2,
  User,
  CheckCircle,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { noticeService, Notice } from "@/services/noticeApi";
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { sanitizeHtml } from '@/utils/sanitize';
import NoticeContent from '@/components/NoticeContent';

const NoticeDetail = ({ publicMode = false }) => {
  const { id } = useParams<{ id: string }>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchNotice(id);
    }
  }, [id]);

  const fetchNotice = async (noticeId: string) => {
    try {
      setIsLoading(true);
      const response = await noticeService.getNoticeById(noticeId);
      setNotice(response.data.notice);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch notice');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch notice',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!notice) return;

    if (!confirm("Are you sure you want to delete this notice?")) {
      return;
    }

    try {
      await noticeService.deleteNotice(notice.id);
      toast({
        title: "Notice Deleted",
        description: "The notice has been successfully deleted."
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete notice",
        variant: "destructive"
      });
    }
  };

  const handlePublish = async () => {
    if (!notice) return;

    try {
      await noticeService.publishNotice(notice.id);
      toast({
        title: "Notice Published",
        description: "The notice has been successfully published."
      });
      fetchNotice(notice.id.toString()); // Refresh notice data
    } catch (error) {
      toast({
        title: "Publish Failed",
        description: error instanceof Error ? error.message : "Failed to publish notice",
        variant: "destructive"
      });
    }
  };

  const handleUnpublish = async () => {
    if (!notice) return;

    try {
      await noticeService.unpublishNotice(notice.id);
      toast({
        title: "Notice Unpublished",
        description: "The notice has been successfully unpublished."
      });
      fetchNotice(notice.id.toString()); // Refresh notice data
    } catch (error) {
      toast({
        title: "Unpublish Failed",
        description: error instanceof Error ? error.message : "Failed to unpublish notice",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 border-green-200";
      case "draft":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sliate-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-sliate-dark dark:text-white">Loading Notice...</h2>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-300">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {error || "Notice not found"}
            </p>
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-sliate-accent/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild className="text-sliate-accent dark:text-gray-300">
                <Link to="/dashboard" state={{ fromNoticeDetail: true }} className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-sliate-accent/30"></div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Notice Details</h1>
            </div>
            
            {/* Only show admin controls if not in public mode */}
            {!publicMode && (
              <div className="flex items-center space-x-3">
                {hasPermission('notice_edit') && (
                  <Button asChild className="bg-sliate-accent hover:bg-sliate-accent/90 text-white">
                    <Link to={`/edit-notice/${notice.id}`} className="flex items-center space-x-2">
                      <Edit className="h-4 w-4" />
                      <span>Edit</span>
                    </Link>
                  </Button>
                )}
                
                {hasPermission('notice_delete') && (
                  <Button 
                    variant="outline" 
                    onClick={handleDelete}
                    className="flex items-center space-x-2 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="border-sliate-accent/20 mb-6">
          <CardHeader>
            <div className="flex flex-col space-y-4">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className={`${getPriorityColor(notice.priority)} text-xs font-medium`}>
                    <Flag className="h-3 w-3 mr-1" />
                    {notice.priority.toUpperCase()}
                  </Badge>
                  
                  <Badge className={`${getStatusColor(notice.status)} text-xs`}>
                    {notice.status === 'published' ? 
                      <CheckCircle className="h-3 w-3 mr-1" /> : 
                      <Clock className="h-3 w-3 mr-1" />
                    }
                    {notice.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                  
                  {/* Admin actions in notice content */}
                  {!publicMode && hasPermission('notice_approve') && (
                    notice.status === 'draft' ? (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={handlePublish}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Publish Now
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={handleUnpublish}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Unpublish
                      </Button>
                    )
                  )}
                </div>
                
                <div className="flex items-center space-x-1 text-sliate-accent dark:text-gray-400">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{notice.viewCount || 0} views</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-sliate-dark dark:text-white">
                {notice.title}
              </h2>
              
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-sliate-accent dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>By {notice.creatorName || notice.creatorUsername}</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(notice.createdAt).toLocaleDateString()}</span>
                </div>
                
                {notice.publishedAt && (
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>Published {new Date(notice.publishedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Notice Image */}
            {notice.imageUrl && (
              <div className="flex justify-center">
                <img 
                  src={notice.imageUrl.startsWith('http') 
                    ? notice.imageUrl 
                    : `http://localhost:5000${notice.imageUrl.startsWith('/') ? '' : '/'}${notice.imageUrl}`}
                  alt={notice.title}
                  className="max-w-full max-h-96 object-contain rounded-md shadow-md"
                  onError={(e) => {
                    // Try alternative paths if image fails to load
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('?attempt=')) return; // Prevent infinite retries
                    
                    // Try different paths
                    const attempts = [
                      `http://localhost:5000/uploads/${notice.imageUrl.split('/').pop()}`,
                      `http://localhost:5000/uploads/images/${notice.imageUrl.split('/').pop()}`,
                      `http://localhost:5000${notice.imageUrl}`
                    ];
                    
                    const currentAttempt = parseInt(new URLSearchParams(target.src.split('?')[1] || '').get('attempt') || '0');
                    if (currentAttempt < attempts.length) {
                      target.src = `${attempts[currentAttempt]}?attempt=${currentAttempt + 1}`;
                    } else {
                      // If all attempts fail, hide the image
                      target.style.display = 'none';
                    }
                  }}
                />
              </div>
            )}
            
            {/* Notice Description */}
            <NoticeContent content={notice.description} className="mt-4" />
            
            {/* Files */}
            {notice.files && notice.files.length > 0 && (
              <div className="border border-sliate-accent/20 rounded-lg p-4">
                <h3 className="text-lg font-medium text-sliate-dark dark:text-white mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-sliate-accent" />
                  Attachments
                </h3>
                <div className="space-y-3">
                  {notice.files.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-sliate-accent" />
                        <span className="font-medium text-sliate-dark dark:text-white">
                          {file.name}
                        </span>
                      </div>
                      <a 
                        href={`http://localhost:5000${file.url.startsWith('/') ? '' : '/'}${file.url}`}
                        download={file.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-sliate-accent hover:text-sliate-dark px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Download className="h-4 w-4" />
                        <span className="text-sm">Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NoticeDetail;
