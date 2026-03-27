import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import nakamaClient, { type LeaderboardEntry } from "../lib/nakama.ts";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m` : `${hours}h`;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        if (!nakamaClient.isConnected) {
          await nakamaClient.authenticate();
        }
        const result = await nakamaClient.getLeaderboard(20);
        setEntries(result.entries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const myUserId = nakamaClient.userId;

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-300 transition text-sm flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold">Leaderboard</h1>
          <div className="w-12" />
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="w-10 h-10 mx-auto border-3 border-blue-500 border-t-transparent rounded-full animate-spin-slow" />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🏆</div>
            <p className="text-gray-400">No games played yet. Be the first!</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="grid grid-cols-[2.5rem_1fr_5.5rem_3rem_4rem] gap-1 px-3 py-3 bg-gray-800/50 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
              <div className="text-center">#</div>
              <div>Player</div>
              <div className="text-center">W/L/D</div>
              <div className="text-center">Time</div>
              <div className="text-center">Score</div>
            </div>

            {entries.map((entry) => {
              const isMe = entry.userId === myUserId;
              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-[2.5rem_1fr_5.5rem_3rem_4rem] gap-1 px-3 py-3 border-t border-gray-800/50 items-center transition ${
                    isMe ? "bg-blue-500/5" : "hover:bg-gray-800/30"
                  }`}
                >
                  <div className="text-center">
                    {entry.rank === 1 && <span className="text-yellow-400 text-lg">🥇</span>}
                    {entry.rank === 2 && <span className="text-gray-300 text-lg">🥈</span>}
                    {entry.rank === 3 && <span className="text-orange-400 text-lg">🥉</span>}
                    {entry.rank > 3 && <span className="text-gray-500 text-sm">{entry.rank}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`truncate text-sm ${isMe ? "text-blue-400 font-semibold" : "text-white"}`}>
                      {entry.username || "Anonymous"}
                    </span>
                    {isMe && (
                      <span className="shrink-0 text-[9px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-center text-sm">
                    <span className="text-green-400">{entry.wins}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-red-400">{entry.losses}</span>
                    <span className="text-gray-600">/</span>
                    <span className="text-gray-400">{entry.draws}</span>
                  </div>
                  <div className="text-center text-gray-400 text-xs">{formatTime(entry.timePlayed)}</div>
                  <div className="text-center text-yellow-400 font-bold text-sm">{entry.score}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
