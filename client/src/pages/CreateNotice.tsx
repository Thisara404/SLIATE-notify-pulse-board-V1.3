import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload, Building2, Calendar, FileImage, File, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { noticeService } from "@/services/noticeApi";
import RichTextEditor from '@/components/RichTextEditor';
import NoticeTemplates from '@/components/NoticeTemplates';

const CreateNotice = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "draft",
    imageFile: null as File | null,
    files: [] as File[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
      if (formData.files.length + newFiles.length > 5) {
        toast({
          title: "Too Many Files",
          description: "You can upload a maximum of 5 files",
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

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageFile: null }));
  };

  // Add simple text sanitizing before submission
  const sanitizeText = (text: string) => {
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

    const sanitizedTitle = sanitizeText(formData.title);
    const sanitizedDescription = sanitizeText(formData.description);

    const submitData = new FormData();
    submitData.append('title', sanitizedTitle);
    submitData.append('description', sanitizedDescription);
    submitData.append('priority', formData.priority);
    submitData.append('status', formData.status);

    if (formData.imageFile) {
      submitData.append('image', formData.imageFile);
    }

    formData.files.forEach((file) => {
      submitData.append('files', file);
    });

    setIsLoading(true);

    try {
      const response = await noticeService.createNotice(submitData);
      toast({
        title: 'Notice Created',
        description: 'Your notice has been successfully created.',
      });
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create notice',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">Create Notice</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="border-sliate-accent/20 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-sliate-dark dark:text-white">New Notice Details</CardTitle>
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

              <div className="flex justify-end mb-2">
                <NoticeTemplates onSelectTemplate={(template) => handleInputChange("description", template)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sliate-dark dark:text-white">Featured Image (Optional)</Label>
                
                {formData.imageFile ? (
                  <div className="border border-sliate-accent/30 dark:border-gray-600 rounded-md p-4 relative">
                    <div className="flex items-center space-x-2">
                      <FileImage className="h-5 w-5 text-sliate-accent" />
                      <span className="text-sm text-sliate-dark dark:text-white">{formData.imageFile.name}</span>
                      <span className="text-xs text-gray-500">
                        {(formData.imageFile.size / (1024 * 1024)).toFixed(2)}MB
                      </span>
                    </div>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    
                    {/* Preview image if it's an image */}
                    {formData.imageFile.type.startsWith('image/') && (
                      <div className="mt-2">
                        <img 
                          src={URL.createObjectURL(formData.imageFile)}
                          alt="Preview"
                          className="max-h-40 rounded-md"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-sliate-accent/30 dark:border-gray-600 rounded-md p-8 text-center">
                    <FileImage className="h-8 w-8 text-sliate-accent mx-auto mb-2" />
                    <p className="text-sm text-sliate-dark dark:text-white mb-2">Drag and drop or click to upload</p>
                    <p className="text-xs text-gray-500 mb-4">Max file size: 5MB</p>
                    
                    <Input
                      id="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      className="border-sliate-accent/30 dark:border-gray-600"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Select Image
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sliate-dark dark:text-white">Attachments (Optional)</Label>
                  <span className="text-xs text-gray-500">{formData.files.length}/5 files</span>
                </div>
                
                <div className="border border-dashed border-sliate-accent/30 dark:border-gray-600 rounded-md p-4">
                  {formData.files.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {formData.files.map((file, index) => (
                        <div 
                          key={`${file.name}-${index}`} 
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                        >
                          <div className="flex items-center space-x-2">
                            <File className="h-4 w-4 text-sliate-accent" />
                            <span className="text-sm text-sliate-dark dark:text-white">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              {(file.size / (1024 * 1024)).toFixed(2)}MB
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formData.files.length < 5 && (
                    <div className="text-center py-4">
                      <File className="h-8 w-8 text-sliate-accent mx-auto mb-2" />
                      <p className="text-sm text-sliate-dark dark:text-white mb-2">
                        Drag and drop or click to upload attachments
                      </p>
                      <p className="text-xs text-gray-500 mb-4">Max 5 files, 10MB each</p>
                      
                      <Input
                        id="file-upload"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        className="border-sliate-accent/30 dark:border-gray-600"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Files
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  type="submit"
                  className="bg-sliate-dark hover:bg-sliate-dark/90 text-white flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Notice...</span>
                    </div>
                  ) : (
                    "Create Notice"
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

export default CreateNotice;
