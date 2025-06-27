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
  }, [content]);

  // Handle local content change
  const handleLocalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    onChange(newContent);
    
    // Add to history
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
    // Handle Ctrl+Z or Command+Z (undo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
    // Handle Ctrl+Shift+Z or Command+Shift+Z or Ctrl+Y (redo)
    if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
        ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
      e.preventDefault();
      handleRedo();
    }
  };

  // Format text
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
        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
        cursorOffset = 2;
        break;
      case 'orderedList':
        // Check if we have multiple lines
        if (selectedText.includes('\n')) {
          // Format each line as a list item with proper spacing
          formattedText = selectedText
            .split('\n')
            .map((line, i) => `${i + 1}. ${line}`)
            .join('\n');
        } else {
          // Single line case - add proper markdown list spacing
          formattedText = `1. ${selectedText}`;
        }
        cursorOffset = selectedText.includes('\n') ? 3 : 3;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        cursorOffset = 1;
        break;
      case 'link':
        formattedText = `[${selectedText}](url)`;
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
        textareaRef.current.setSelectionRange(
          start + cursorOffset, 
          start + selectedText.length + cursorOffset
        );
      }
    }, 0);
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
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('italic')}
          className="h-8 w-8 p-0"
          type="button"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('heading')}
          className="h-8 w-8 p-0"
          type="button"
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
        >
          <List className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('orderedList')}
          className="h-8 w-8 p-0"
          type="button"
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
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleFormat('code')}
          className="h-8 w-8 p-0"
          type="button"
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
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="ml-auto flex gap-1">
          <Button
            variant={isPreviewMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPreviewMode(false)}
            className="flex items-center gap-1"
            type="button"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant={isPreviewMode ? "outline" : "default"}
            size="sm"
            onClick={() => setIsPreviewMode(true)}
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