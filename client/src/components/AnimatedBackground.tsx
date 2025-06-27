import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const AnimatedBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createVectorElement = () => {
      const element = document.createElement('div');
      
      // Create different vector shapes
      const shapes = ['vector-dot', 'vector-line', 'vector-curve'];
      const shapeClass = shapes[Math.floor(Math.random() * shapes.length)];
      
      element.className = `absolute transition-all duration-1000 ${shapeClass}`;
      
      element.style.left = Math.random() * 100 + '%';
      element.style.top = Math.random() * 100 + '%';
      element.style.animation = `vector-float ${4 + Math.random() * 6}s ease-in-out infinite`;
      element.style.animationDelay = Math.random() * 3 + 's';

      // Theme-based styling
      if (theme === 'dark') {
        element.style.background = 'linear-gradient(45deg, rgba(184, 207, 206, 0.1), rgba(127, 140, 170, 0.08))';
        element.style.boxShadow = '0 0 20px rgba(184, 207, 206, 0.1)';
      } else {
        element.style.background = 'linear-gradient(45deg, rgba(184, 207, 206, 0.15), rgba(51, 52, 70, 0.1))';
        element.style.boxShadow = '0 0 15px rgba(184, 207, 206, 0.2)';
      }

      container.appendChild(element);

      // Remove element after animation
      setTimeout(() => {
        if (container.contains(element)) {
          container.removeChild(element);
        }
      }, 12000);
    };

    // Create initial elements
    for (let i = 0; i < 6; i++) {
      setTimeout(createVectorElement, i * 500);
    }

    const interval = setInterval(createVectorElement, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [theme]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        background: theme === 'dark' 
          ? 'radial-gradient(circle at 30% 70%, rgba(184, 207, 206, 0.03) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(127, 140, 170, 0.03) 0%, transparent 50%)'
          : 'radial-gradient(circle at 30% 70%, rgba(184, 207, 206, 0.05) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(51, 52, 70, 0.03) 0%, transparent 50%)'
      }}
    />
  );
};

export default AnimatedBackground;
