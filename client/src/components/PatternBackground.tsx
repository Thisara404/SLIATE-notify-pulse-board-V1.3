import { useTheme } from "next-themes";

const PatternBackground = () => {
  const { theme } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* SVG Pattern Background */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: theme === 'dark' ? 0.03 : 0.05 }}
      >
        <defs>
          <pattern
            id="geometric-pattern"
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            {/* Hexagonal pattern */}
            <polygon
              points="60,10 90,35 90,75 60,100 30,75 30,35"
              fill="none"
              stroke={theme === 'dark' ? '#B8CFCE' : '#7F8CAA'}
              strokeWidth="1"
            />
            <circle
              cx="60"
              cy="55"
              r="8"
              fill={theme === 'dark' ? '#B8CFCE' : '#7F8CAA'}
              opacity="0.3"
            />
            {/* Additional decorative elements */}
            <line
              x1="30"
              y1="35"
              x2="90"
              y2="75"
              stroke={theme === 'dark' ? '#B8CFCE' : '#7F8CAA'}
              strokeWidth="0.5"
              opacity="0.5"
            />
            <line
              x1="90"
              y1="35"
              x2="30"
              y2="75"
              stroke={theme === 'dark' ? '#B8CFCE' : '#7F8CAA'}
              strokeWidth="0.5"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geometric-pattern)" />
      </svg>

      {/* Floating geometric elements */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${10 + (i * 12)}%`,
              top: `${5 + (i * 8)}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + i}s`
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              className="text-sliate-accent dark:text-sliate-light opacity-20"
            >
              <polygon
                points="20,5 35,15 35,25 20,35 5,25 5,15"
                fill="currentColor"
                className="animate-spin"
                style={{
                  animationDuration: `${8 + i * 2}s`,
                  transformOrigin: 'center'
                }}
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatternBackground;