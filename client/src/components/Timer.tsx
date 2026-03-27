import { useState, useEffect, useRef } from "react";

interface TimerProps {
  deadline: number; // Unix timestamp in seconds
  active: boolean;
}

export default function Timer({ deadline, active }: TimerProps) {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!active || deadline === 0) {
      setRemaining(0);
      return;
    }

    function tick() {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, deadline - now);
      setRemaining(diff);
    }

    tick();
    intervalRef.current = setInterval(tick, 250);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deadline, active]);

  if (!active || deadline === 0) return null;

  const pct = Math.min(100, (remaining / 30) * 100);
  const color =
    remaining > 15 ? "bg-green-500" :
    remaining > 7 ? "bg-yellow-500" :
    "bg-red-500";

  const ringColor =
    remaining > 15 ? "text-green-500" :
    remaining > 7 ? "text-yellow-500" :
    "text-red-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-3xl font-bold tabular-nums ${ringColor} transition-colors duration-500`}>
        {remaining}s
      </div>
      <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
