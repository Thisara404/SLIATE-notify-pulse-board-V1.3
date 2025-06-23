
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

const MouseClickEffect = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const newParticles: Particle[] = [];
      
      // Create multiple particles for explosion effect
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const velocity = 2 + Math.random() * 3;
        
        newParticles.push({
          id: Date.now() + i,
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life: 1,
          maxLife: 60 + Math.random() * 30
        });
      }
      
      setParticles(prev => [...prev, ...newParticles]);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;

    const animationFrame = requestAnimationFrame(() => {
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vx: particle.vx * 0.98,
            vy: particle.vy * 0.98 + 0.1,
            life: particle.life - (1 / particle.maxLife)
          }))
          .filter(particle => particle.life > 0)
      );
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [particles]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full bg-blue-500 shadow-lg"
          style={{
            left: particle.x - 4,
            top: particle.y - 4,
            opacity: particle.life,
            transform: `scale(${particle.life * 1.5})`,
            boxShadow: `0 0 ${particle.life * 10}px rgba(59, 130, 246, ${particle.life * 0.8})`
          }}
        />
      ))}
    </div>
  );
};

export default MouseClickEffect;
