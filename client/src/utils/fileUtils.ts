/**
 * Securely downloads a file from a URL
 * @param fileUrl URL to download from
 * @param fileName Name to save the file as
 */
export const secureDownload = (fileUrl: string, fileName: string) => {
  // Create an invisible anchor element
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName;
  link.rel = 'noopener noreferrer'; // Security best practice
  
  // Add to DOM, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Get file icon class name based on file extension
 * @param fileName File name with extension
 * @returns CSS class name for the icon
 */
export const getFileIconClass = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return 'text-red-500';
    case 'doc':
    case 'docx':
      return 'text-blue-700';
    case 'xls':
    case 'xlsx':
      return 'text-green-600';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'text-purple-500';
    case 'txt':
      return 'text-gray-500';
    case 'zip':
    case 'rar':
      return 'text-amber-500';
    default:
      return 'text-gray-400';
  }
};

/**
 * Format file size in human-readable format
 * @param bytes File size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size';
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Get MIME type from file extension
 * @param fileName File name with extension
 * @returns MIME type string
 */
export const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
};