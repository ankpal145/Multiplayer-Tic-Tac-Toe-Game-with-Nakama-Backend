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
          setGame((prev) => ({
            ...prev,
            board: msg.board,
            gameOver: true,
            winner: msg.winner,
            winnerUserId: msg.winnerUserId,
            reason: msg.reason,
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

    const passedMode = (location.state as any)?.mode;
    if (passedMode) {
      setGame((prev) => ({ ...prev, mode: passedMode }));
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

  async function handlePlayAgain() {
    await nakamaClient.leaveMatch();
    setGame(initialGameState);
    try {
      await nakamaClient.findMatch(game.mode);
    } catch {
      navigate("/lobby");
      return;
    }
  }

  function handleGoHome() {
    nakamaClient.leaveMatch();
    navigate("/");
  }

  const isMyTurn = game.activePlayer === myUserId;
  const winLine = findWinningLine(game.board);
  const markLabel = game.myMark === 1 ? "X" : game.myMark === 2 ? "O" : "?";
  const markColor = game.myMark === 1 ? "text-blue-400" : "text-red-400";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleGoHome}
            className="text-gray-500 hover:text-gray-300 transition text-sm flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Leave
          </button>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">You:</span>
            <span className={`font-bold text-lg ${markColor}`}>{markLabel}</span>
          </div>

          <span className="text-xs text-gray-600 capitalize px-2 py-1 bg-gray-800/50 rounded-lg">
            {game.mode}
          </span>
        </div>

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
            onPlayAgain={handlePlayAgain}
            onHome={handleGoHome}
          />
        )}
      </div>
    </div>
  );
}
