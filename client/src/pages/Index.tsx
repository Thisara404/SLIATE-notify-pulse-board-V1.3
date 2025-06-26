import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
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

// Add this type definition at the top to match your API response
interface Notice {
  id: string | number;
  title: string;
  description: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  slug: string;
  publishedAt?: string;
  creatorName?: string;
  viewCount?: number;
  uniqueViewers?: number;
  files?: Array<{ name: string; url: string; size?: number; type?: string }>;
}

const upcomingEvents = [
  {
    id: 1,
    title: "Annual Tech Exhibition",
    date: "August 15, 2024",
    description: "Showcase of innovative projects by SLIATE students featuring the latest technologies and research."
  },
  {
    id: 2,
    title: "Orientation Day",
    date: "September 10, 2024",
    description: "Welcome program for new students joining SLIATE for the upcoming academic year."
  },
  {
    id: 3,
    title: "Career Development Workshop",
    date: "October 5, 2024",
    description: "Industry experts will provide guidance on career opportunities and professional development."
  }
];

const Index = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    priority: null as string | null,
    search: "",
    timePeriod: null as string | null,
    category: null as string | null,
    department: null as string | null,
    sortBy: "priority",
    sortOrder: "ASC" // ASC for priority means high first
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [returnedFromNotice, setReturnedFromNotice] = useState(false);
  const noticeListRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    fetchPublicNotices();
  }, [filters]);

  useEffect(() => {
    // Check if we're returning from a notice detail page
    if (location.state && location.state.fromNoticeDetail) {
      setReturnedFromNotice(true);
    }
  }, [location]);

  useEffect(() => {
    if (returnedFromNotice && noticeListRef.current && !isLoading) {
      noticeListRef.current.scrollIntoView({ behavior: 'smooth' });
      setReturnedFromNotice(false);
    }
  }, [returnedFromNotice, isLoading]);

  const fetchPublicNotices = async () => {
    try {
      setIsLoading(true);
      
      // Build query params
      const queryParams = new URLSearchParams();
      queryParams.append('page', filters.page.toString());
      queryParams.append('limit', filters.limit.toString());
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.timePeriod) queryParams.append('timePeriod', filters.timePeriod);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.department) queryParams.append('department', filters.department);
      queryParams.append('sortBy', filters.sortBy);
      queryParams.append('sortOrder', filters.sortOrder);
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/public/notices?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch notices");
      }
      
      const data = await response.json();
      
      setNotices(data.data.notices);
      setPagination({
        page: parseInt(data.data.pagination.page) || 1,
        limit: parseInt(data.data.pagination.limit) || 10,
        total: parseInt(data.data.pagination.total) || 0,
        totalPages: parseInt(data.data.pagination.totalPages) || 1
      });
    } catch (error) {
      console.error("Failed to fetch public notices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handleSearch = (query: string) => {
    setFilters(prev => ({
      ...prev,
      search: query,
      page: 1
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrollY, setScrollY] = useState(0);
  const noticesPerPage = 3;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update the search functionality to work with real notices
  const handleSearchSubmit = () => {
    if (searchQuery.trim() === '') {
      // If search query is empty, clear search filters
      setFilters(prev => ({
        ...prev,
        search: "",
        page: 1
      }));
    } else {
      // Otherwise, perform search
      handleSearch(searchQuery);
    }
  };

  // Add a function to clear the search
  const handleClearSearch = () => {
    setSearchQuery("");
    setFilters(prev => ({
      ...prev,
      search: "",
      page: 1
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <LoadingSpinner />
      <AnimatedBackground />
      <EducationalBackground />
      <MouseClickEffect />
      <Header />
      
      {/* Parallax Hero Section with adjusted responsive height */}
      <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden py-16">
        {/* Replace the gradient background with the image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/header.png')`,
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
        />
        <div 
          className="absolute inset-0 bg-black/30 dark:bg-black/50"
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
            {/* Responsive logo size and spacing with rounded border */}
            <img 
              src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
              alt="SLIATE Logo" 
              className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 sm:mb-6 drop-shadow-lg rounded-lg border-4 border-white/30"
            />
            {/* Responsive heading sizes */}
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-2 sm:mb-4 drop-shadow-lg">
              SLIATE NOTIFY
            </h1>
            <p className="text-base sm:text-xl md:text-2xl mb-4 sm:mb-8 opacity-90 drop-shadow-md">
              Sri Lanka Institute of Advanced Technological Education
            </p>
            <p className="text-sm sm:text-lg opacity-80 max-w-2xl mx-auto leading-relaxed">
              Stay updated with official announcements, notices, and important information from SLIATE Kandy
            </p>
          </div>

          {/* Stats Cards - Adjusted for better responsiveness */}
          <div 
            className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-12"
            style={{
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          >
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-4 border border-white/20">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">100K+</div>
              <div className="text-xs sm:text-sm opacity-80">Students</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-4 border border-white/20">
              <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">15+</div>
              <div className="text-xs sm:text-sm opacity-80">Courses</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-4 border border-white/20">
              <Award className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">30+</div>
              <div className="text-xs sm:text-sm opacity-80">Years</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-4 border border-white/20">
              <Bell className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-lg sm:text-2xl font-bold">200K+</div>
              <div className="text-xs sm:text-sm opacity-80">Notices</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator - Fixed for better mobile centering */}
        <div 
          className="absolute bottom-8 w-full flex justify-center text-white animate-bounce"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium mb-2 tracking-wide">Scroll Down</span>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute top-3 left-0 opacity-50">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <VisitorStats />

        {/* Latest Notices Section - Add ref here */}
        <section className="mb-16" ref={noticeListRef}>
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="h-6 w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-3xl font-bold text-sliate-dark dark:text-white">Official Notices</h2>
          </div>
          <p className="text-sliate-accent dark:text-gray-300 mb-8">
            Stay updated with the latest announcements and important information
          </p>
          
          <NoticeFilters onFilterChange={handleFilterChange} />

          {/* Search Section */}
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
                    placeholder="Search by title, description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchSubmit();
                      }
                    }}
                    className="pl-10 h-12 text-base border-sliate-accent/30 focus:border-sliate-accent dark:border-gray-600 dark:focus:border-sliate-light dark:bg-gray-700 dark:text-white"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      aria-label="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
                {filters.search ? (
                  <Button 
                    className="bg-red-500 hover:bg-red-600 text-white px-8 h-12 dark:bg-red-600 dark:hover:bg-red-700 sm:min-w-0 w-full sm:w-auto"
                    onClick={handleClearSearch}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">Clear Search</span>
                  </Button>
                ) : (
                  <Button 
                    className="bg-sliate-accent hover:bg-sliate-accent/90 text-white px-8 h-12 dark:bg-sliate-light dark:text-sliate-dark dark:hover:bg-sliate-light/90 sm:min-w-0 w-full sm:w-auto"
                    onClick={handleSearchSubmit}
                  >
                    <Search className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Search</span>
                  </Button>
                )}
              </div>
              {filters.search && (
                <div className="mt-3 text-sm text-sliate-accent dark:text-gray-400">
                  {pagination.total} notice{pagination.total !== 1 ? 's' : ''} found for "{filters.search}"
                  <button 
                    onClick={handleClearSearch}
                    className="ml-2 underline text-sliate-accent hover:text-sliate-dark dark:text-sliate-light dark:hover:text-white"
                  >
                    View all notices
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-sliate-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sliate-accent dark:text-gray-300">Loading notices...</p>
              </div>
            ) : notices.length > 0 ? (
              notices.map((notice, index) => (
                <div 
                  key={notice.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <NoticeCard 
                    notice={{
                      id: notice.id.toString(),
                      topic: notice.title,
                      description: notice.description,
                      priority: notice.priority as 'high' | 'medium' | 'low',
                      date: notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : '',
                      views: notice.viewCount, // Make sure to pass the viewCount properly
                      category: 'General',
                      department: 'SLIATE',
                      images: notice.imageUrl ? [`${import.meta.env.VITE_API_BASE_URL.replace('/api', '')}${notice.imageUrl}`] : undefined,
                      attachments: notice.files || undefined
                    }} 
                    slug={notice.slug}
                  />
                </div>
              ))
            ) : (
              <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
                <CardContent className="p-8 text-center">
                  <Bell className="h-12 w-12 text-sliate-accent dark:text-sliate-light mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-sliate-dark dark:text-white mb-2">No Notices Found</h3>
                  <p className="text-sliate-accent dark:text-gray-300">
                    {filters.search ? "No notices match your search criteria." : "No notices match your current filter criteria."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <HorizontalPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
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
                    <div className="text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-sliate-accent dark:text-sliate-light" />
                  <div>
                    <div className="text-sliate-dark dark:text-gray-300 font-medium">Sunday</div>
                    <div className="text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
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
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Scholarship Information</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Academic Regulations</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Contact Faculty</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Follow Us</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 3a10.978 10.978 0 01-3.071.839A4.48 4.48 0 0022 2.5a9.9 9.9 0 01-3.127 1.086A4.48 4.48 0 0016.616 0c-2.475 0-4.48 2.005-4.48 4.48 0 .35.039.692.115 1.021A12.743 12.743 0 011.671 1.293 4.48 4.48 0 00.967 4.9a4.48 4.48 0 001.995-.553 4.48 4.48 0 01-2.016-.526v.053a4.48 4.48 0 003.584 4.392 4.48 4.48 0 01-2.008.076 4.48 4.48 0 004.173 3.1A9.9 9.9 0 010 19.539a13.943 13.943 0 007.548 2.209c9.056 0 14.004-7.507 14.004-14.004 0-.213 0-.426-.015-.637A10.026 10.026 0 0023 3z" />
                  </svg>
                </a>
                <a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8a6 6 0 10-8 0 6 6 0 008 0zM2.458 12C3.732 7.943 7.686 4.5 12 4.5c4.314 0 8.268 3.443 9.542 7.5M12 22.5c-4.314 0-8.268-3.443-9.542-7.5M12 22.5c4.314 0 8.268-3.443 9.542-7.5" />
                  </svg>
                </a>
                <a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5V12c0 4.418 3.582 8 8 8h5.586a2 2 0 001.414-.586l4.586-4.586a2 2 0 000-2.828l-4.586-4.586A2 2 0 0017.586 3H12a8.001 8.001 0 00-9 9z" />
                  </svg>
                </a>
              </div>
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
