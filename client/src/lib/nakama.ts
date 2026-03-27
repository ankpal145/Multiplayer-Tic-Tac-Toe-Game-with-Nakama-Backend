import { Client, Session, Socket, MatchData } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === "true";
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || "defaultkey";

export const OpCode = {
  START: 1,
  UPDATE: 2,
  DONE: 3,
  MOVE: 4,
  TIMER: 5,
  ERROR: 6,
} as const;

export interface StartMessage {
  marks: Record<string, number>;
  activePlayer: string;
  mode: string;
  board: number[];
  turnDeadline: number;
  playerNames: Record<string, string>;
}

export interface UpdateMessage {
  board: number[];
  activePlayer: string;
  turnDeadline: number;
}

export interface DoneMessage {
  board: number[];
  winner: number;
  winnerUserId: string;
  reason: string;
  pointsAwarded: Record<string, number>;
}

export interface TimerMessage {
  secondsRemaining: number;
}

export interface ErrorMessage {
  message: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winStreak: number;
  score: number;
  timePlayed: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  nextCursor: string | null;
  prevCursor: string | null;
}

class NakamaClient {
  private client: Client;
  private session: Session | null = null;
  private socket: Socket | null = null;
  private _matchId: string | null = null;

  constructor() {
    this.client = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
  }

  get matchId() {
    return this._matchId;
  }

  get userId() {
    return this.session?.user_id || null;
  }

  get username() {
    return this.session?.username || null;
  }

  get isConnected() {
    return this.socket !== null && this.session !== null;
  }

  async authenticate(displayName?: string): Promise<Session> {
    let deviceId = localStorage.getItem("nakama_device_id");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("nakama_device_id", deviceId);
    }

    this.session = await this.client.authenticateDevice(deviceId, true);
    localStorage.setItem("nakama_user_id", this.session.user_id!);

    if (displayName && displayName.trim()) {
      const name = displayName.trim();
      const uid = this.session.user_id!.slice(0, 5);
      const safeUsername = name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 14) + "_" + uid;
      try {
        await this.client.updateAccount(this.session, {
          display_name: name,
          username: safeUsername,
        });
      } catch {
        try {
          await this.client.updateAccount(this.session, { display_name: name });
        } catch { /* display_name might already be set */ }
      }
    }

    this.socket = this.client.createSocket(NAKAMA_USE_SSL, false);
    await this.socket.connect(this.session, true);

    return this.session;
  }

  get displayName() {
    return localStorage.getItem("nakama_display_name") || this.session?.username || null;
  }

  async findMatch(mode: string = "classic"): Promise<string> {
    if (!this.session) throw new Error("Not authenticated");

    const result = await this.client.rpc(this.session, "find_match", { mode });
    const payload = result.payload as unknown as { matchIds: string[] };
    const matchId = payload.matchIds[0];

    await this.socket!.joinMatch(matchId);
    this._matchId = matchId;
    return matchId;
  }

  async makeMove(position: number): Promise<void> {
    if (!this.socket || !this._matchId) throw new Error("Not in a match");
    await this.socket.sendMatchState(this._matchId, OpCode.MOVE, JSON.stringify({ position }));
  }

  onMatchData(callback: (data: MatchData) => void): void {
    if (!this.socket) throw new Error("Socket not connected");
    this.socket.onmatchdata = callback;
  }

  onMatchPresence(callback: (event: any) => void): void {
    if (!this.socket) throw new Error("Socket not connected");
    this.socket.onmatchpresence = callback;
  }

  async leaveMatch(): Promise<void> {
    if (this.socket && this._matchId) {
      try {
        await this.socket.leaveMatch(this._matchId);
      } catch {
        // ignore errors on leave
      }
      this._matchId = null;
    }
  }

  async getLeaderboard(limit: number = 20, cursor?: string): Promise<LeaderboardResponse> {
    if (!this.session) throw new Error("Not authenticated");

    const result = await this.client.rpc(
      this.session,
      "get_leaderboard",
      { limit, cursor }
    );
    return result.payload as unknown as LeaderboardResponse;
  }

  async disconnect(): Promise<void> {
    await this.leaveMatch();
    if (this.socket) {
      this.socket.disconnect(true);
      this.socket = null;
    }
  }
}

const nakamaClient = new NakamaClient();
export default nakamaClient;
