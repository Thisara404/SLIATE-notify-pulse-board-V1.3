
import { useEffect, useState } from "react";

const LoadingSpinner = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <img 
            src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
            alt="SLIATE Logo" 
            className="h-16 w-16 mx-auto animate-pulse"
          />
          <div className="absolute inset-0 border-4 border-sliate-accent/20 border-t-sliate-accent rounded-full animate-spin" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-sliate-dark dark:text-white animate-fade-in">
            SLIATE Notify
          </h3>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-sliate-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-sliate-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-sliate-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
