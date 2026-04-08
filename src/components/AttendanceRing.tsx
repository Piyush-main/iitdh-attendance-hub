interface AttendanceRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

const AttendanceRing = ({ percentage, size = 64, strokeWidth = 6 }: AttendanceRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 75) return 'hsl(var(--success))';
    if (pct >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-bold text-foreground">
        {Math.round(percentage)}%
      </span>
    </div>
  );
};

export default AttendanceRing;
