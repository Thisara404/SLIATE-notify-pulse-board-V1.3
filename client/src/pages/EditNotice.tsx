import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, X, File, Loader2, Save, Eye } from "lucide-react";
import { noticeService, Notice } from "@/services/noticeApi";
import RichTextEditor from '@/components/RichTextEditor';
import NoticeTemplates from '@/components/NoticeTemplates';
import NoticeContent from '@/components/NoticeContent';

const EditNotice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "draft",
    imageFile: null as File | null,
    files: [] as File[],
    existingImageUrl: "",
    existingFiles: [] as Array<{ name: string; url: string; size?: number; type?: string }>
  });

  useEffect(() => {
    if (id) {
      fetchNotice(id);
    }
  }, [id]);

  const fetchNotice = async (noticeId: string) => {
    try {
      setIsLoading(true);
      const response = await noticeService.getNoticeById(noticeId);
      const noticeData = response.data.notice;

      // Store the entire notice
      setNotice(noticeData);

      // Helper function to extract description text
      const getDescriptionText = (description: any): string => {
        if (typeof description === 'string') {
          return description;
        }

        // Use TextDecoder to decode binary data
        const decodeBinaryData = (data: Uint8Array): string => {
          const decoder = new TextDecoder("utf-8");
          return decoder.decode(data);
        };

        if (description && description.type === 'Buffer' && Array.isArray(description.data)) {
          return decodeBinaryData(new Uint8Array(description.data));
        }

        return description?.toString() || "No description available";
      };

      setFormData({
        title: noticeData.title || "",
        description: getDescriptionText(noticeData.description),
        priority: noticeData.priority || "medium",
        status: noticeData.status || "draft",
        imageFile: null,
        files: [],
        existingImageUrl: noticeData.imageUrl || "",
        existingFiles: Array.isArray(noticeData.files) ? noticeData.files : []
      });
    } catch (error) {
      console.error("Failed to fetch notice:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch notice",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Image Too Large",
          description: "Image size should not exceed 5MB",
          variant: "destructive"
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }
      
      setFormData(prev => ({ ...prev, imageFile: file }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length > 0) {
      // Check if total files don't exceed max (5)
      const totalFiles = formData.files.length + formData.existingFiles.length + newFiles.length;
      if (totalFiles > 5) {
        toast({
          title: "Too Many Files",
          description: "You can upload a maximum of 5 files total",
          variant: "destructive"
        });
        return;
      }
      
      // Check each file size (max 10MB)
      const oversizedFiles = newFiles.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        toast({
          title: "Files Too Large",
          description: "Each file should not exceed 10MB in size",
          variant: "destructive"
        });
        return;
      }
      
      setFormData(prev => ({ 
        ...prev, 
        files: [...prev.files, ...newFiles] 
      }));
    }
  };

  const handleRemoveNewFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveExistingFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      existingFiles: prev.existingFiles.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageFile: null, existingImageUrl: "" }));
  };

  // Fix the sanitizeText function
  const sanitizeText = (text: string | undefined) => {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .replace(/'/g, "''") // Escape single quotes
      .replace(/;/g, '')   // Remove semicolons
      .replace(/--/g, '')  // Remove SQL comments
      .replace(/select/gi, 'sel-ect')
      .replace(/update/gi, 'up-date')
      .replace(/delete/gi, 'del-ete')
      .replace(/drop/gi, 'dr-op');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id) return;

    const sanitizedTitle = sanitizeText(formData.title);
    const sanitizedDescription = sanitizeText(formData.description);

    const submitData = new FormData();
    submitData.append('title', sanitizedTitle);
    submitData.append('description', sanitizedDescription);
    submitData.append('priority', formData.priority);
    submitData.append('status', formData.status);

    // Handle image update
    if (formData.imageFile) {
      submitData.append('image', formData.imageFile);
    } else if (formData.existingImageUrl) {
      submitData.append('existingImageUrl', formData.existingImageUrl);
    }

    // Handle existing files
    if (formData.existingFiles.length > 0) {
      submitData.append('existingFiles', JSON.stringify(formData.existingFiles));
    }

    // Handle new files
    formData.files.forEach((file) => {
      submitData.append('files', file);
    });

    setIsSaving(true);

    try {
      const response = await noticeService.updateNotice(id, submitData);
      toast({
        title: 'Notice Updated',
        description: 'Your notice has been successfully updated.',
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update notice',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-sliate-accent" />
          <h2 className="text-xl font-semibold text-sliate-dark dark:text-white">Loading Notice...</h2>
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-300">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 mb-4">Notice not found</p>
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
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
                <Link to="/dashboard" className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </Link>
              </Button>
              <div className="h-6 w-px bg-sliate-accent/30"></div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Edit Notice</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                asChild
                className="flex items-center space-x-2"
              >
                <Link to={`/notice/${notice.id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  <span>Preview</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="border-sliate-accent/20 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sliate-dark dark:text-white">Edit Notice Details</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge 
                  className={`${
                    notice.status === 'published' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {notice.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
                <Badge 
                  className={`${
                    notice.priority === 'high' 
                      ? 'bg-red-100 text-red-800' 
                      : notice.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {notice.priority.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sliate-dark dark:text-white">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Enter notice title"
                  className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sliate-dark dark:text-white">Description *</Label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(value) => handleInputChange("description", value)}
                  placeholder="Enter notice description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Save as Draft</SelectItem>
                      <SelectItem value="published">Publish Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Image Section */}
              <div className="space-y-2">
                <Label className="text-sliate-dark dark:text-white">Featured Image (Optional)</Label>
                
                {formData.existingImageUrl && !formData.imageFile ? (
                  <div className="border border-sliate-accent/20 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-sliate-accent dark:text-gray-400">Current Image:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveImage}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <img 
                      src={`http://localhost:5000${formData.existingImageUrl.startsWith('/') ? '' : '/'}${formData.existingImageUrl}`}
                      alt="Current notice image"
                      className="max-w-full max-h-48 object-contain rounded-md"
                      onError={(e) => {
                        // Try alternative path if first fails
                        const target = e.target as HTMLImageElement;
                        const baseUrl = 'http://localhost:5000';
                        const imagePath = formData.existingImageUrl;
                        
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
                ) : formData.imageFile ? (
                  <div className="border border-sliate-accent/20 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-sliate-accent dark:text-gray-400">New Image Selected:</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, imageFile: null }))}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formData.imageFile.name} ({(formData.imageFile.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-sliate-accent/30 dark:border-gray-600 rounded-md p-4">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-sliate-accent dark:text-gray-400 mb-2" />
                      <span className="text-sm text-sliate-accent dark:text-gray-400">
                        Click to upload new image (Max 5MB)
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Files Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sliate-dark dark:text-white">
                    Attachments (Optional) - {formData.files.length + formData.existingFiles.length}/5
                  </Label>
                  {(formData.files.length + formData.existingFiles.length) < 5 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                      <Upload className="h-4 w-4 mr-1" />
                      Add Files
                    </Button>
                  )}
                </div>
                
                {/* Existing Files */}
                {formData.existingFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-sliate-accent dark:text-gray-400">Current Files:</span>
                    {formData.existingFiles.map((file, index) => (
                      <div key={`existing-${index}`} className="flex items-center justify-between p-2 border border-sliate-accent/20 rounded">
                        <div className="flex items-center space-x-2">
                          <File className="h-4 w-4 text-sliate-accent" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveExistingFile(index)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Files */}
                {formData.files.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-sliate-accent dark:text-gray-400">New Files:</span>
                    {formData.files.map((file, index) => (
                      <div key={`new-${index}`} className="flex items-center justify-between p-2 border border-green-200 rounded bg-green-50">
                        <div className="flex items-center space-x-2">
                          <File className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveNewFile(index)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  type="submit"
                  className="bg-sliate-dark hover:bg-sliate-dark/90 text-white flex-1"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Update Notice</span>
                    </div>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditNotice;