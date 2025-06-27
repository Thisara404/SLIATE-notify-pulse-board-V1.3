import { sanitizeHtml } from '@/utils/sanitize';
import { Card } from '@/components/ui/card';
import MarkdownRenderer from './MarkdownRenderer';

interface NoticeContentProps {
  content: any; // Accept various content types
  className?: string;
}

const NoticeContent = ({ content, className = "" }: NoticeContentProps) => {
  // Process content - handle various formats with proper UTF-8 encoding
  const processContent = (rawContent: any): string => {
    if (typeof rawContent === 'string') {
      return rawContent;
    }
    
    // Handle MySQL binary data with proper UTF-8 decoding
    if (rawContent && rawContent.type === 'Buffer' && Array.isArray(rawContent.data)) {
      try {
        // Use TextDecoder for proper UTF-8 handling of Sinhala text
        const uint8Array = new Uint8Array(rawContent.data);
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(uint8Array);
      } catch (error) {
        console.error('Failed to decode binary content:', error);
        // Fallback to basic string conversion
        return String.fromCharCode.apply(null, rawContent.data);
      }
    }
    
    return String(rawContent || '');
  };

  const processedContent = processContent(content);
  
  // Check if content appears to be HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(processedContent);
  
  return (
    <Card className={`p-6 bg-white dark:bg-gray-800 border-sliate-accent/20 ${className}`}>
      {isHtml ? (
        <div 
          className="prose dark:prose-invert max-w-none notice-content"
          dangerouslySetInnerHTML={{ 
            __html: sanitizeHtml(processedContent) 
          }} 
        />
      ) : (
        <MarkdownRenderer content={processedContent} />
      )}
    </Card>
  );
};

export default NoticeContent;