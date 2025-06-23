
import { useState } from "react";
import Header from "@/components/Header";
import VisitorStats from "@/components/VisitorStats";
import NoticeFilters from "@/components/NoticeFilters";
import NoticeCard from "@/components/NoticeCard";
import AnimatedBackground from "@/components/AnimatedBackground";
import EducationalBackground from "@/components/EducationalBackground";
import LoadingSpinner from "@/components/LoadingSpinner";
import HorizontalPagination from "@/components/HorizontalPagination";
import MouseClickEffect from "@/components/MouseClickEffect";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";

const Index = () => {
  const [filters, setFilters] = useState({
    time: "today",
    priority: "all",
    category: "all",
    department: "all"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const noticesPerPage = 3;

  // Sample notices data
  const sampleNotices = [
    {
      id: "1",
      topic: "Final Examination Schedule - Semester 1 2024",
      description: "All students are hereby notified that the final examinations for Semester 1, 2024 will commence on January 15, 2024. Students must report to their respective examination halls 30 minutes before the scheduled time. Please bring your student ID card and necessary stationery.",
      priority: "high" as const,
      category: "Academic",
      department: "IT",
      date: "2024-01-08",
      expiry: "2024-01-14",
      views: 1247,
      links: ["https://sliate.ac.lk/exam-schedule"],
      attachments: [
        { name: "Exam_Schedule_Sem1_2024.pdf", url: "#" },
        { name: "Exam_Guidelines.pdf", url: "#" }
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
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",
        "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=300&fit=crop"
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
    },
    {
      id: "4",
      topic: "Student Registration for Semester 2",
      description: "All students are required to complete their registration for Semester 2, 2024 by January 20, 2024. Late registrations will incur additional fees.",
      priority: "high" as const,
      category: "Administrative",
      department: "Management",
      date: "2024-01-05",
      views: 2103,
      expiry: "2024-01-20"
    },
    {
      id: "5",
      topic: "Career Fair 2024",
      description: "Annual career fair featuring top employers from various industries. Students can explore internship and job opportunities.",
      priority: "medium" as const,
      category: "Upcoming Events",
      department: "Business Administration",
      date: "2024-01-04",
      views: 1567,
      images: ["https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=300&fit=crop"]
    },
    {
      id: "6",
      topic: "New Course Introduction: Digital Marketing",
      description: "Department of Business Administration is introducing a new course on Digital Marketing starting from next semester.",
      priority: "low" as const,
      category: "Academic",
      department: "Business Administration",
      date: "2024-01-03",
      views: 834
    }
  ];

  const handleFilterChange = (newFilters: { time: string; priority: string; category: string; department: string }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
    console.log("Filter changed:", newFilters);
  };

  // Calculate pagination
  const totalPages = Math.ceil(sampleNotices.length / noticesPerPage);
  const startIndex = (currentPage - 1) * noticesPerPage;
  const endIndex = startIndex + noticesPerPage;
  const currentNotices = sampleNotices.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 relative">
      <LoadingSpinner />
      <AnimatedBackground />
      <EducationalBackground />
      <MouseClickEffect />
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center space-x-3 mb-2">
            <Bell className="h-6 w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-2xl font-bold text-sliate-dark dark:text-white">Latest Notices</h2>
          </div>
          <p className="text-sliate-accent dark:text-gray-300">Stay updated with official announcements from SLIATE Kandy</p>
        </div>

        <div className="animate-slide-in">
          <VisitorStats />
          <NoticeFilters onFilterChange={handleFilterChange} />
        </div>

        <div className="space-y-4">
          {currentNotices.length > 0 ? (
            currentNotices.map((notice, index) => (
              <div 
                key={notice.id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <NoticeCard notice={notice} />
              </div>
            ))
          ) : (
            <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 text-sliate-accent dark:text-sliate-light mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold text-sliate-dark dark:text-white mb-2">No Notices Found</h3>
                <p className="text-sliate-accent dark:text-gray-300">No notices match your current filter criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {totalPages > 1 && (
          <HorizontalPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </main>

      <footer className="bg-sliate-dark dark:bg-gray-900 text-white py-8 mt-12 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-2">
              <img 
                src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
                alt="SLIATE Logo" 
                className="h-8 w-8"
              />
              <h3 className="text-lg font-semibold">SLIATE Notify</h3>
            </div>
            <p className="text-sliate-accent dark:text-gray-300 mb-4">
              Sri Lanka Institute of Advanced Technological Education - Kandy
            </p>
            <p className="text-sm text-sliate-accent dark:text-gray-400">
              Official Public Notice Board System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
