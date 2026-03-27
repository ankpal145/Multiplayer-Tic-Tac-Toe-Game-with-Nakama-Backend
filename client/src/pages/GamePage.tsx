import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { MatchData } from "@heroiclabs/nakama-js";
import nakamaClient, {
  OpCode,
  type StartMessage,
  type UpdateMessage,
  type DoneMessage,
  type TimerMessage,
  type ErrorMessage,
} from "../lib/nakama.ts";
import Board from "../components/Board.tsx";
import Timer from "../components/Timer.tsx";
import GameOverlay from "../components/GameOverlay.tsx";

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findWinningLine(board: number[]): number[] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return line;
    }
  }
  return null;
}

interface GameState {
  board: number[];
  myMark: number;
  activePlayer: string;
  mode: string;
  turnDeadline: number;
  gameOver: boolean;
  winner: number;
  winnerUserId: string;
  reason: string;
  started: boolean;
  waitingForOpponent: boolean;
  playerNames: Record<string, string>;
  pointsAwarded: number;
}

const initialGameState: GameState = {
  board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  myMark: 0,
  activePlayer: "",
  mode: "classic",
  turnDeadline: 0,
  gameOver: false,
  winner: 0,
  winnerUserId: "",
  reason: "",
  started: false,
  waitingForOpponent: true,
  playerNames: {},
  pointsAwarded: 0,
};

