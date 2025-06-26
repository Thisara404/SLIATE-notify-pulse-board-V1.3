import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Add scroll listener to apply background when scrolling down
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-4 group">
            <div
              className={`relative overflow-hidden rounded-lg ${
                scrolled ? "border border-sliate-accent/20" : "border border-white/20"
              }`}
            >
              <img
                src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png"
                alt="SLIATE Logo"
                className="h-8 w-8 transition-transform group-hover:scale-110"
              />
            </div>
            <div>
              <h1
                className={`text-xl font-bold transition-colors ${
                  scrolled ? "text-sliate-dark dark:text-white" : "text-white"
                }`}
              >
                SLIATE Notify
              </h1>
              <p
                className={`text-xs transition-colors ${
                  scrolled ? "text-sliate-accent dark:text-gray-300" : "text-white/80"
                }`}
              >
                Official Notice Board
              </p>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className={`transition-colors ${
                scrolled
                  ? "text-sliate-accent hover:text-sliate-dark dark:text-gray-300 dark:hover:text-white"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden sm:inline ml-2">
                {theme === "light" ? "Dark" : "Light"}
              </span>
            </Button>

            <Button
              asChild
              variant={scrolled ? "default" : "outline"}
              size="sm"
              className={scrolled
              ? "bg-transparent hover:bg-sliate-accent/10 text-sliate-accent border border-sliate-accent/20"
              : "bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white"
              }
            >
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
