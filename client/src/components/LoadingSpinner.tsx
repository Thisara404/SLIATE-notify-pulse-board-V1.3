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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/header.png')`,
        }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="text-center space-y-4 relative z-10 backdrop-blur-md bg-white/10 dark:bg-black/10 rounded-2xl p-8 border border-white/20 shadow-2xl"
           style={{ backdropFilter: 'blur(12px)' }}>
        <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
          <img 
            src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
            alt="SLIATE Logo" 
            className="h-16 w-16 rounded-full shadow-lg relative z-10"
          />
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 border-r-blue-400 rounded-full animate-spin" />
          <div className="absolute border-2 border-transparent border-b-blue-300 rounded-full animate-spin w-28 h-28 -top-2 -left-2" 
               style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white drop-shadow-lg animate-fade-in">
            SLIATE Notify
          </h3>
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;