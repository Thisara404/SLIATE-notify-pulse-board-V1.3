import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Search, Calendar, Mail, Phone, MapPin, Clock, Bell, Users, BookOpen, Award, ChevronDown, ChevronUp } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import VectorBackground from "@/components/VectorBackground";
import LineArtBackground from "@/components/LineArtBackground";

// Updated interfaces to match the new API response
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

interface GroupedNotices {
  date: string;
  displayDate: string;
  isToday: boolean;
  notices: Notice[];
  noticeCount: number;
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
  // Updated state to work with the new API structure
  const [groupedNotices, setGroupedNotices] = useState<GroupedNotices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10, // Now represents date groups per page, not individual notices
    priority: null as string | null,
    search: "",
    timePeriod: null as string | null,
    category: null as string | null,
    department: null as string | null,
    sortBy: "published_at",
    sortOrder: "DESC"
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalDates: 0,
    totalPages: 0,
    totalNotices: 0
  });
  const [returnedFromNotice, setReturnedFromNotice] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
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
      
      // Update to use the new API response structure
      setGroupedNotices(data.data.noticeGroups || []);
      setPagination({
        page: parseInt(data.data.pagination.page) || 1,
        limit: parseInt(data.data.pagination.limit) || 10,
        totalDates: parseInt(data.data.pagination.totalDates) || 0,
        totalPages: parseInt(data.data.pagination.totalPages) || 1,
        totalNotices: parseInt(data.data.pagination.totalNotices) || 0
      });
    } catch (error) {
      console.error("Failed to fetch public notices:", error);
      // Set empty array on error to prevent undefined access
      setGroupedNotices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1
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

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchSubmit = () => {
    if (searchQuery.trim() === '') {
      setFilters(prev => ({
        ...prev,
        search: "",
        page: 1
      }));
    } else {
      handleSearch(searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setFilters(prev => ({
      ...prev,
      search: "",
      page: 1
    }));
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800">
      <LoadingSpinner />
      <VectorBackground />
      <LineArtBackground />
      <MouseClickEffect />
      <Header />
      
      {/* Parallax Hero Section - Better mobile responsiveness */}
      <section className="relative min-h-[80vh] sm:min-h-[90vh] lg:min-h-[100vh] flex items-center justify-center overflow-hidden py-8 sm:py-12 lg:py-16">
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
        
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto w-full">
          <div 
            className="mb-6 sm:mb-8"
            style={{
              transform: `translateY(${scrollY * 0.2}px)`,
            }}
          >
            <img 
              src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
              alt="SLIATE Logo" 
              className="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 mx-auto mb-3 sm:mb-4 lg:mb-6 drop-shadow-lg rounded-lg border-4 border-white/30"
            />
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-2 sm:mb-3 lg:mb-4 drop-shadow-lg">
              SLIATE NOTIFY
            </h1>
            <p className="text-sm sm:text-lg md:text-xl lg:text-2xl mb-3 sm:mb-6 lg:mb-8 opacity-90 drop-shadow-md">
              Sri Lanka Institute of Advanced Technological Education
            </p>
            <p className="text-xs sm:text-sm lg:text-lg opacity-80 max-w-2xl mx-auto leading-relaxed px-2">
              Stay updated with official announcements, notices, and important information from SLIATE Kandy
            </p>
          </div>

          {/* Stats Cards - Improved mobile layout */}
          <div 
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-8 lg:mb-12"
            style={{
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          >
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-3 lg:p-4 border border-white/20">
              <Users className="h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-sm sm:text-lg lg:text-2xl font-bold">100K+</div>
              <div className="text-xs sm:text-sm opacity-80">Students</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-3 lg:p-4 border border-white/20">
              <BookOpen className="h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-sm sm:text-lg lg:text-2xl font-bold">15+</div>
              <div className="text-xs sm:text-sm opacity-80">Courses</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-3 lg:p-4 border border-white/20">
              <Award className="h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-sm sm:text-lg lg:text-2xl font-bold">30+</div>
              <div className="text-xs sm:text-sm opacity-80">Years</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-lg p-2 sm:p-3 lg:p-4 border border-white/20">
              <Bell className="h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 mx-auto mb-1 sm:mb-2" />
              <div className="text-sm sm:text-lg lg:text-2xl font-bold">200K+</div>
              <div className="text-xs sm:text-sm opacity-80">Notices</div>
            </div>
          </div>
        </div>

        {/* Scroll indicator - Better mobile positioning */}
        <div 
          className="absolute bottom-4 sm:bottom-6 lg:bottom-8 w-full flex justify-center text-white animate-bounce cursor-pointer"
          onClick={() => window.scrollTo({ top: window.innerHeight * 0.8, behavior: 'smooth' })}
        >
          <div className="flex flex-col items-center">
            <span className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 tracking-wide">Scroll Down</span>
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="sm:w-6 sm:h-6 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-8 sm:py-12 relative z-10">
        {/* Visitor Stats */}
        <VisitorStats />

        {/* Latest Notices Section */}
        <section className="mb-12 sm:mb-16" ref={noticeListRef}>
          <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-2xl sm:text-3xl font-bold text-sliate-dark dark:text-white">Official Notices</h2>
          </div>
          <p className="text-sm sm:text-base text-sliate-accent dark:text-gray-300 mb-6 sm:mb-8">
            Stay updated with the latest announcements and important information
          </p>
          
          <NoticeFilters onFilterChange={handleFilterChange} />

          {/* Search Section - Improved mobile layout */}
          <Card className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light" />
                <h3 className="text-sm sm:text-base font-semibold text-sliate-dark dark:text-white">Search Notices</h3>
              </div>
              <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sliate-accent dark:text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
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
                    className="pl-9 sm:pl-10 h-10 sm:h-12 text-sm sm:text-base border-sliate-accent/30 focus:border-sliate-accent dark:border-gray-600 dark:focus:border-sliate-light dark:bg-gray-700 dark:text-white"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      aria-label="Clear search"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex space-x-2 sm:space-x-0">
                  {filters.search ? (
                    <Button 
                      className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white px-4 sm:px-8 h-10 sm:h-12 dark:bg-red-600 dark:hover:bg-red-700 text-sm sm:text-base"
                      onClick={handleClearSearch}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                      <span className="hidden sm:inline">Clear Search</span>
                    </Button>
                  ) : (
                    <Button 
                      className="flex-1 sm:flex-none bg-sliate-accent hover:bg-sliate-accent/90 text-white px-4 sm:px-8 h-10 sm:h-12 dark:bg-sliate-light dark:text-sliate-dark dark:hover:bg-sliate-light/90 text-sm sm:text-base"
                      onClick={handleSearchSubmit}
                    >
                      <Search className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                      <span className="hidden sm:inline">Search</span>
                    </Button>
                  )}
                </div>
              </div>
              {filters.search && (
                <div className="mt-3 text-xs sm:text-sm text-sliate-accent dark:text-gray-400">
                  {pagination.totalNotices} notice{pagination.totalNotices !== 1 ? 's' : ''} found for "{filters.search}"
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

          <div className="space-y-4 sm:space-y-6">
            {isLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="w-8 h-8 sm:w-12 sm:h-12 border-4 border-sliate-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-sliate-accent dark:text-gray-300">Loading notices...</p>
              </div>
            ) : groupedNotices && groupedNotices.length > 0 ? (
              groupedNotices.map((dateGroup, groupIndex) => (
                <div key={dateGroup.date} className="space-y-3 sm:space-y-4">
                  {/* Date Header - Improved mobile layout */}
                  <div 
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors space-y-2 sm:space-y-0"
                    onClick={() => toggleDateCollapse(dateGroup.date)}
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent flex-shrink-0" />
                      <h3 className="text-base sm:text-lg font-semibold text-sliate-dark dark:text-white">
                        {dateGroup.displayDate}
                      </h3>
                      {dateGroup.isToday && (
                        <Badge className="bg-sliate-accent text-white text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between sm:justify-end space-x-2 gap-1">
                      {/* Notice count badge */}
                      <Badge variant="outline" className="text-xs text-sliate-accent border-sliate-accent/30">
                        {dateGroup.notices.length} notice{dateGroup.notices.length !== 1 ? 's' : ''}
                      </Badge>
                      
                      {/* Priority indicators - Stack on mobile */}
                      <div className="flex flex-wrap gap-1">
                        {['high', 'medium', 'low'].map(priority => {
                          const count = dateGroup.notices.filter(n => n.priority === priority).length;
                          return count > 0 ? (
                            <Badge 
                              key={priority} 
                              className={`text-xs ${getPriorityBadgeColor(priority)}`}
                            >
                              {count} {priority}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                      
                      {/* Collapse icon */}
                      <div className="ml-auto sm:ml-2">
                        {collapsedDates.has(dateGroup.date) ? (
                          <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent" />
                        ) : (
                          <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notices for this date */}
                  {!collapsedDates.has(dateGroup.date) && (
                    <div className="space-y-3 sm:space-y-4 ml-2 sm:ml-4">
                      {dateGroup.notices.map((notice, index) => (
                        <div 
                          key={notice.id} 
                          className="animate-fade-in"
                          style={{ animationDelay: `${(groupIndex * 100) + (index * 50)}ms` }}
                        >
                          <NoticeCard 
                            notice={{
                              id: notice.id.toString(),
                              topic: notice.title,
                              description: notice.description,
                              priority: notice.priority as 'high' | 'medium' | 'low',
                              date: notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : '',
                              category: 'General',
                              department: 'SLIATE',
                              images: notice.imageUrl ? [`${import.meta.env.VITE_API_BASE_URL.replace('/api', '')}${notice.imageUrl}`] : undefined,
                              attachments: notice.files || undefined
                            }} 
                            slug={notice.slug}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
                <CardContent className="p-6 sm:p-8 text-center">
                  <Bell className="h-8 w-8 sm:h-12 sm:w-12 text-sliate-accent dark:text-sliate-light mx-auto mb-4 opacity-50" />
                  <h3 className="text-base sm:text-lg font-semibold text-sliate-dark dark:text-white mb-2">No Notices Found</h3>
                  <p className="text-sm sm:text-base text-sliate-accent dark:text-gray-300">
                    {filters.search ? "No notices match your search criteria." : "No notices match your current filter criteria."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {groupedNotices && groupedNotices.length > 0 && pagination.totalPages > 1 && (
            <div className="mt-6 sm:mt-8 space-y-4">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                Showing page {pagination.page} of {pagination.totalPages} 
                ({pagination.totalDates} dates, {pagination.totalNotices} total notices)
              </div>
              <div className="flex justify-center">
                <HorizontalPagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          )}
        </section>

        {/* Upcoming Events Section - Better mobile layout */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
            <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-2xl sm:text-3xl font-bold text-sliate-dark dark:text-white">Upcoming Events</h2>
          </div>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <Card key={event.id} className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light" />
                    <span className="text-xs sm:text-sm text-sliate-accent dark:text-gray-300">{event.date}</span>
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-sliate-dark dark:text-white mb-2">{event.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{event.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Contact Section - Better mobile layout */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center space-x-2 sm:space-x-3 mb-4 sm:mb-6">
            <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-sliate-accent dark:text-sliate-light" />
            <h2 className="text-2xl sm:text-3xl font-bold text-sliate-dark dark:text-white">Contact</h2>
          </div>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
            <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-sliate-dark dark:text-white">Get in Touch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light flex-shrink-0" />
                  <span className="text-sm sm:text-base text-sliate-dark dark:text-gray-300">+94 81 2 388 400</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light flex-shrink-0" />
                  <span className="text-sm sm:text-base text-sliate-dark dark:text-gray-300">info@sliate.ac.lk</span>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light mt-1 flex-shrink-0" />
                  <span className="text-sm sm:text-base text-sliate-dark dark:text-gray-300">
                    No. 123, Peradeniya Road<br />
                    Kandy 20000, Sri Lanka
                  </span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 border-sliate-accent/20 dark:border-gray-600">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-sliate-dark dark:text-white">Office Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light flex-shrink-0" />
                  <div>
                    <div className="text-sm sm:text-base text-sliate-dark dark:text-gray-300 font-medium">Monday - Friday</div>
                    <div className="text-xs sm:text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light flex-shrink-0" />
                  <div>
                    <div className="text-sm sm:text-base text-sliate-dark dark:text-gray-300 font-medium">Saturday</div>
                    <div className="text-xs sm:text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-sliate-accent dark:text-sliate-light flex-shrink-0" />
                  <div>
                    <div className="text-sm sm:text-base text-sliate-dark dark:text-gray-300 font-medium">Sunday</div>
                    <div className="text-xs sm:text-sm text-sliate-accent dark:text-gray-400">8:00 AM - 4:30 PM</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer - Better mobile layout */}
      <footer className="bg-sliate-dark dark:bg-gray-900 text-white py-8 sm:py-12 relative z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
                  alt="SLIATE Logo" 
                  className="h-8 w-8 sm:h-10 sm:w-10"
                />
                <h3 className="text-lg sm:text-xl font-semibold">SLIATE Notify</h3>
              </div>
              <p className="text-sm sm:text-base text-sliate-accent dark:text-gray-300 mb-4 leading-relaxed">
                Sri Lanka Institute of Advanced Technological Education - Kandy is committed to providing quality technical education and fostering innovation among students.
              </p>
              <p className="text-xs sm:text-sm text-sliate-accent dark:text-gray-400">
                Official Public Notice Board System
              </p>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Quick Links</h4>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Academic Calendar</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Course Information</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Student Portal</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Library</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Resources</h4>
              <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Admission Guidelines</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Scholarship Information</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Academic Regulations</a></li>
                <li><a href="#" className="text-sliate-accent dark:text-gray-300 hover:text-white transition-colors">Contact Faculty</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-sliate-accent/20 dark:border-gray-700 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center">
            <p className="text-xs sm:text-sm text-sliate-accent dark:text-gray-400">
              © 2024 SLIATE Kandy. All rights reserved. | Developed for educational purposes.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
