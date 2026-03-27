import { Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import AuthPage from "./pages/AuthPage.tsx";
import LobbyPage from "./pages/LobbyPage.tsx";
import GamePage from "./pages/GamePage.tsx";
import LeaderboardPage from "./pages/LeaderboardPage.tsx";

export default function App() {
  return (
    <div className="min-h-dvh bg-gray-950 text-white">
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
