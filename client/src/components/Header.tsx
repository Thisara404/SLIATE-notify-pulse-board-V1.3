
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-sliate-neutral sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <img 
              src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
              alt="SLIATE Logo" 
              className="h-8 w-8"
            />
            <div>
              <h1 className="text-xl font-bold text-sliate-dark dark:text-white">SLIATE Notify</h1>
              <p className="text-xs text-sliate-accent dark:text-gray-300">Official Notice Board</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="text-sliate-accent hover:text-sliate-dark dark:text-gray-300 dark:hover:text-white"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden sm:inline ml-2">
                {theme === "light" ? "Dark" : "Light"} Mode
              </span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
