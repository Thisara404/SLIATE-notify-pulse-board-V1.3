import React from 'react';
import { 
  FileText, 
  File, 
  FileImage, 
  // Replace FilePdf with File and use a condition to style it differently
  FileSpreadsheet, 
  FileCode, 
  FileArchive,
  Download,
  ExternalLink
} from 'lucide-react';
import { Button } from './ui/button';

interface FileInfo {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

interface NoticeFilePreviewProps {
  files: FileInfo[];
  onDownload?: (file: FileInfo) => void;
}

const NoticeFilePreview: React.FC<NoticeFilePreviewProps> = ({ files = [], onDownload }) => {
  // Debug logging
  console.log("Files in NoticeFilePreview:", files);
  
  // Ensure files is always an array
  const safeFiles = Array.isArray(files) ? files : [];

  const getFileIcon = (file: FileInfo) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const type = file.type || '';
    
    if (type.includes('pdf') || extension === 'pdf') {
      // Use File icon with red styling instead of FilePdf
      return <File className="h-6 w-6 text-red-500" />;
    } else if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <FileImage className="h-6 w-6 text-blue-500" />;
    } else if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(extension || '')) {
      return <FileSpreadsheet className="h-6 w-6 text-green-500" />;
    } else if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf', 'odt'].includes(extension || '')) {
      return <FileText className="h-6 w-6 text-indigo-500" />;
    } else if (type.includes('zip') || type.includes('compressed') || ['zip', 'rar', '7z'].includes(extension || '')) {
      return <FileArchive className="h-6 w-6 text-amber-500" />;
    } else if (type.includes('text') || ['txt', 'md'].includes(extension || '')) {
      return <FileCode className="h-6 w-6 text-gray-500" />;
    } else {
      return <File className="h-6 w-6 text-gray-400" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to determine if file should open in browser or download
  const handleFileAction = (file: FileInfo) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const type = file.type || '';
    
    // Files that should open in browser
    const browserViewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt'];
    
    if (browserViewable.includes(extension || '')) {
      // Open in new tab
      window.open(file.url, '_blank');
    } else {
      // Force download for other file types
      if (onDownload) {
        onDownload(file);
      } else {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {safeFiles.length > 0 ? (
        safeFiles.map((file, index) => (
          <div 
            key={index} 
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              {getFileIcon(file)}
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {file.size ? formatFileSize(file.size) : ''}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleFileAction(file)}
                title={`Open or download ${file.name}`}
                className="text-sliate-accent hover:text-sliate-dark hover:bg-sliate-accent/10 dark:text-sliate-light dark:hover:text-white"
              >
                {file.name.split('.').pop()?.toLowerCase() === 'pdf' ? (
                  <ExternalLink className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="sr-only md:not-sr-only md:ml-2">
                  {file.name.split('.').pop()?.toLowerCase() === 'pdf' ? 'Open' : 'Download'}
                </span>
              </Button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No attachments available</p>
      )}
    </div>
  );
};

export default NoticeFilePreview;