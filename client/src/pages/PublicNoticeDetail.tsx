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
import NoticeCard from "@/components/NoticeCard";
import { binaryToString } from '@/utils/binaryUtils';
import NoticeFilePreview from '@/components/NoticeFilePreview';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import NoticeContent from '@/components/NoticeContent';

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
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    if (slug) {
      fetchNotice(slug);
    }
  }, [slug]);

  const fetchNotice = async (noticeSlug: string) => {
    try {
      setIsLoading(true);
      console.log("Fetching notice with slug:", noticeSlug.substring(0, 50) + (noticeSlug.length > 50 ? "..." : ""));
      
      const url = `${import.meta.env.VITE_API_BASE_URL}/public/notices/${noticeSlug}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", response.status, errorData);
        
        if (response.status === 404) {
          setError("Notice not found");
          toast({
            title: "Notice Not Found",
            description: "The notice you're looking for could not be found.",
            variant: "destructive"
          });
        } else {
          setError("Failed to fetch notice");
          toast({
            title: "Error",
            description: "There was a problem fetching the notice.",
            variant: "destructive"
          });
        }
        return;
      }
      
      const data = await response.json();
      console.log("API response data:", data);
      
      // Process file URLs to ensure they have full paths
      if (data.data.notice.files) {
        // Make sure files is treated as an array
        const filesArray = Array.isArray(data.data.notice.files) ? 
          data.data.notice.files : 
          typeof data.data.notice.files === 'string' ? 
            JSON.parse(data.data.notice.files) : 
            [];
            
        data.data.notice.files = filesArray.map((file: any) => {
          // Ensure each file has the required properties
          if (!file || typeof file !== 'object') {
            return null;
          }
          
          return {
            name: file.name || (file.url ? file.url.split('/').pop() : 'unknown'),
            url: file.url?.startsWith('http') ? 
              file.url : 
              `${apiBaseUrl}${file.url?.startsWith('/') ? '' : '/'}${file.url || ''}`,
            size: file.size || 0,
            type: file.type || ''
          };
        }).filter(Boolean); // Remove any null entries
      } else {
        data.data.notice.files = [];
      }
      
      console.log("Processed notice data:", data.data.notice);
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
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300";
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
        return binaryToString(description.data);
      }
      
      // Fallback for other object types
      try {
        return JSON.stringify(description);
      } catch (e) {
        return String(description);
      }
    }
    
    return String(description || '');
  };

  // Handle file download
  const handleDownloadFile = (file: { name: string; url: string }) => {
    // Create a hidden link and trigger the download
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sliate-accent mx-auto mb-4"></div>
          <p className="text-sliate-dark dark:text-white">Loading notice...</p>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-2 text-sliate-dark dark:text-white">Notice Not Found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error || "The notice you're looking for could not be found."}</p>
          <Button asChild>
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-sliate-accent/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <Button variant="ghost" asChild size="sm" className="text-sliate-accent hover:text-sliate-dark dark:text-sliate-light dark:hover:text-white">
            <Link to="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-2">
              <Badge variant="outline" className={`${getPriorityColor(notice.priority)} px-2 py-0.5`}>
                {notice.priority.toUpperCase()}
              </Badge>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                {notice.publishedAt && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>{new Date(notice.publishedAt).toLocaleDateString()}</span>
                  </div>
                )}
                
                {notice.viewCount !== undefined && (
                  <div className="flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    <span>{notice.viewCount} views</span>
                  </div>
                )}
              </div>
            </div>
            
            <CardTitle className="text-2xl font-bold text-sliate-dark dark:text-white">
              {notice.title}
            </CardTitle>
            
            {notice.creatorName && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Posted by {notice.creatorName}
              </div>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Notice Image */}
            {notice.imageUrl && (
              <div className="flex justify-center">
                <img 
                  src={notice.imageUrl.startsWith('http') 
                    ? notice.imageUrl 
                    : `${apiBaseUrl}${notice.imageUrl.startsWith('/') ? '' : '/'}${notice.imageUrl}`}
                  alt={notice.title}
                  className="max-w-full max-h-96 object-contain rounded-md shadow-md"
                  onError={(e) => {
                    // Try alternative paths if image fails to load
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('?attempt=')) return; // Prevent infinite retries
                    
                    // Try different paths
                    const attempts = [
                      `${apiBaseUrl}/uploads/${notice.imageUrl.split('/').pop()}`,
                      `${apiBaseUrl}/uploads/images/${notice.imageUrl.split('/').pop()}`,
                      `${apiBaseUrl}${notice.imageUrl}`
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
            
            {/* Notice content */}
            <NoticeContent content={notice.description} className="mt-4" />
            
            {/* Files section */}
            {notice.files && notice.files.length > 0 && (
              <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-sliate-dark dark:text-white mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-sliate-accent" />
                  Attachments
                </h3>
                <NoticeFilePreview 
                  files={notice.files} 
                  onDownload={handleDownloadFile} 
                />
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Debug section - only visible during development */}
      {import.meta.env.DEV && (
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4">
          <details className="text-xs">
            <summary className="text-gray-500 dark:text-gray-400 font-mono cursor-pointer">
              Debug Information (development only)
            </summary>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 mt-2 rounded overflow-auto max-h-96 text-xs">
              {JSON.stringify({
                notice,
                filesInfo: notice?.files ? {
                  count: notice.files.length,
                  isArray: Array.isArray(notice.files),
                  fileDetails: notice.files.map(f => ({
                    name: f.name,
                    url: f.url,
                    hasName: Boolean(f.name),
                    hasUrl: Boolean(f.url)
                  }))
                } : 'No files',
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default PublicNoticeDetail;