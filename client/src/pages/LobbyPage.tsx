import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import nakamaClient from "../lib/nakama.ts";

type GameMode = "classic" | "timed";

const MATCH_TIMEOUT_SEC = 30;
const RETRY_DELAY_MS = 3000;

export default function LobbyPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GameMode>("classic");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(MATCH_TIMEOUT_SEC);
  const cancelledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    return () => {
      clearTimeout(retryTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const handleFindMatch = useCallback(async () => {
    setSearching(true);
    setError("");
    setCountdown(MATCH_TIMEOUT_SEC);
    cancelledRef.current = false;

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      if (!nakamaClient.isConnected) {
        await nakamaClient.authenticate();
      }

      const maxRetries = Math.floor(MATCH_TIMEOUT_SEC / (RETRY_DELAY_MS / 1000));

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (cancelledRef.current) return;

        try {
          await nakamaClient.leaveMatch();
          await nakamaClient.findMatch(mode);
          if (cancelledRef.current) return;
          clearInterval(countdownRef.current);
          navigate("/game", { state: { mode } });
          return;
        } catch {
          if (attempt < maxRetries - 1 && !cancelledRef.current) {
            await new Promise<void>((resolve) => {
              retryTimerRef.current = setTimeout(resolve, RETRY_DELAY_MS);
            });
          }
        }
      }

      if (!cancelledRef.current) {
        clearInterval(countdownRef.current);
        setError("No opponent found within 30 seconds. Please try again.");
        setSearching(false);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        clearInterval(countdownRef.current);
        setError(err instanceof Error ? err.message : "Failed to find match");
        setSearching(false);
      }
    }
  }, [mode, navigate]);

  function cancelSearch() {
    cancelledRef.current = true;
    clearTimeout(retryTimerRef.current);
    clearInterval(countdownRef.current);
    nakamaClient.leaveMatch();
    setSearching(false);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate("/")}
          className="mb-8 text-gray-500 hover:text-gray-300 transition text-sm flex items-center gap-1 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {!searching ? (
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-center">Choose Game Mode</h2>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setMode("classic")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  mode === "classic"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="text-2xl mb-2">&#9201;</div>
                <div className="font-semibold">Classic</div>
                <div className="text-xs mt-1 opacity-70">No time limit</div>
              </button>

              <button
                onClick={() => setMode("timed")}
                className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  mode === "timed"
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div className="text-2xl mb-2">&#9203;</div>
                <div className="font-semibold">Timed</div>
                <div className="text-xs mt-1 opacity-70">30s per turn</div>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleFindMatch}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] cursor-pointer"
            >
              Find Match
            </button>
          </div>
        ) : (
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-12 shadow-xl text-center">
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin-slow" />
            <h2 className="text-xl font-bold mb-2">Searching for opponent...</h2>
            <p className="text-gray-400 text-sm mb-2">
              Mode: <span className="capitalize text-white">{mode}</span>
              {mode === "timed" && " (30s per turn)"}
            </p>
            <p className={`text-2xl font-bold mb-6 ${countdown <= 10 ? "text-red-400" : "text-blue-400"}`}>
              {countdown}s
            </p>
            <button
              onClick={cancelSearch}
              className="py-2 px-6 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
