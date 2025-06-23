
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Plus, X, Calendar, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CreateNotice = () => {
  const [formData, setFormData] = useState({
    topic: "",
    description: "",
    department: "",
    category: "academic",
    priority: "medium",
    expiryDate: "",
    links: [""],
    images: [] as File[],
    attachments: [] as File[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const departments = [
    "IT",
    "Management", 
    "Accountancy",
    "Tourism & Hospitality Management",
    "Business Administration"
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLink = () => {
    if (formData.links.length < 5) {
      setFormData(prev => ({ ...prev, links: [...prev.links, ""] }));
    }
  };

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...formData.links];
    newLinks[index] = value;
    setFormData(prev => ({ ...prev, links: newLinks }));
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = formData.links.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, links: newLinks }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (formData.images.length + files.length <= 5) {
      setFormData(prev => ({ ...prev, images: [...prev.images, ...files] }));
    } else {
      toast({
        title: "Image Limit Exceeded",
        description: "You can upload maximum 5 images per notice",
        variant: "destructive"
      });
    }
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (formData.attachments.length + files.length <= 5) {
      setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...files] }));
    } else {
      toast({
        title: "Attachment Limit Exceeded", 
        description: "You can upload maximum 5 files per notice",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic || !formData.description || !formData.department) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in topic, description, and department",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Notice Created Successfully",
        description: "Your notice has been submitted for review"
      });
      navigate("/dashboard");
      setIsLoading(false);
    }, 1000);
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-sliate-dark dark:text-white">Notice Topic *</Label>
                  <Input
                    id="topic"
                    value={formData.topic}
                    onChange={(e) => handleInputChange("topic", e.target.value)}
                    placeholder="Enter notice topic"
                    className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-1">
                    <Building2 className="h-4 w-4 text-sliate-accent" />
                    <Label className="text-sliate-dark dark:text-white">Department *</Label>
                  </div>
                  <Select value={formData.department} onValueChange={(value) => handleInputChange("department", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sliate-dark dark:text-white">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter detailed description"
                  className="min-h-32 border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="administrative">Administrative</SelectItem>
                      <SelectItem value="events">Events</SelectItem>
                      <SelectItem value="latest">Latest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4 text-sliate-accent" />
                    <Label className="text-sliate-dark dark:text-white">Expiry Date</Label>
                  </div>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                    className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sliate-dark dark:text-white">Links (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLink}
                    disabled={formData.links.length >= 5}
                    className="dark:border-gray-600 dark:text-gray-300"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Link
                  </Button>
                </div>
                
                {formData.links.map((link, index) => (
                  <div key={index} className="flex space-x-2">
                    <Input
                      value={link}
                      onChange={(e) => handleLinkChange(index, e.target.value)}
                      placeholder="https://example.com"
                      className="border-sliate-accent/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveLink(index)}
                      className="dark:border-gray-600 dark:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Images (Max 5)</Label>
                  <div className="border-2 border-dashed border-sliate-accent/30 dark:border-gray-600 rounded-lg p-4">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-sliate-accent mb-2" />
                      <span className="text-sm text-sliate-accent dark:text-gray-300">
                        Upload Images ({formData.images.length}/5)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sliate-dark dark:text-white">Attachments (Max 5)</Label>
                  <div className="border-2 border-dashed border-sliate-accent/30 dark:border-gray-600 rounded-lg p-4">
                    <input
                      type="file"
                      multiple
                      onChange={handleAttachmentUpload}
                      className="hidden"
                      id="attachment-upload"
                    />
                    <label
                      htmlFor="attachment-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-8 w-8 text-sliate-accent mb-2" />
                      <span className="text-sm text-sliate-accent dark:text-gray-300">
                        Upload Files ({formData.attachments.length}/5)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <Button
                  type="submit"
                  className="bg-sliate-dark hover:bg-sliate-dark/90 text-white flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating..." : "Create Notice"}
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
