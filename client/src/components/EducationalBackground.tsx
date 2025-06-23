
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const EducationalBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createEducationalElement = () => {
      const elements = ['📚', '🎓', '📝', '🔬', '💡', '📊', '🖥️', '📋'];
      const element = document.createElement('div');
      element.textContent = elements[Math.floor(Math.random() * elements.length)];
      element.className = 'absolute text-2xl pointer-events-none select-none transition-all duration-1000';
      element.style.left = Math.random() * 100 + '%';
      element.style.top = Math.random() * 100 + '%';
      element.style.opacity = theme === 'dark' ? '0.1' : '0.05';
      element.style.animation = `float ${5 + Math.random() * 5}s ease-in-out infinite`;
      element.style.animationDelay = Math.random() * 3 + 's';

      container.appendChild(element);

      setTimeout(() => {
        if (container.contains(element)) {
          container.removeChild(element);
        }
      }, 15000);
    };

    // Create initial elements
    for (let i = 0; i < 8; i++) {
      setTimeout(createEducationalElement, i * 500);
    }

    const interval = setInterval(createEducationalElement, 2000);

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

export default EducationalBackground;
