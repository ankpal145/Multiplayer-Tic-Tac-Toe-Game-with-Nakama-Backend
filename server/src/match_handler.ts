export const OpCode = {
  START: 1,
  UPDATE: 2,
  DONE: 3,
  MOVE: 4,
  TIMER: 5,
  ERROR: 6,
};

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const TURN_TIME_LIMIT_SEC = 30;

interface MatchState {
  board: number[];
  marks: { [userId: string]: number };
  activePlayer: string;
  presences: { [userId: string]: nkruntime.Presence };
  gameOver: boolean;
  winner: number;
  mode: string;
  turnDeadline: number;
  moveCount: number;
  playerOrder: string[];
  label: MatchLabel;
}

interface MatchLabel {
  open: number;
  mode: string;
}

function checkWinner(board: number[]): number {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return 0;
}

function isDraw(board: number[]): boolean {
  return board.every(cell => cell !== 0);
}

export const matchInit: nkruntime.MatchInitFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
) {
  const mode = params["mode"] || "classic";
  const label: MatchLabel = { open: 1, mode };

  const state: MatchState = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    marks: {},
    activePlayer: "",
    presences: {},
    gameOver: false,
    winner: 0,
    mode,
    turnDeadline: 0,
    moveCount: 0,
    playerOrder: [],
    label,
  };

  const tickRate = mode === "timed" ? 10 : 5;

  return {
    state,
    tickRate,
    label: JSON.stringify(label),
  };
};

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
) {
  const s = state as MatchState;

  if (s.gameOver) {
    return { state: s, accept: false, rejectMessage: "Match is already over." };
  }

  const playerCount = Object.keys(s.presences).length;
  if (playerCount >= 2) {
    return { state: s, accept: false, rejectMessage: "Match is full." };
  }

  return { state: s, accept: true };
};

export const matchJoin: nkruntime.MatchJoinFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
) {
  const s = state as MatchState;

  for (const presence of presences) {
    s.presences[presence.userId] = presence;

    if (!s.marks[presence.userId]) {
      if (s.playerOrder.length === 0) {
        s.marks[presence.userId] = 1; // X
        s.playerOrder.push(presence.userId);
      } else if (s.playerOrder.length === 1) {
        s.marks[presence.userId] = 2; // O
        s.playerOrder.push(presence.userId);
      }
    }

    logger.debug("Player %s joined, mark: %d", presence.userId, s.marks[presence.userId]);
  }

  const playerCount = Object.keys(s.presences).length;

  if (playerCount === 2 && !s.activePlayer) {
    s.activePlayer = s.playerOrder[0];

    s.label.open = 0;
    dispatcher.matchLabelUpdate(JSON.stringify(s.label));

    if (s.mode === "timed") {
      s.turnDeadline = Math.floor(Date.now() / 1000) + TURN_TIME_LIMIT_SEC;
    }

    const playerNames: { [userId: string]: string } = {};
    for (const uid of s.playerOrder) {
      const p = s.presences[uid];
      if (p) {
        try {
          const accounts = nk.accountsGetId([uid]);
          if (accounts && accounts.length > 0) {
            playerNames[uid] = accounts[0].user?.displayName || accounts[0].user?.username || "Player";
          } else {
            playerNames[uid] = p.username || "Player";
          }
        } catch {
          playerNames[uid] = p.username || "Player";
        }
      }
    }

    const startMsg = {
      marks: s.marks,
      activePlayer: s.activePlayer,
      mode: s.mode,
      board: s.board,
      turnDeadline: s.turnDeadline,
      playerNames,
    };

    dispatcher.broadcastMessage(OpCode.START, JSON.stringify(startMsg));
    logger.info("Match started: %s vs %s", s.playerOrder[0], s.playerOrder[1]);
  }

  return { state: s };
};

export const matchLeave: nkruntime.MatchLeaveFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
) {
  const s = state as MatchState;

  for (const presence of presences) {
    logger.info("Player %s left", presence.userId);
    delete s.presences[presence.userId];
  }

  const remainingPlayers = Object.keys(s.presences);

  if (!s.gameOver && s.playerOrder.length === 2 && remainingPlayers.length === 1) {
    const winnerId = remainingPlayers[0];
    const loserId = presences[0].userId;
    s.winner = s.marks[winnerId];
    s.gameOver = true;

    const doneMsg = {
      board: s.board,
      winner: s.winner,
      winnerUserId: winnerId,
      reason: "opponent_left",
    };
    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

    writeGameResult(nk, logger, winnerId, loserId);
  }

  if (remainingPlayers.length === 0) {
    return null;
  }

  return { state: s };
};

