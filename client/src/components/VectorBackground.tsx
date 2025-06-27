import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const VectorBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createGeometricShape = () => {
      const shapes = [
        'circle',
        'triangle',
        'hexagon',
        'diamond',
        'star',
        'pentagon'
      ];
      
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const element = document.createElement('div');
      element.className = `absolute pointer-events-none select-none transition-all duration-[15s] ${shape}-shape`;
      
      // Random position
      element.style.left = Math.random() * 100 + '%';
      element.style.top = Math.random() * 100 + '%';
      
      // Random size
      const size = 20 + Math.random() * 60;
      element.style.width = size + 'px';
      element.style.height = size + 'px';
      
      // Theme-based colors
      const colors = theme === 'dark' 
        ? ['rgba(184, 207, 206, 0.1)', 'rgba(127, 140, 170, 0.08)', 'rgba(255, 255, 255, 0.05)']
        : ['rgba(184, 207, 206, 0.15)', 'rgba(127, 140, 170, 0.12)', 'rgba(51, 52, 70, 0.08)'];
      
      element.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      element.style.opacity = '0';
      
      // Animation properties
      element.style.animation = `float-geometric ${8 + Math.random() * 10}s ease-in-out infinite`;
      element.style.animationDelay = Math.random() * 5 + 's';
      
      container.appendChild(element);
      
      // Fade in
      setTimeout(() => {
        element.style.opacity = '1';
        element.style.transform = `translateY(-${Math.random() * 200 + 100}px) rotate(${Math.random() * 360}deg)`;
      }, 100);

      // Remove element
      setTimeout(() => {
        if (container.contains(element)) {
          element.style.opacity = '0';
          setTimeout(() => {
            if (container.contains(element)) {
              container.removeChild(element);
            }
          }, 1000);
        }
      }, 20000);
    };

    // Create initial shapes
    for (let i = 0; i < 8; i++) {
      setTimeout(createGeometricShape, i * 1000);
    }

    const interval = setInterval(createGeometricShape, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [theme]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
};

export default VectorBackground;