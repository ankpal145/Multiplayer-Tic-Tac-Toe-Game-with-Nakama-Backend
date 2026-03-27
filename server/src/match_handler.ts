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

const SCORE_WIN = 200;
const SCORE_DRAW = 100;

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  currentStreak: number;
  bestStreak: number;
  score: number;
  timePlayed: number;
}

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
  startedAt: number;
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

function readPlayerStats(nk: nkruntime.Nakama, playerId: string): PlayerStats {
  const defaults: PlayerStats = {
    wins: 0, losses: 0, draws: 0, totalGames: 0,
    currentStreak: 0, bestStreak: 0, score: 0, timePlayed: 0,
  };
  try {
    const objects = nk.storageRead([{ collection: "player_stats", key: "stats", userId: playerId }]);
    if (objects && objects.length > 0 && objects[0].value) {
      const v = objects[0].value as { [key: string]: any };
      return {
        wins: Number(v["wins"]) || 0,
        losses: Number(v["losses"]) || 0,
        draws: Number(v["draws"]) || 0,
        totalGames: Number(v["totalGames"]) || 0,
        currentStreak: Number(v["currentStreak"]) || 0,
        bestStreak: Number(v["bestStreak"]) || 0,
        score: Number(v["score"]) || 0,
        timePlayed: Number(v["timePlayed"]) || 0,
      };
    }
  } catch {}
  return defaults;
}

function updatePlayerStats(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  playerId: string,
  outcome: "win" | "loss" | "draw",
  elapsedSec: number
) {
  const stats = readPlayerStats(nk, playerId);

  stats.totalGames++;
  stats.timePlayed += elapsedSec;

  if (outcome === "win") {
    stats.wins++;
    stats.score += SCORE_WIN;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
  } else if (outcome === "loss") {
    stats.losses++;
    stats.currentStreak = 0;
  } else {
    stats.draws++;
    stats.score += SCORE_DRAW;
    stats.currentStreak = 0;
  }

  try {
    nk.storageWrite([{
      collection: "player_stats",
      key: "stats",
      userId: playerId,
      value: stats as unknown as { [key: string]: any },
      permissionRead: 2,
      permissionWrite: 0,
    }]);
  } catch (e) {
    logger.error("Failed to write player_stats for %s: %s", playerId, e);
  }

  try {
    nk.leaderboardRecordWrite("player_ranking", playerId, undefined, stats.score, 0, undefined);
  } catch (e) {
    logger.error("Failed to write player_ranking for %s: %s", playerId, e);
  }
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
    startedAt: 0,
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
        s.marks[presence.userId] = 1;
        s.playerOrder.push(presence.userId);
      } else if (s.playerOrder.length === 1) {
        s.marks[presence.userId] = 2;
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

    s.startedAt = Math.floor(Date.now() / 1000);

    if (s.mode === "timed") {
      s.turnDeadline = Math.floor(Date.now() / 1000) + TURN_TIME_LIMIT_SEC;
    }

    const playerNames: { [userId: string]: string } = {};
    try {
      const accounts = nk.accountsGetId(s.playerOrder);
      if (accounts) {
        for (const acc of accounts) {
          if (acc.user) {
            playerNames[acc.user.id] = acc.user.displayName || acc.user.username || "Player";
          }
        }
      }
    } catch {
      for (const uid of s.playerOrder) {
        const p = s.presences[uid];
        playerNames[uid] = p?.username || "Player";
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
      pointsAwarded: { [winnerId]: SCORE_WIN, [loserId]: 0 },
    };
    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

    const elapsed = s.startedAt > 0 ? Math.floor(Date.now() / 1000) - s.startedAt : 0;
    updatePlayerStats(nk, logger, winnerId, "win", elapsed);
    updatePlayerStats(nk, logger, loserId, "loss", elapsed);
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
        pointsAwarded: { [winnerId]: SCORE_WIN, [loserId]: 0 },
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      const elapsed = s.startedAt > 0 ? Math.floor(Date.now() / 1000) - s.startedAt : 0;
      updatePlayerStats(nk, logger, winnerId, "win", elapsed);
      updatePlayerStats(nk, logger, loserId, "loss", elapsed);

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
        pointsAwarded: { [winnerId]: SCORE_WIN, [loserId]: 0 },
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      const elapsed = s.startedAt > 0 ? Math.floor(Date.now() / 1000) - s.startedAt : 0;
      updatePlayerStats(nk, logger, winnerId, "win", elapsed);
      updatePlayerStats(nk, logger, loserId, "loss", elapsed);

      return { state: s };
    }

    if (isDraw(s.board)) {
      s.winner = 3;
      s.gameOver = true;

      const pointsAwarded: { [id: string]: number } = {};
      for (const pid of s.playerOrder) pointsAwarded[pid] = SCORE_DRAW;

      const doneMsg = {
        board: s.board,
        winner: 3,
        winnerUserId: "",
        reason: "draw",
        pointsAwarded,
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));

      const elapsed = s.startedAt > 0 ? Math.floor(Date.now() / 1000) - s.startedAt : 0;
      for (const playerId of s.playerOrder) {
        updatePlayerStats(nk, logger, playerId, "draw", elapsed);
      }

      return { state: s };
    }

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
