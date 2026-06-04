export const ScoreRing = ({ score, size = 64 }) => {
  if (score == null) {
    return (
      <div
        className="text-gray-600 text-xs flex items-center justify-center rounded-full border-2 border-gray-800 shrink-0"
        style={{ width: size, height: size }}
        aria-label="No score available"
      >
        —
      </div>
    );
  }

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Quality score ${score} out of 100`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 text-gray-200 dark:text-gray-700"
        aria-hidden="true"
      >
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
};
