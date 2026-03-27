interface GameOverlayProps {
  winner: number;
  winnerUserId: string;
  myUserId: string;
  myMark: number;
  reason: string;
  pointsAwarded: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function GameOverlay({
  winner,
  winnerUserId,
  myUserId,
  reason,
  pointsAwarded,
  onPlayAgain,
  onHome,
}: GameOverlayProps) {
  const isDraw = winner === 3;
  const iWon = winnerUserId === myUserId;

  let title: string;
  let subtitle: string;
  let bgGradient: string;

  if (isDraw) {
    title = "Draw!";
    subtitle = "Well matched game";
    bgGradient = "from-gray-600/20 to-gray-800/20";
  } else if (iWon) {
    title = "WINNER!";
    subtitle =
      reason === "opponent_left"
        ? "Opponent disconnected"
        : reason === "timeout"
          ? "Opponent ran out of time"
          : "Great game!";
    bgGradient = "from-green-600/20 to-emerald-800/20";
  } else {
    title = "You Lose";
    subtitle =
      reason === "timeout"
        ? "You ran out of time"
        : reason === "server_shutdown"
          ? "Server shutting down"
          : "Better luck next time";
    bgGradient = "from-red-600/20 to-rose-800/20";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
      <div className={`bg-gradient-to-b ${bgGradient} border border-gray-700 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl`}>
        <div className="text-6xl mb-4">
          {isDraw ? "🤝" : iWon ? "🏆" : "😔"}
        </div>

        <h2 className="text-3xl font-black mb-1">{title}</h2>

        {pointsAwarded > 0 && (
          <p className={`text-lg font-bold mb-2 ${iWon ? "text-green-400" : isDraw ? "text-yellow-400" : "text-gray-400"}`}>
            +{pointsAwarded} pts
          </p>
        )}

        <p className="text-gray-400 mb-8">{subtitle}</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer"
          >
            Play Again
          </button>
          <button
            onClick={onHome}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
