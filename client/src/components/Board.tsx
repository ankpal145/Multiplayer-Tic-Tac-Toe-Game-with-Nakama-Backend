interface BoardProps {
  board: number[];
  onCellClick: (index: number) => void;
  disabled: boolean;
  winningLine: number[] | null;
  myMark: number;
}

export default function Board({ board, onCellClick, disabled, winningLine, myMark }: BoardProps) {
  return (
    <div
      className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto aspect-square"
      role="grid"
      aria-label="Tic-Tac-Toe board"
    >
      {board.map((cell, index) => {
        const isWinCell = winningLine?.includes(index);
        const isEmpty = cell === 0;

        return (
          <button
            key={index}
            onClick={() => onCellClick(index)}
            disabled={disabled || !isEmpty}
            className={`
              aspect-square rounded-xl text-5xl font-black flex items-center justify-center
              transition-all duration-200 cursor-pointer
              ${isEmpty && !disabled
                ? "bg-gray-800/80 hover:bg-gray-700/80 hover:scale-105 active:scale-95"
                : "bg-gray-800/50"
              }
              ${isWinCell ? "ring-2 ring-yellow-400 bg-yellow-400/10 scale-105" : ""}
              ${disabled && isEmpty ? "cursor-not-allowed opacity-50" : ""}
              ${!isEmpty ? "cursor-default" : ""}
            `}
            aria-label={`Cell ${index + 1}: ${cell === 0 ? "empty" : cell === 1 ? "X" : "O"}`}
          >
            {cell === 1 && (
              <span className={`text-blue-400 ${isWinCell ? "animate-pulse-slow" : ""} drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]`}>
                X
              </span>
            )}
            {cell === 2 && (
              <span className={`text-red-400 ${isWinCell ? "animate-pulse-slow" : ""} drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]`}>
                O
              </span>
            )}
            {isEmpty && !disabled && (
              <span className="text-gray-700 text-3xl opacity-0 hover:opacity-30 transition-opacity">
                {myMark === 1 ? "X" : "O"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
