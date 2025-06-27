import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer = ({ content, className = "" }: MarkdownRendererProps) => {
  // Pre-process content to handle numbered text that shouldn't be lists
  const processContent = (text: string): string => {
    if (!text) return '';
    
    // Split into lines to process line by line
    const lines = text.split('\n');
    
    // Process each line
    const processedLines = lines.map(line => {
      // Match standalone numbers like "1.", "2.", etc. at the beginning of a line
      // followed by text without proper list spacing
      const listItemPattern = /^(\d+)\.(\S)/;
      
      if (listItemPattern.test(line)) {
        // Add a zero-width space between the dot and the text to prevent Markdown list interpretation
        return line.replace(listItemPattern, '$1.\u200B$2');
      }
      return line;
    });
    
    return processedLines.join('\n');
  };

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[
          // Configure remarkGfm with stricter list detection
          [remarkGfm, { 
            stringLength: () => 1,
            listItemIndent: 'one'
          }]
        ]}
        components={{
          p: ({ node, ...props }) => <p className="prose dark:prose-invert notice-content" {...props} />,
          h1: ({ node, ...props }) => <h1 className="prose dark:prose-invert notice-content" {...props} />,
          h2: ({ node, ...props }) => <h2 className="prose dark:prose-invert notice-content" {...props} />,
          h3: ({ node, ...props }) => <h3 className="prose dark:prose-invert notice-content" {...props} />,
          ul: ({ node, ...props }) => <ul className="prose dark:prose-invert notice-content list-disc pl-5" {...props} />,
          ol: ({ node, ...props }) => <ol className="prose dark:prose-invert notice-content list-decimal pl-5" {...props} />,
          li: ({ node, ...props }) => <li className="prose dark:prose-invert notice-content my-1" {...props} />,
          a: ({ node, ...props }) => <a className="prose dark:prose-invert notice-content text-sliate-accent dark:text-blue-400 underline" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="prose dark:prose-invert notice-content border-l-4 border-sliate-accent pl-4 italic" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto" {...props} />,
          code: ({ node, inline, ...props }) => 
            inline ? 
              <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props} /> :
              <code {...props} />,
        }}
      >
        {processContent(content)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;