export const matchLoop: nkruntime.MatchLoopFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
) {
  const s = state as MatchState;

  if (s.gameOver) {
    if (Object.keys(s.presences).length === 0) {
      return null;
    }
    return { state: s };
  }

  if (!s.activePlayer) {
    return { state: s };
  }

  // Timer check for timed mode
  if (s.mode === "timed" && s.turnDeadline > 0) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = s.turnDeadline - now;

    if (tick % 10 === 0 && remaining > 0) {
      dispatcher.broadcastMessage(OpCode.TIMER, JSON.stringify({ secondsRemaining: remaining }));
    }

    if (remaining <= 0) {
      const loserId = s.activePlayer;
      const winnerId = s.playerOrder.find(id => id !== loserId)!;
      s.winner = s.marks[winnerId];
      s.gameOver = true;

      const doneMsg = {
        board: s.board,
        winner: s.winner,
        winnerUserId: winnerId,
        reason: "timeout",
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      writeGameResult(nk, logger, winnerId, loserId);

      return { state: s };
    }
  }

  for (const message of messages) {
    if (message.opCode !== OpCode.MOVE) {
      continue;
    }

    if (message.sender.userId !== s.activePlayer) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: "Not your turn." }),
        [message.sender]
      );
      continue;
    }

    let data: { position: number };
    try {
      data = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: "Invalid move data." }),
        [message.sender]
      );
      continue;
    }

    const pos = data.position;
    if (pos < 0 || pos > 8 || s.board[pos] !== 0) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: "Invalid move position." }),
        [message.sender]
      );
      continue;
    }

    s.board[pos] = s.marks[message.sender.userId];
    s.moveCount++;

    const winner = checkWinner(s.board);
    if (winner !== 0) {
      s.winner = winner;
      s.gameOver = true;

      const winnerId = Object.keys(s.marks).find(id => s.marks[id] === winner)!;
      const loserId = Object.keys(s.marks).find(id => s.marks[id] !== winner)!;

      const doneMsg = {
        board: s.board,
        winner: s.winner,
        winnerUserId: winnerId,
        reason: "win",
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      writeGameResult(nk, logger, winnerId, loserId);

      return { state: s };
    }

    if (isDraw(s.board)) {
      s.winner = 3;
      s.gameOver = true;

      const doneMsg = {
        board: s.board,
        winner: 3,
        winnerUserId: "",
        reason: "draw",
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      for (const playerId of s.playerOrder) {
        try {
          nk.leaderboardRecordWrite("draws", playerId, undefined, 1, undefined, undefined);
          nk.leaderboardRecordWrite("total_games", playerId, undefined, 1, undefined, undefined);
          nk.leaderboardRecordWrite("win_streak", playerId, undefined, 0, undefined, undefined);
        } catch (e) {
          logger.error("Failed to write draw stats for %s: %s", playerId, e);
        }
      }

      return { state: s };
    }

    // Switch active player
    s.activePlayer = s.playerOrder.find(id => id !== s.activePlayer)!;

    if (s.mode === "timed") {
      s.turnDeadline = Math.floor(Date.now() / 1000) + TURN_TIME_LIMIT_SEC;
    }

    const updateMsg = {
      board: s.board,
      activePlayer: s.activePlayer,
      turnDeadline: s.turnDeadline,
    };
    dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(updateMsg));
  }

  return { state: s };
};

export const matchTerminate: nkruntime.MatchTerminateFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
) {
  const s = state as MatchState;

  if (!s.gameOver) {
    const doneMsg = {
      board: s.board,
      winner: 0,
      winnerUserId: "",
      reason: "server_shutdown",
    };
    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));
  }

  return { state: s };
};

export const matchSignal: nkruntime.MatchSignalFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
) {
  logger.debug("Match signal received: %s", data);
  return { state, data: "signal_ok" };
};

function writeGameResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  winnerId: string,
  loserId: string
) {
  try {
    nk.leaderboardRecordWrite("wins", winnerId, undefined, 1, undefined, undefined);
    nk.leaderboardRecordWrite("win_streak", winnerId, undefined, 1, undefined, undefined);
    nk.leaderboardRecordWrite("total_games", winnerId, undefined, 1, undefined, undefined);
  } catch (e) {
    logger.error("Failed to write winner leaderboard for %s: %s", winnerId, e);
  }

  try {
    nk.leaderboardRecordWrite("losses", loserId, undefined, 1, undefined, undefined);
    nk.leaderboardRecordWrite("win_streak", loserId, undefined, 0, undefined, undefined);
    nk.leaderboardRecordWrite("total_games", loserId, undefined, 1, undefined, undefined);
  } catch (e) {
    logger.error("Failed to write loser leaderboard for %s: %s", loserId, e);
  }
}
