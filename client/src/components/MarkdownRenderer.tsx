import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer = ({ content, className = "" }: MarkdownRendererProps) => {
  // Pre-process content to handle numbered text that shouldn't be lists and auto-link URLs
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // First, auto-link any plain URLs that aren't already in markdown link format
    let processedText = autoLinkPlainUrls(text);
    
    // Then handle numbered text that shouldn't be lists
    const lines = processedText.split('\n');
    
    const processedLines = lines.map(line => {
      // Only prevent markdown list interpretation for standalone numbers without proper spacing
      const standaloneNumberPattern = /^(\d+)\.([^\s])/;
      
      if (standaloneNumberPattern.test(line)) {
        return line.replace(standaloneNumberPattern, '$1.\u200B$2');
      }
      return line;
    });
    
    return processedLines.join('\n');
  };

  // Auto-link plain URLs that aren't already in markdown format
  const autoLinkPlainUrls = (text: string): string => {
    // More comprehensive URL regex
    const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"'\[\]()]+[^\s<>"'\[\]().,;:])/gi;
    
    return text.replace(urlPattern, (match, url, offset) => {
      // Check if this URL is already part of a markdown link
      const beforeMatch = text.substring(0, offset);
      const afterMatch = text.substring(offset + url.length);
      
      // Don't convert if it's already in markdown link format
      if (beforeMatch.endsWith('](') || beforeMatch.endsWith('[') || 
          afterMatch.startsWith(')') || beforeMatch.match(/\[[^\]]*$/)) {
        return url;
      }
      
      // Add protocol if missing
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Create markdown link
      return `[${url}](${fullUrl})`;
    });
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="prose dark:prose-invert notice-content mb-4" {...props} />,
          h1: ({ node, ...props }) => <h1 className="prose dark:prose-invert notice-content text-2xl font-bold mb-4 mt-6" {...props} />,
          h2: ({ node, ...props }) => <h2 className="prose dark:prose-invert notice-content text-xl font-bold mb-3 mt-5" {...props} />,
          h3: ({ node, ...props }) => <h3 className="prose dark:prose-invert notice-content text-lg font-bold mb-2 mt-4" {...props} />,
          ul: ({ node, ...props }) => <ul className="prose dark:prose-invert notice-content list-disc pl-6 mb-4 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="prose dark:prose-invert notice-content list-decimal pl-6 mb-4 space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="prose dark:prose-invert notice-content" {...props} />,
          a: ({ node, href, children, ...props }) => {
            // Ensure all links open in new tab/window and are secure
            const isExternal = href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('www.'));
            return (
              <a 
                className="prose dark:prose-invert notice-content text-sliate-accent dark:text-blue-400 underline hover:no-underline transition-colors" 
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ node, ...props }) => <blockquote className="prose dark:prose-invert notice-content border-l-4 border-sliate-accent pl-4 italic my-4 text-gray-600 dark:text-gray-300" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto text-sm my-4" {...props} />,
          code: ({ node, inline, ...props }) => 
            inline ? 
              <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props} /> :
              <code className="font-mono" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-6 border-gray-300 dark:border-gray-600" {...props} />,
        }}
      >
        {processContent(content)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;