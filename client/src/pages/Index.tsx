import { useState, useEffect } from "react";
import { Search, Calendar, Mail, Phone, MapPin, Clock, Bell, Users, BookOpen, Award } from "lucide-react";
import Header from "@/components/Header";
import VisitorStats from "@/components/VisitorStats";
import NoticeFilters from "@/components/NoticeFilters";
import NoticeCard from "@/components/NoticeCard";
import AnimatedBackground from "@/components/AnimatedBackground";
import EducationalBackground from "@/components/EducationalBackground";
import LoadingSpinner from "@/components/LoadingSpinner";
import HorizontalPagination from "@/components/HorizontalPagination";
import MouseClickEffect from "@/components/MouseClickEffect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [filters, setFilters] = useState({
    time: "today",
    priority: "all",
    category: "all",
    department: "all"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const noticesPerPage = 3;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const upcomingEvents = [
    {
      id: "1",
      title: "Technology Innovation Fair",
      date: "January 25, 2024",
      description: "Annual tech fair showcasing student innovations"
    },
    {
      id: "2", 
      title: "Career Guidance Workshop",
      date: "February 2, 2024",
      description: "Professional development workshop for final year students"
    },
    {
      id: "3",
      title: "Research Symposium",
      date: "February 15, 2024", 
      description: "Academic research presentations and discussions"
    }
  ];

  const handleFilterChange = (newFilters: { time: string; priority: string; category: string; department: string }) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Filter notices based on search query
  const filteredNotices = sampleNotices.filter(notice =>
    notice.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notice.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notice.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate pagination
  const totalPages = Math.ceil(filteredNotices.length / noticesPerPage);
  const startIndex = (currentPage - 1) * noticesPerPage;
  const endIndex = startIndex + noticesPerPage;
  const currentNotices = filteredNotices.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <LoadingSpinner />
      <AnimatedBackground />
      <EducationalBackground />
      <MouseClickEffect />
      <Header />
      
      {/* Parallax Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-sliate-dark via-sliate-accent to-sliate-light dark:from-gray-900 dark:via-gray-800 dark:to-gray-700"
          style={{
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
        />
        <div 
          className="absolute inset-0 bg-black/20 dark:bg-black/40"
          style={{
            transform: `translateY(${scrollY * 0.3}px)`,
          }}
        />
        
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <div 
            className="mb-8"
            style={{
              transform: `translateY(${scrollY * 0.2}px)`,
            }}
          >
            <img 
              src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
              alt="SLIATE Logo" 
              className="h-20 w-20 mx-auto mb-6 drop-shadow-lg"
            />
            <h1 className="text-5xl md:text-7xl font-bold mb-4 drop-shadow-lg">
              SLIATE NOTIFY
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90 drop-shadow-md">
              Sri Lanka Institute of Advanced Technological Education
            </p>
            <p className="text-lg opacity-80 max-w-2xl mx-auto leading-relaxed">
              Stay updated with official announcements, notices, and important information from SLIATE Kandy
            </p>
          </div>

          {/* Stats Cards with Parallax */}
          <div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
            style={{
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          >
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <div className="text-2xl font-bold">5,000+</div>
              <div className="text-sm opacity-80">Students</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <BookOpen className="h-8 w-8 mx-auto mb-2" />
              <div className="text-2xl font-bold">25+</div>
              <div className="text-sm opacity-80">Courses</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <Award className="h-8 w-8 mx-auto mb-2" />
              <div className="text-2xl font-bold">15+</div>
              <div className="text-sm opacity-80">Years</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/20">
              <Bell className="h-8 w-8 mx-auto mb-2" />
              <div className="text-2xl font-bold">200+</div>
              <div className="text-sm opacity-80">Notices</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
          <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <VisitorStats />

        {/* Latest Notices Section */}
        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="h-6 w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-3xl font-bold text-sliate-dark dark:text-white">Official Notices</h2>
          </div>
          <p className="text-sliate-accent dark:text-gray-300 mb-8">
            Stay updated with the latest announcements and important information
          </p>
          
          <NoticeFilters onFilterChange={handleFilterChange} />

          {/* Search Section - Moved here */}
          <Card className="mb-6 bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                <h3 className="font-semibold text-sliate-dark dark:text-white">Search Notices</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sliate-accent dark:text-gray-400 h-5 w-5" />
                  <Input
                    type="text"
                    placeholder="Search by title, description, category, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-base border-sliate-accent/30 focus:border-sliate-accent dark:border-gray-600 dark:focus:border-sliate-light dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <Button 
                  className="bg-sliate-accent hover:bg-sliate-accent/90 text-white px-8 h-12 dark:bg-sliate-light dark:text-sliate-dark dark:hover:bg-sliate-light/90 sm:min-w-0 w-full sm:w-auto"
                  onClick={() => {
                    // Optional: Add search button functionality or just keep it for visual purposes
                    console.log("Search:", searchQuery);
                  }}
                >
                  <Search className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Search</span>
                </Button>
              </div>
              {searchQuery && (
                <div className="mt-3 text-sm text-sliate-accent dark:text-gray-400">
                  {filteredNotices.length} notice{filteredNotices.length !== 1 ? 's' : ''} found for "{searchQuery}"
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
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
                  <p className="text-sliate-accent dark:text-gray-300">
                    {searchQuery ? "No notices match your search criteria." : "No notices match your current filter criteria."}
                  </p>
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
        </section>

        {/* Upcoming Events Section */}
        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <Calendar className="h-6 w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-3xl font-bold text-sliate-dark dark:text-white">Upcoming Events</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calendar className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                    <span className="text-sm text-sliate-accent dark:text-gray-300">{event.date}</span>
                  </div>
                  <h3 className="font-bold text-lg text-sliate-dark dark:text-white mb-2">{event.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{event.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Contact Section */}
        <section className="mb-16">
          <div className="flex items-center space-x-3 mb-6">
            <Mail className="h-6 w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-3xl font-bold text-sliate-dark dark:text-white">Contact</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="text-sliate-dark dark:text-white">Get in Touch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <span className="text-sliate-dark dark:text-gray-300">+94 81 2 388 400</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <span className="text-sliate-dark dark:text-gray-300">info@sliate.ac.lk</span>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-sliate-accent dark:text-sliate-light mt-1" />
                  <span className="text-sliate-dark dark:text-gray-300">
                    No. 123, Peradeniya Road<br />
                    Kandy 20000, Sri Lanka
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="text-sliate-dark dark:text-white">Office Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <div>
                    <div className="text-sliate-dark dark:text-gray-300 font-medium">Monday - Friday</div>
                    <div className="text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <div>
                    <div className="text-sliate-dark dark:text-gray-300 font-medium">Saturday</div>
                    <div className="text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 12:00 PM</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <div>
                    <div className="text-sliate-dark dark:text-gray-300 font-medium">Sunday</div>
                    <div className="text-sm text-sliate-accent dark:text-gray-400">Closed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-sliate-dark dark:bg-gray-900 text-white py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
                  alt="SLIATE Logo" 
                  className="h-10 w-10"
                />
                <h3 className="text-xl font-semibold">SLIATE Notify</h3>
              </div>
              <p className="text-sliate-accent dark:text-gray-300 mb-4 leading-relaxed">
                Sri Lanka Institute of Advanced Technological Education - Kandy is committed to providing quality technical education and fostering innovation among students.
              </p>
              <p className="text-sm text-sliate-accent dark:text-gray-400">
                Official Public Notice Board System
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Academic Calendar</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Course Information</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Student Portal</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Library</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Admission Guidelines</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Examination Results</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Career Services</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Alumni Network</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-sliate-accent/20 dark:border-gray-700 mt-8 pt-8 text-center">
            <p className="text-sm text-sliate-accent dark:text-gray-400">
              © 2024 SLIATE Kandy. All rights reserved. | Developed for educational purposes.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
