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
  Eye,
  Flag,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import  NoticeCard  from "@/components/NoticeCard";
import { binaryToString } from '@/utils/binaryUtils';

interface Notice {
  id: string | number;
  title: string;
  description: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  slug: string;
  publishedAt?: string;
  creatorName?: string;
  viewCount?: number;
  uniqueViewers?: number;
  files?: Array<{ name: string; url: string; size?: number; type?: string }>;
}

const PublicNoticeDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (slug) {
      fetchNotice(slug);
    }
  }, [slug]);

  const fetchNotice = async (noticeSlug: string) => {
    try {
      setIsLoading(true);
      // Log the truncated slug for debugging
      console.log("Fetching notice with slug:", noticeSlug.substring(0, 50) + (noticeSlug.length > 50 ? "..." : ""));
      
      const url = `${import.meta.env.VITE_API_BASE_URL}/public/notices/${noticeSlug}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorData);
        
        if (response.status === 404) {
          throw new Error("Notice not found or has been removed");
        } else {
          throw new Error(errorData.message || `Failed to fetch notice (${response.status})`);
        }
      }
      
      const data = await response.json();
      setNotice(data.data.notice);
      setError(null);
    } catch (error) {
      console.error("Fetch error:", error);
      setError(error instanceof Error ? error.message : 'Failed to fetch notice');
      toast({
        title: "Notice Not Found",
        description: error instanceof Error ? error.message : 'Failed to fetch notice',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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

  // Replace the getDescriptionText function with this browser-compatible version
  const getDescriptionText = (description: any): string => {
    if (typeof description === 'string') {
      return description;
    }
    
    // Handle MySQL binary data format that comes as an object with type: 'Buffer'
    if (description && typeof description === 'object') {
      // Handle MySQL binary data format
      if (description.type === 'Buffer' && Array.isArray(description.data)) {
        try {
          return binaryToString(description.data);
        } catch (e) {
          console.error('Failed to decode binary data:', e);
          return '[Binary content]';
        }
      }
      
      // Fallback for other object types
      try {
        return JSON.stringify(description);
      } catch (e) {
        return '[Complex object]';
      }
    }
    
    return String(description || '');
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
              <Link to="/">Back to Home</Link>
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
                <Link to="/" state={{ fromNoticeDetail: true }} className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Home</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-sliate-accent/30"></div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Notice Details</h1>
            </div>
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
                </div>
                
                <div className="flex items-center space-x-1 text-sliate-accent dark:text-gray-400">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">
                    {typeof notice.viewCount === 'number' ? notice.viewCount : 
                     typeof notice.viewCount === 'string' ? parseInt(notice.viewCount, 10) : 0} views
                  </span>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-sliate-dark dark:text-white">
                {notice.title}
              </h2>
              
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-sliate-accent dark:text-gray-400">
                {notice.creatorName && (
                  <div className="flex items-center space-x-1">
                    <span>By {notice.creatorName}</span>
                  </div>
                )}
                
                {notice.publishedAt && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
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
                  src={`http://localhost:5000${notice.imageUrl.startsWith('/') ? '' : '/'}${notice.imageUrl}`}
                  alt={notice.title}
                  className="max-w-full max-h-96 object-contain rounded-md shadow-md"
                  onError={(e) => {
                    // If image fails to load, try alternative path
                    const target = e.target as HTMLImageElement;
                    const baseUrl = 'http://localhost:5000';
                    const imagePath = notice.imageUrl;
                    
                    if (!target.src.includes('/uploads/')) {
                      target.src = `${baseUrl}/uploads/${imagePath}`;
                    } else if (!target.src.includes('/uploads/images/')) {
                      target.src = `${baseUrl}/uploads/images/${imagePath.split('/').pop()}`;
                    } else {
                      // If all attempts fail, hide the image
                      target.style.display = 'none';
                    }
                  }}
                />
              </div>
            )}
            
            {/* Notice content */}
            <div className="prose dark:prose-invert max-w-none">
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {getDescriptionText(notice.description)}
              </div>
            </div>
            
            {/* Files section */}
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
                        href={`${import.meta.env.VITE_API_BASE_URL.replace('/api', '')}${file.url.startsWith('/') ? '' : '/'}${file.url}`}
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

export default PublicNoticeDetail;