import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, Italic, List, ListOrdered, Link as LinkIcon, 
  Heading, Code, Eye, Edit, Undo, Redo
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const RichTextEditor = ({ content, onChange, placeholder = 'Start typing...' }: RichTextEditorProps) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update local content when prop changes from parent
  useEffect(() => {
    setLocalContent(content);
    // Update history when content changes from parent
    if (content !== history[historyIndex]) {
      const newHistory = [...history.slice(0, historyIndex + 1), content];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [content]);

  // Auto-detect and convert URLs to markdown links
  const autoLinkUrls = (text: string): string => {
    // URL regex pattern
    const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:])/gi;
    
    return text.replace(urlPattern, (url) => {
      // Don't convert if it's already in markdown link format
      const beforeUrl = text.substring(0, text.indexOf(url));
      const afterUrl = text.substring(text.indexOf(url) + url.length);
      
      // Check if URL is already wrapped in markdown link syntax
      if (beforeUrl.endsWith('](') || beforeUrl.endsWith('[') || afterUrl.startsWith(')')) {
        return url; // Don't convert, it's already a markdown link
      }
      
      // Add protocol if missing
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Create markdown link
      return `[${url}](${fullUrl})`;
    });
  };

  // Handle local content change with auto-linking
  const handleLocalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newContent = e.target.value;
    
    // Check if user just typed a space or enter after a URL
    const cursorPosition = e.target.selectionStart;
    const lastChar = newContent[cursorPosition - 1];
    
    if (lastChar === ' ' || lastChar === '\n') {
      // Get the word before the cursor
      const beforeCursor = newContent.substring(0, cursorPosition - 1);
      const words = beforeCursor.split(/\s+/);
      const lastWord = words[words.length - 1];
      
      // Check if last word is a URL
      const urlPattern = /^(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:]$/i;
      if (urlPattern.test(lastWord)) {
        // Convert to markdown link
        const fullUrl = lastWord.startsWith('http') ? lastWord : `https://${lastWord}`;
        const markdownLink = `[${lastWord}](${fullUrl})`;
        
        // Replace the URL with markdown link
        const beforeUrl = newContent.substring(0, cursorPosition - lastWord.length - 1);
        const afterUrl = newContent.substring(cursorPosition - 1);
        newContent = beforeUrl + markdownLink + afterUrl;
        
        // Update cursor position
        setTimeout(() => {
          if (textareaRef.current) {
            const newPosition = beforeUrl.length + markdownLink.length + 1;
            textareaRef.current.setSelectionRange(newPosition, newPosition);
          }
        }, 0);
      }
    }
    
    setLocalContent(newContent);
    onChange(newContent);
    
    // Add to history only if content is different
    if (newContent !== history[historyIndex]) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newContent);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  // Handle undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLocalContent(history[newIndex]);
      onChange(history[newIndex]);
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLocalContent(history[newIndex]);
      onChange(history[newIndex]);
    }
  };

  // Key command handling for undo/redo
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl+Z (undo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    // Handle Ctrl+Shift+Z (redo)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
      e.preventDefault();
      handleRedo();
    }
    // Handle Ctrl+Y (alternative redo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
    // Handle Ctrl+K for quick link insertion
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handleFormat('link');
    }
  };

  // Format text with improved link handling
  const handleFormat = (format: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localContent.substring(start, end);
    
    let formattedText = '';
    let cursorOffset = 0;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        cursorOffset = 2;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        cursorOffset = 1;
        break;
      case 'heading':
        formattedText = `\n## ${selectedText}`;
        cursorOffset = 3;
        break;
      case 'bulletList':
        // Handle bullet list properly with spaces
        if (selectedText.includes('\n')) {
          // Multiple lines - format each line as a bullet point
          formattedText = selectedText
            .split('\n')
            .map(line => line.trim() ? `- ${line.trim()}` : '')
            .join('\n');
        } else {
          // Single line - add bullet point
          formattedText = `- ${selectedText}`;
        }
        cursorOffset = 2;
        break;
      case 'orderedList':
        // Handle ordered list properly with spaces and numbering
        if (selectedText.includes('\n')) {
          // Multiple lines - format each non-empty line as a numbered list item
          const lines = selectedText.split('\n');
          let counter = 1;
          formattedText = lines
            .map(line => {
              const trimmedLine = line.trim();
              if (trimmedLine) {
                return `${counter++}. ${trimmedLine}`;
              }
              return ''; // Empty lines remain empty
            })
            .join('\n');
        } else {
          // Single line - add number
          formattedText = `1. ${selectedText}`;
        }
        cursorOffset = 3;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        cursorOffset = 1;
        break;
      case 'link':
        // Improved link handling
        if (selectedText) {
          // Check if selected text is already a URL
          const urlPattern = /^(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:]$/i;
          if (urlPattern.test(selectedText)) {
            // Selected text is a URL, use it as both text and URL
            const fullUrl = selectedText.startsWith('http') ? selectedText : `https://${selectedText}`;
            formattedText = `[${selectedText}](${fullUrl})`;
          } else {
            // Selected text is not a URL, prompt for URL or use placeholder
            formattedText = `[${selectedText}](https://google.com)`;
          }
        } else {
          // No selection, create template
          formattedText = `[Link text](https://google.com)`;
        }
        cursorOffset = 1;
        break;
      default:
        return;
    }
    
    // Create the new content
    const newContent = localContent.substring(0, start) + formattedText + localContent.substring(end);
    
    // Update state
    setLocalContent(newContent);
    onChange(newContent);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Reset cursor position after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        if (format === 'link' && selectedText) {
          // For links, select the URL part for easy editing
          const linkStart = start + formattedText.indexOf('](') + 2;
          const linkEnd = start + formattedText.indexOf(')', linkStart);
          textareaRef.current.setSelectionRange(linkStart, linkEnd);
        } else {
          textareaRef.current.setSelectionRange(
            start + cursorOffset, 
            start + cursorOffset
          );
        }
      }
    }, 0);
  };

  // Convert all URLs to markdown links when switching to preview
  const handlePreviewToggle = () => {
    if (!isPreviewMode) {
      // Converting to preview - auto-link any remaining URLs
      const autoLinkedContent = autoLinkUrls(localContent);
      if (autoLinkedContent !== localContent) {
        setLocalContent(autoLinkedContent);
        onChange(autoLinkedContent);
      }
    }
    setIsPreviewMode(!isPreviewMode);
  };

  return (
    <div className="border border-sliate-accent/30 dark:border-gray-600 rounded-md overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 p-2 border-b border-sliate-accent/20 dark:border-gray-700 flex flex-wrap gap-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('bold')}
          className="h-8 w-8 p-0"
          type="button"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('italic')}
          className="h-8 w-8 p-0"
          type="button"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('heading')}
          className="h-8 w-8 p-0"
          type="button"
          title="Heading"
        >
          <Heading className="h-4 w-4" />
        </Button>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('bulletList')}
          className="h-8 w-8 p-0"
          type="button"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('orderedList')}
          className="h-8 w-8 p-0"
          type="button"
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('link')}
          className="h-8 w-8 p-0"
          type="button"
          title="Link (Ctrl+K)"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('code')}
          className="h-8 w-8 p-0"
          type="button"
          title="Code"
        >
          <Code className="h-4 w-4" />
        </Button>
        
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="h-8 w-8 p-0"
          type="button"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="h-8 w-8 p-0"
          type="button"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="ml-auto flex gap-1">
          <Button
            variant={!isPreviewMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            className="flex items-center gap-1"
            type="button"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant={isPreviewMode ? "default" : "outline"}
            size="sm"
            onClick={handlePreviewToggle}
            className="flex items-center gap-1"
            type="button"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>
      
      {isPreviewMode ? (
        <div className="p-3 min-h-32 dark:bg-gray-700 dark:text-white prose dark:prose-invert max-w-none">
          <MarkdownRenderer content={localContent} />
        </div>
      ) : (
        <textarea
          id="rich-text-editor"
          ref={textareaRef}
          value={localContent}
          onChange={handleLocalChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full p-3 min-h-32 focus:outline-none dark:bg-gray-700 dark:text-white resize-y"
          rows={10}
        />
      )}
    </div>
  );
};

export default RichTextEditor;