import {
  Calendar,
  Clock,
  ExternalLink,
  Download,
  Flag,
  FileText,
  File,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate, Link } from "react-router-dom"; 
import { useState } from "react";

// Define Notice interface without views property
interface Notice {
  id: string;
  topic: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
  department: string;
  date: string;
  expiry?: string;
  links?: string[];
  attachments?: { name: string; url: string; size?: number; type?: string }[];
  images?: string[];
  // Removed views property
}

interface NoticeCardProps {
  notice: Notice;
  slug?: string;
}

const NoticeCard = ({ notice, slug }: NoticeCardProps) => {
  const navigate = useNavigate();
  const [explosions, setExplosions] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);
  const [showFilesDialog, setShowFilesDialog] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";
      case "low":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
    }
  };

  const createExplosion = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newExplosion = {
      id: Date.now(),
      x,
      y,
    };

    setExplosions((prev) => [...prev, newExplosion]);

    setTimeout(() => {
      setExplosions((prev) => prev.filter((exp) => exp.id !== newExplosion.id));
    }, 600);
  };

  // Fix the handleViewDetails function
  const handleViewDetails = () => {
    if (slug) {
      navigate(`/public/notice/${slug}`, { state: { fromCard: true } });
    } else {
      navigate(`/notice/${notice.id}`);
    }
  };

  // Add this helper function to handle binary data
  const getTextContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle MySQL binary data format that comes as an object with type: 'Buffer'
    if (content && typeof content === 'object') {
      // Handle MySQL binary data format
      if (content.type === 'Buffer' && Array.isArray(content.data)) {
        try {
          // Convert the array of bytes to string using TextDecoder for proper UTF-8 handling
          const uint8Array = new Uint8Array(content.data);
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(uint8Array);
        } catch (e) {
          console.error('Failed to decode binary data:', e);
          return '[Binary content]';
        }
      }
      
      // Fallback for other object types
      try {
        return JSON.stringify(content);
      } catch (e) {
        return '[Complex object]';
      }
    }
    
    return String(content || '');
  };

  // Function to get file icon based on file type
  const getFileIcon = (file: { name: string; type?: string }) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const type = file.type || '';
    
    if (type.includes('pdf') || extension === 'pdf') {
      return <File className="h-4 w-4 text-red-500" />;
    } else if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    } else if (type.includes('word') || type.includes('document') || ['doc', 'docx'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-indigo-500" />;
    } else {
      return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // Function to format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to handle file download
  const handleFileDownload = (file: { name: string; url: string }) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to show files dialog
  const handleShowFiles = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering other click events
    setShowFilesDialog(true);
    createExplosion(e);
  };

  // Helper function to safely get attachments array
  const getAttachments = () => {
    if (!notice.attachments) return [];
    if (Array.isArray(notice.attachments)) return notice.attachments;
    
    // If attachments is not an array, try to handle it
    console.warn('Notice attachments is not an array:', notice.attachments);
    return [];
  };

  const attachments = getAttachments();

  return (
    <>
      <Card className="mb-4 hover:shadow-lg transition-all duration-300 border-sliate-accent/20 hover:border-sliate-accent/40 bg-white dark:bg-gray-800 dark:border-gray-600 relative overflow-hidden">
        {explosions.map((explosion) => (
          <div
            key={explosion.id}
            className="absolute pointer-events-none z-10"
            style={{
              left: explosion.x,
              top: explosion.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-blue-500 rounded-full animate-ping"
                style={{
                  transform: `rotate(${i * 45}deg) translateX(20px)`,
                  animationDelay: `${i * 50}ms`,
                  animationDuration: "600ms",
                }}
              />
            ))}
          </div>
        ))}

        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div className="flex items-center space-x-2 flex-wrap">
              <Badge
                className={`${getPriorityColor(
                  notice.priority
                )} text-xs font-medium`}
              >
                <Flag className="h-3 w-3 mr-1" />
                {notice.priority.toUpperCase()}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-sliate-accent/30 text-sliate-accent dark:border-sliate-light/30 dark:text-sliate-light"
              >
                {notice.category}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-sliate-dark/30 text-sliate-dark dark:border-gray-400 dark:text-gray-300"
              >
                {notice.department}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-sliate-accent dark:text-gray-400">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{notice.date}</span>
              </div>
              {/* Removed view count display */}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <h3 className="font-bold text-lg text-sliate-dark dark:text-white mb-2 leading-tight">
              {notice.topic}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {(() => {
                const description = getTextContent(notice.description);
                return description.length > 200
                  ? `${description.substring(0, 200)}...`
                  : description;
              })()}
            </p>
          </div>

          {notice.expiry && (
            <div className="flex items-center space-x-1 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
              <Clock className="h-4 w-4" />
              <span>Expires: {notice.expiry}</span>
            </div>
          )}

          {notice.images && notice.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {notice.images.slice(0, 3).map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Notice image ${index + 1}`}
                  className="w-full h-24 object-cover rounded border border-sliate-accent/20 dark:border-gray-600"
                />
              ))}
              {notice.images.length > 3 && (
                <div className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded border border-sliate-accent/20 dark:border-gray-600 flex items-center justify-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    +{notice.images.length - 3} more
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex flex-wrap gap-2">
              {notice.links && notice.links.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-sliate-accent text-sliate-accent hover:bg-sliate-accent hover:text-white dark:border-sliate-light dark:text-sliate-light dark:hover:bg-sliate-light dark:hover:text-sliate-dark"
                  onClick={createExplosion}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {notice.links.length} Link{notice.links.length > 1 ? "s" : ""}
                </Button>
              )}

              {attachments.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-sliate-dark text-sliate-dark hover:bg-sliate-dark hover:text-white dark:border-gray-400 dark:text-gray-300 dark:hover:bg-gray-600"
                  onClick={handleShowFiles}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {attachments.length} File
                  {attachments.length > 1 ? "s" : ""}
                </Button>
              )}
            </div>

            <Button
              onClick={handleViewDetails}
              className="bg-sliate-accent hover:bg-sliate-accent/90 text-white dark:bg-sliate-light dark:text-sliate-dark dark:hover:bg-sliate-light/90"
            >
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Files Dialog */}
      <Dialog open={showFilesDialog} onOpenChange={setShowFilesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sliate-accent" />
              Attachments ({attachments.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {attachments.length > 0 ? (
              attachments.map((file, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    {getFileIcon(file)}
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleFileDownload(file)}
                    className="text-sliate-accent hover:text-sliate-dark hover:bg-sliate-accent/10 dark:text-sliate-light dark:hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No attachments available
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NoticeCard;
