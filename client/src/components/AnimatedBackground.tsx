
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const AnimatedBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createDot = () => {
      const dot = document.createElement('div');
      dot.className = `absolute w-1 h-1 rounded-full transition-all duration-1000 ${
        theme === 'dark' 
          ? 'bg-sliate-light/10 hover:bg-sliate-light/30' 
          : 'bg-sliate-accent/10 hover:bg-sliate-accent/30'
      }`;
      
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
      dot.style.animation = `float ${3 + Math.random() * 4}s ease-in-out infinite`;
      dot.style.animationDelay = Math.random() * 2 + 's';

      // Add hover effect
      dot.addEventListener('mouseenter', () => {
        dot.style.transform = 'scale(8)';
        dot.style.opacity = '0.6';
      });

      dot.addEventListener('mouseleave', () => {
        dot.style.transform = 'scale(1)';
        dot.style.opacity = '1';
      });

      container.appendChild(dot);

      // Remove dot after animation
      setTimeout(() => {
        if (container.contains(dot)) {
          container.removeChild(dot);
        }
      }, 10000);
    };

    // Create initial dots
    for (let i = 0; i < 15; i++) {
      setTimeout(createDot, i * 200);
    }

    // Continue creating dots
    const interval = setInterval(createDot, 1000);

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
          ? 'radial-gradient(circle at 50% 50%, rgba(127, 140, 170, 0.03) 0%, transparent 50%)'
          : 'radial-gradient(circle at 50% 50%, rgba(184, 207, 206, 0.03) 0%, transparent 50%)'
      }}
    />
  );
};

export default AnimatedBackground;
