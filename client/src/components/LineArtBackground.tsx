import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

const LineArtBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const lines: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      opacity: number;
      speed: number;
      angle: number;
    }> = [];

    // Create flowing lines
    const createLine = () => {
      return {
        x1: Math.random() * canvas.width,
        y1: Math.random() * canvas.height,
        x2: Math.random() * canvas.width,
        y2: Math.random() * canvas.height,
        opacity: Math.random() * 0.3 + 0.1,
        speed: Math.random() * 0.5 + 0.2,
        angle: Math.random() * Math.PI * 2
      };
    };

    // Initialize lines
    for (let i = 0; i < 12; i++) {
      lines.push(createLine());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Set line style based on theme
      const strokeColor = theme === 'dark' 
        ? 'rgba(184, 207, 206, 0.2)' 
        : 'rgba(127, 140, 170, 0.25)';

      lines.forEach((line, index) => {
        // Update line position
        line.angle += line.speed * 0.01;
        line.x1 += Math.cos(line.angle) * line.speed;
        line.y1 += Math.sin(line.angle) * line.speed;
        line.x2 += Math.cos(line.angle + Math.PI) * line.speed;
        line.y2 += Math.sin(line.angle + Math.PI) * line.speed;

        // Wrap around screen
        if (line.x1 < 0) line.x1 = canvas.width;
        if (line.x1 > canvas.width) line.x1 = 0;
        if (line.y1 < 0) line.y1 = canvas.height;
        if (line.y1 > canvas.height) line.y1 = 0;

        if (line.x2 < 0) line.x2 = canvas.width;
        if (line.x2 > canvas.width) line.x2 = 0;
        if (line.y2 < 0) line.y2 = canvas.height;
        if (line.y2 > canvas.height) line.y2 = 0;

        // Draw curved line
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        const offset = Math.sin(Date.now() * 0.001 + index) * 30;
        
        ctx.quadraticCurveTo(
          midX + offset, 
          midY + offset, 
          line.x2, 
          line.y2
        );
        
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1 + Math.sin(Date.now() * 0.003 + index) * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: 'transparent' }}
    />
  );
};

export default LineArtBackground;