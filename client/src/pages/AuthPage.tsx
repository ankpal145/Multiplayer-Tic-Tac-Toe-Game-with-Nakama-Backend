import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import nakamaClient from "../lib/nakama.ts";

export default function AuthPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [username, setUsername] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (nakamaClient.isConnected) {
      setUsername(nakamaClient.username);
      setStatus("connected");
      return;
    }

    setStatus("connecting");
    nakamaClient
      .authenticate()
      .then((session) => {
        setUsername(session.username || "Player");
        setStatus("connected");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Connection failed");
        setStatus("error");
      });
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }} />
      </div>

      <div className="relative z-10 text-center max-w-md w-full">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-lg shadow-blue-500/20">
            <span className="text-4xl font-black tracking-tighter">X O</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-2">
            <span className="text-blue-400">X</span>
            <span className="text-gray-400">O</span>
            <span className="text-red-400">X</span>
            <span className="text-gray-400">O</span>
          </h1>
          <p className="text-gray-400 text-lg">Multiplayer Tic-Tac-Toe</p>
        </div>

        {/* Status Card */}
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-xl">
          {status === "connecting" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin-slow" />
              <p className="text-gray-400">Connecting to server...</p>
            </div>
          )}

          {status === "connected" && (
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                <span className="text-gray-300">
                  Playing as <span className="text-white font-semibold">{username}</span>
                </span>
              </div>

              <button
                onClick={() => navigate("/lobby")}
                className="w-full py-4 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98] cursor-pointer"
              >
                Play
              </button>

              <button
                onClick={() => navigate("/leaderboard")}
                className="w-full py-3 px-8 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 cursor-pointer"
              >
                Leaderboard
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-xl">!</span>
              </div>
              <p className="text-red-400 text-sm">{errorMsg}</p>
              <button
                onClick={() => window.location.reload()}
                className="py-2 px-6 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <p className="mt-8 text-gray-600 text-xs">Server-authoritative multiplayer powered by Nakama</p>
      </div>
    </div>
  );
}
