
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Clock, ExternalLink, Download, Eye, Flag, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import AnimatedBackground from "@/components/AnimatedBackground";

interface Notice {
  id: string;
  topic: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
  department: string;
  date: string;
  expiry?: string;
  links?: string[];
  attachments?: { name: string; url: string; }[];
  images?: string[];
  views: number;
}

const NoticeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);

  // Sample data - in real app, fetch based on ID
  const sampleNotices = [
    {
      id: "1",
      topic: "Final Examination Schedule - Semester 1 2024",
      description: "All students are hereby notified that the final examinations for Semester 1, 2024 will commence on January 15, 2024. Students must report to their respective examination halls 30 minutes before the scheduled time. Please bring your student ID card and necessary stationery. The examination will be conducted in strict accordance with the university guidelines. Any form of malpractice will result in immediate disqualification. Students are advised to check the examination timetable carefully and prepare accordingly. For any queries regarding the examination schedule, please contact the academic office during working hours.",
      priority: "high" as const,
      category: "Academic",
      department: "IT",
      date: "2024-01-08",
      expiry: "2024-01-14",
      views: 1247,
      links: ["https://sliate.ac.lk/exam-schedule", "https://sliate.ac.lk/exam-guidelines"],
      attachments: [
        { name: "Exam_Schedule_Sem1_2024.pdf", url: "#" },
        { name: "Exam_Guidelines.pdf", url: "#" },
        { name: "Student_Instructions.pdf", url: "#" }
      ],
      images: [
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=400&fit=crop",
        "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=400&fit=crop",
        "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&h=400&fit=crop"
      ]
    },
    {
      id: "2",
      topic: "Workshop on Emerging Technologies in IT",
      description: "Department of Information Technology is organizing a workshop on 'Emerging Technologies in IT' featuring industry experts. This is an excellent opportunity for students to learn about latest trends in AI, Blockchain, and Cloud Computing.",
      priority: "medium" as const,
      category: "Upcoming Events",
      department: "IT",
      date: "2024-01-07",
      views: 892,
      links: ["https://sliate.ac.lk/workshop-registration"],
      images: [
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop",
        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&h=400&fit=crop"
      ]
    },
    {
      id: "3",
      topic: "Library Hours Extension During Exam Period",
      description: "The library will extend its operating hours during the examination period from January 10-25, 2024. New timings: Monday to Friday 7:00 AM - 10:00 PM, Saturday 8:00 AM - 8:00 PM, Sunday 9:00 AM - 6:00 PM.",
      priority: "low" as const,
      category: "Administrative",
      department: "Management",
      date: "2024-01-06",
      views: 456,
      expiry: "2024-01-25"
    }
  ];

  useEffect(() => {
    const foundNotice = sampleNotices.find(n => n.id === id);
    setNotice(foundNotice || null);
  }, [id]);

  if (!notice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 relative">
        <AnimatedBackground />
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-sliate-dark dark:text-white mb-4">Notice Not Found</h1>
            <Button onClick={() => navigate('/')} className="bg-sliate-accent hover:bg-sliate-accent/90 text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800";
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 relative">
      <AnimatedBackground />
      <Header />
      
      {/* Parallax Header */}
      <div className="relative h-96 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-fixed transform scale-105"
          style={{
            backgroundImage: notice.images && notice.images.length > 0 
              ? `url(${notice.images[0]})` 
              : `url(https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=600&fit=crop)`
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              {notice.topic}
            </h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl">
              You cannot hide the soul. Through all his unearthly tattooings, I thought I saw the traces of a simple honest heart.
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/')} 
            variant="outline" 
            className="mb-4 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Card className="bg-white dark:bg-gray-800 dark:border-gray-600 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <div className="flex flex-wrap gap-2">
                <Badge className={`${getPriorityColor(notice.priority)} text-sm font-medium`}>
                  <Flag className="h-3 w-3 mr-1" />
                  {notice.priority.toUpperCase()} PRIORITY
                </Badge>
                <Badge variant="outline" className="text-sm border-sliate-accent/30 text-sliate-accent dark:border-sliate-light/30 dark:text-sliate-light">
                  {notice.category}
                </Badge>
                <Badge variant="outline" className="text-sm border-sliate-dark/30 text-sliate-dark dark:border-gray-400 dark:text-gray-300">
                  {notice.department}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-sliate-accent dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{notice.date}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>{notice.views}</span>
                </div>
                <Button variant="outline" size="sm" className="dark:border-gray-600 dark:text-gray-300">
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>

            {notice.expiry && (
              <div className="flex items-center space-x-1 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg mb-6">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Expires: {notice.expiry}</span>
              </div>
            )}

            <div className="prose max-w-none dark:prose-invert">
              <p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
                {notice.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Images Gallery */}
        {notice.images && notice.images.length > 0 && (
          <Card className="bg-white dark:bg-gray-800 dark:border-gray-600 mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-sliate-dark dark:text-white mb-4">Images</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notice.images.map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`Notice image ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border border-sliate-accent/20 dark:border-gray-600 hover:scale-105 transition-transform duration-200"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Links and Downloads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {notice.links && notice.links.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 dark:border-gray-600">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-sliate-dark dark:text-white mb-4 flex items-center">
                  <ExternalLink className="h-5 w-5 mr-2" />
                  External Links
                </h3>
                <div className="space-y-3">
                  {notice.links.map((link, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start border-sliate-accent text-sliate-accent hover:bg-sliate-accent hover:text-white dark:border-sliate-light dark:text-sliate-light dark:hover:bg-sliate-light dark:hover:text-sliate-dark"
                      asChild
                    >
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Link {index + 1}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {notice.attachments && notice.attachments.length > 0 && (
            <Card className="bg-white dark:bg-gray-800 dark:border-gray-600">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-sliate-dark dark:text-white mb-4 flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  Downloads
                </h3>
                <div className="space-y-3">
                  {notice.attachments.map((file, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start border-sliate-dark text-sliate-dark hover:bg-sliate-dark hover:text-white dark:border-gray-400 dark:text-gray-300 dark:hover:bg-gray-600"
                      asChild
                    >
                      <a href={file.url} download>
                        <Download className="h-4 w-4 mr-2" />
                        {file.name}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default NoticeDetails;