export default function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [game, setGame] = useState<GameState>(initialGameState);
  const [toast, setToast] = useState("");
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const myUserId = nakamaClient.userId || "";

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 3000);
  }

  const handleMatchData = useCallback(
    (data: MatchData) => {
      const decoder = new TextDecoder();
      let payload: string;
      if (data.data instanceof Uint8Array) {
        payload = decoder.decode(data.data);
      } else if (typeof data.data === "string") {
        payload = data.data;
      } else {
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        return;
      }

      switch (data.op_code) {
        case OpCode.START: {
          const msg = parsed as StartMessage;
          const userId = nakamaClient.userId!;
          setGame((prev) => ({
            ...prev,
            board: msg.board,
            myMark: msg.marks[userId] || 0,
            activePlayer: msg.activePlayer,
            mode: msg.mode,
            turnDeadline: msg.turnDeadline || 0,
            started: true,
            waitingForOpponent: false,
            playerNames: msg.playerNames || {},
          }));
          break;
        }
        case OpCode.UPDATE: {
          const msg = parsed as UpdateMessage;
          setGame((prev) => ({
            ...prev,
            board: msg.board,
            activePlayer: msg.activePlayer,
            turnDeadline: msg.turnDeadline || prev.turnDeadline,
          }));
          break;
        }
        case OpCode.DONE: {
          const msg = parsed as DoneMessage;
          const uid = nakamaClient.userId!;
          const pts = msg.pointsAwarded?.[uid] ?? 0;
          setGame((prev) => ({
            ...prev,
            board: msg.board,
            gameOver: true,
            winner: msg.winner,
            winnerUserId: msg.winnerUserId,
            reason: msg.reason,
            pointsAwarded: pts,
          }));
          break;
        }
        case OpCode.TIMER: {
          const msg = parsed as TimerMessage;
          setGame((prev) => {
            const newDeadline = Math.floor(Date.now() / 1000) + msg.secondsRemaining;
            return { ...prev, turnDeadline: newDeadline };
          });
          break;
        }
        case OpCode.ERROR: {
          const msg = parsed as ErrorMessage;
          showToast(msg.message);
          break;
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!nakamaClient.isConnected) {
      navigate("/");
      return;
    }

    nakamaClient.onMatchData(handleMatchData);

    const startData = (location.state as any)?.startData;
    if (startData) {
      const userId = nakamaClient.userId!;
      setGame((prev) => ({
        ...prev,
        board: startData.board,
        myMark: startData.marks[userId] || 0,
        activePlayer: startData.activePlayer,
        mode: startData.mode,
        turnDeadline: startData.turnDeadline || 0,
        started: true,
        waitingForOpponent: false,
        playerNames: startData.playerNames || {},
      }));
    } else {
      const passedMode = (location.state as any)?.mode;
      if (passedMode) {
        setGame((prev) => ({ ...prev, mode: passedMode }));
      }
    }

    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, [handleMatchData, navigate, location.state]);

  function handleCellClick(index: number) {
    if (game.gameOver || !game.started) return;
    if (game.activePlayer !== myUserId) {
      showToast("Not your turn!");
      return;
    }
    if (game.board[index] !== 0) return;
    nakamaClient.makeMove(index);
  }

  function handlePlayAgain() {
    nakamaClient.leaveMatch();
    navigate("/lobby", { state: { autoSearch: true, mode: game.mode } });
  }

  function handleGoHome() {
    nakamaClient.leaveMatch();
    navigate("/");
  }

  const isMyTurn = game.activePlayer === myUserId;
  const winLine = findWinningLine(game.board);
  const myName = game.playerNames[myUserId] || "You";
  const opponentId = Object.keys(game.playerNames).find(id => id !== myUserId);
  const opponentName = opponentId ? game.playerNames[opponentId] : "Opponent";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleGoHome}
            className="text-gray-500 hover:text-gray-300 transition text-sm flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Leave
          </button>
          <span className="text-xs text-gray-600 capitalize px-2 py-1 bg-gray-800/50 rounded-lg">
            {game.mode}
          </span>
        </div>

        {/* Player names bar */}
        {game.started && (
          <div className="flex items-center justify-between mb-5 px-3 py-3 bg-gray-900/80 border border-gray-800 rounded-xl">
            <div className={`flex items-center gap-2 ${isMyTurn ? "opacity-100" : "opacity-50"}`}>
              <span className="font-bold text-lg text-blue-400">{game.myMark === 1 ? "X" : "O"}</span>
              <div className="flex flex-col">
                <span className="text-sm text-white font-medium truncate max-w-[100px]">{myName}</span>
                <span className="text-[10px] text-green-400">(you)</span>
              </div>
              {isMyTurn && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            </div>
            <span className="text-gray-600 text-xs font-bold">VS</span>
            <div className={`flex items-center gap-2 ${!isMyTurn && !game.gameOver ? "opacity-100" : "opacity-50"}`}>
              {!isMyTurn && !game.gameOver && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
              <div className="flex flex-col items-end">
                <span className="text-sm text-white font-medium truncate max-w-[100px]">{opponentName}</span>
                <span className="text-[10px] text-red-400">(opp)</span>
              </div>
              <span className="font-bold text-lg text-red-400">{game.myMark === 1 ? "O" : "X"}</span>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {game.waitingForOpponent && (
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-12 text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-4 border-3 border-blue-500 border-t-transparent rounded-full animate-spin-slow" />
            <p className="text-gray-400">Waiting for opponent to join...</p>
          </div>
        )}

        {/* Game area */}
        {!game.waitingForOpponent && (
          <>
            {/* Turn indicator */}
            <div className={`text-center mb-4 py-3 px-4 rounded-xl transition-all duration-300 ${
              game.gameOver
                ? "bg-gray-800/50"
                : isMyTurn
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : "bg-gray-800/50 border border-gray-700/50"
            }`}>
              {game.gameOver ? (
                <span className="text-gray-400">Game Over</span>
              ) : isMyTurn ? (
                <span className="text-blue-400 font-semibold">Your turn!</span>
              ) : (
                <span className="text-gray-400">Opponent&apos;s turn...</span>
              )}
            </div>

            {/* Timer */}
            {game.mode === "timed" && !game.gameOver && (
              <div className="mb-4">
                <Timer deadline={game.turnDeadline} active={game.started && !game.gameOver} />
              </div>
            )}

            {/* Board */}
            <Board
              board={game.board}
              onCellClick={handleCellClick}
              disabled={!isMyTurn || game.gameOver}
              winningLine={winLine}
              myMark={game.myMark}
            />
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/90 text-white text-sm rounded-lg shadow-lg animate-[fadeIn_0.2s_ease-out] z-40">
            {toast}
          </div>
        )}

        {/* Game Over Overlay */}
        {game.gameOver && (
          <GameOverlay
            winner={game.winner}
            winnerUserId={game.winnerUserId}
            myUserId={myUserId}
            myMark={game.myMark}
            reason={game.reason}
            pointsAwarded={game.pointsAwarded}
            onPlayAgain={handlePlayAgain}
            onHome={handleGoHome}
          />
        )}
      </div>
    </div>
  );
}
