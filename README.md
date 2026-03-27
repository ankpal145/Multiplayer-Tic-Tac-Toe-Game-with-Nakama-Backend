# XOXO - Multiplayer Tic-Tac-Toe with Nakama Backend

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using [Nakama](https://heroiclabs.com/nakama/) as the backend and **React + Vite + Tailwind CSS** for the frontend.

## Live Demo

| | URL |
|---|---|
| **Game** | [https://multiplayer-tic-tac-toe-game-with-n.vercel.app](https://multiplayer-tic-tac-toe-game-with-n.vercel.app) |
| **Nakama Server** | [https://tictactoe-nakama.duckdns.org](https://tictactoe-nakama.duckdns.org) |
| **Nakama Admin Console** | [http://68.233.103.226:7351](http://68.233.103.226:7351) (login: `admin` / `password`) |

Open the game URL in **two browser tabs** (or two devices) to test multiplayer.

## Architecture

```
┌─────────────────────────┐  WSS/  ┌───────────────────────────────────┐
│   React + Vite Client   │  HTTPS │      Nakama Server (Docker)       │
│                         │◄──────►│                                   │
│  • Auth Screen          │        │  • Device Authentication          │
│  • Lobby / Matchmaking  │ Caddy  │  • Match Handler (TS Runtime)     │
│  • Game Board           │  TLS   │  • find_match RPC                 │
│  • Leaderboard          │        │  • Leaderboard API                │
│  • Timer (timed mode)   │        │  • CockroachDB (persistence)      │
└─────────────────────────┘        └───────────────────────────────────┘
      Vercel (HTTPS)              Oracle Cloud VM + Caddy reverse proxy
```

### How It Works

1. **Authentication** - Client authenticates with `POST /v2/account/authenticate/device`. Nakama returns a JWT session token (2h expiry). The user's display name is set via `PUT /v2/account`.
2. **Matchmaking** - Client calls `POST /v2/rpc/find_match` with a mode (`classic` or `timed`). The server retries up to 3 times to find an open match before creating a new one. The client joins the returned match over WebSocket and waits for a `START` message.
3. **Gameplay** - Once two players join, the server broadcasts `OpCode 1 (START)` with marks and player names. Players send moves as `OpCode 4 (MOVE)`. The server validates every move, checks win conditions, and broadcasts `OpCode 2 (UPDATE)` or `OpCode 3 (DONE)`.
4. **Leaderboard** - After each game, the server updates the player's stats in Nakama storage (wins, losses, draws, streaks, score, time played) and writes the total score to the `player_ranking` leaderboard. The client fetches rankings via `POST /v2/rpc/get_leaderboard`.

### Server-Authoritative Design

All game logic runs on the server to prevent cheating:

- **Move validation** - Only the active player can move, only on empty cells
- **Win detection** - Server checks all 8 winning lines after each move
- **Timer enforcement** - In timed mode, the server auto-forfeits on timeout
- **Disconnect handling** - If a player leaves, the opponent wins automatically

## Project Structure

```
├── client/                          # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board.tsx            # 3x3 interactive game grid
│   │   │   ├── Timer.tsx            # Countdown timer (timed mode)
│   │   │   └── GameOverlay.tsx      # Win/loss/draw result overlay
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx         # Auto device auth + Play button
│   │   │   ├── LobbyPage.tsx        # Mode selection + matchmaking
│   │   │   ├── GamePage.tsx         # Main game screen
│   │   │   └── LeaderboardPage.tsx  # Global rankings table
│   │   ├── lib/
│   │   │   └── nakama.ts            # Nakama client singleton
│   │   ├── App.tsx                  # Route definitions
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Tailwind + custom animations
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── server/                          # Nakama TypeScript runtime module
│   ├── src/
│   │   ├── main.ts                  # InitModule - registers handlers + RPCs
│   │   ├── match_handler.ts         # All 7 match lifecycle functions
│   │   ├── match_rpc.ts             # find_match RPC
│   │   └── leaderboard.ts           # Leaderboard setup + get_leaderboard RPC
│   ├── package.json
│   ├── tsconfig.json
│   └── build/                       # Compiled JS (mounted into Nakama container)
├── docker-compose.yml               # Nakama + CockroachDB for local dev
├── .gitignore
└── README.md
```

## Features

### Core

- **Server-Authoritative Game Logic** - All state management and validation on the server
- **Real-Time Multiplayer** - WebSocket-based communication via Nakama match handler
- **Automatic Matchmaking** - `find_match` RPC finds open games or creates new ones
- **Concurrent Game Support** - Each match runs in its own isolated handler instance
- **Disconnect Handling** - Opponent wins if a player disconnects mid-game

### Bonus

- **Leaderboard System** - Tracks wins, losses, and win streaks with global rankings
- **Timer Mode** - 30-second turn timer with auto-forfeit on timeout
- **Mode Selection** - Choose between Classic (untimed) and Timed modes

### UI/UX

- Mobile-first responsive design
- Dark theme with blue (X) / red (O) accent colors
- Animated turn indicators and win highlighting
- Color-coded countdown timer (green → yellow → red)
- Toast notifications for errors
- ARIA labels for accessibility

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/ankpal145/Multiplayer-Tic-Tac-Toe-Game-with-Nakama-Backend.git
cd Multiplayer-Tic-Tac-Toe-Game-with-Nakama-Backend
```

### 2. Build the server module

```bash
cd server
npm install
npm run build
cd ..
```

This compiles the TypeScript runtime code into `server/build/index.js` which Nakama loads as a module.

### 3. Start Nakama + CockroachDB

```bash
docker compose up -d
```

This starts:
- **CockroachDB** on port 26257 (database)
- **Nakama** on ports 7349 (gRPC), 7350 (HTTP/WebSocket), 7351 (admin console)

Verify Nakama is running by visiting the admin console: http://localhost:7351 (default credentials: `admin` / `password`)

### 4. Start the client dev server

```bash
cd client
npm install
npm run dev
```

The client runs at http://localhost:5173 by default.

### 5. Test multiplayer

Open **two browser tabs** (or two different browsers / incognito windows) to http://localhost:5173. Each tab gets a unique device ID, so they authenticate as different players.

1. In both tabs: the Auth screen connects automatically
2. Tab 1: Click **Play** → choose mode → **Find Match** (creates a new match, waits for opponent)
3. Tab 2: Click **Play** → choose same mode → **Find Match** (joins the existing match)
4. The game starts - take turns clicking cells!

## API Reference

Base URL: `https://tictactoe-nakama.duckdns.org` (production) or `http://localhost:7350` (local)

All authenticated endpoints require the `Authorization` header with a Bearer token obtained from authentication.

---

### 1. Authenticate (Device)

Creates a new account or logs in with an existing device ID.

```
POST /v2/account/authenticate/device?create=true
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Basic base64("defaultkey:")` |
| `Content-Type` | `application/json` |

**Request Body:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response `200 OK`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "created": true
}
```

The `token` is a JWT (expires in 2 hours). Use it as `Bearer <token>` for all subsequent requests.

---

### 2. Update Account (Set Display Name)

Updates the authenticated user's profile.

```
PUT /v2/account
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <session_token>` |
| `Content-Type` | `application/json` |

**Request Body:**

```json
{
  "display_name": "Ace",
  "username": "ace_3f2a1"
}
```

**Response `200 OK`:** Empty body on success.

---

### 3. Find Match (Custom RPC)

Finds an existing open match or creates a new one. Returns the match ID to join.

```
POST /v2/rpc/find_match
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <session_token>` |
| `Content-Type` | `application/json` |

**Request Body:**

```json
{
  "mode": "classic"
}
```

`mode` is `"classic"` (no time limit) or `"timed"` (30s per turn).

**Response `200 OK`:**

```json
{
  "payload": {
    "matchIds": ["b4a3c2d1-e5f6-7890-abcd-ef1234567890.nakama1"]
  }
}
```

---

### 4. Get Leaderboard (Custom RPC)

Returns global player rankings sorted by score, with detailed stats.

```
POST /v2/rpc/get_leaderboard
```

**Headers:**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <session_token>` |
| `Content-Type` | `application/json` |

**Request Body:**

```json
{
  "limit": 20
}
```

**Response `200 OK`:**

```json
{
  "payload": {
    "entries": [
      {
        "rank": 1,
        "userId": "user-uuid-1",
        "username": "Ace",
        "wins": 10,
        "losses": 2,
        "draws": 1,
        "totalGames": 13,
        "winStreak": 5,
        "score": 2100,
        "timePlayed": 480
      }
    ],
    "nextCursor": null,
    "prevCursor": null
  }
}
```

**Score Calculation:** Win = +200 pts, Draw = +100 pts, Loss = +0 pts.

---

### 5. WebSocket Connection

Real-time match communication uses Nakama's WebSocket protocol.

```
WSS /ws?token=<session_token>&status=true&lang=en
```

#### 5a. Join Match

After connecting, send a match join message:

```json
{
  "match_join": {
    "match_id": "b4a3c2d1-e5f6-7890-abcd-ef1234567890.nakama1"
  }
}
```

#### 5b. Send Move (Client → Server)

```json
{
  "match_data_send": {
    "match_id": "<match_id>",
    "op_code": 4,
    "data": "{\"position\": 4}"
  }
}
```

`position` is 0-8 (top-left to bottom-right).

#### 5c. Receive Match Data (Server → Client)

All server messages arrive as `match_data` events:

**OpCode 1 — START** (game begins, both players joined):

```json
{
  "op_code": 1,
  "data": {
    "marks": { "user-id-1": 1, "user-id-2": 2 },
    "activePlayer": "user-id-1",
    "mode": "classic",
    "board": [0,0,0,0,0,0,0,0,0],
    "turnDeadline": 0,
    "playerNames": { "user-id-1": "Ace", "user-id-2": "Boo" }
  }
}
```

**OpCode 2 — UPDATE** (board state after a valid move):

```json
{
  "op_code": 2,
  "data": {
    "board": [1,0,0,0,2,0,0,0,0],
    "activePlayer": "user-id-2",
    "turnDeadline": 1711584000
  }
}
```

**OpCode 3 — DONE** (game over):

```json
{
  "op_code": 3,
  "data": {
    "board": [1,1,1,2,2,0,0,0,0],
    "winner": 1,
    "winnerUserId": "user-id-1",
    "reason": "win",
    "pointsAwarded": { "user-id-1": 200, "user-id-2": 0 }
  }
}
```

`winner`: 0 = none, 1 = X, 2 = O, 3 = draw. `reason`: `"win"`, `"draw"`, `"timeout"`, `"opponent_left"`, `"server_shutdown"`.

**OpCode 5 — TIMER** (timed mode countdown sync):

```json
{
  "op_code": 5,
  "data": { "secondsRemaining": 18 }
}
```

**OpCode 6 — ERROR** (invalid action):

```json
{
  "op_code": 6,
  "data": { "message": "Not your turn." }
}
```

---

### 6. Nakama Admin Console

```
GET http://<server-ip>:7351
```

**Credentials:** Username `admin`, Password `password`

Provides a web UI for inspecting accounts, matches, leaderboards, and storage objects.

---

## Server Configuration

### Nakama Docker Compose Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Image | `heroiclabs/nakama:3.24.2` | Nakama server version |
| Database | CockroachDB 23.1 | Persistent storage |
| Logger level | INFO (production) / DEBUG (dev) | Log verbosity |
| Session token expiry | 7200s (2h) | JWT session lifetime |
| Socket server key | `defaultkey` | Client authentication key |
| Modules path | `/nakama/data/modules` | Mounted from `server/build/` |

### Environment Variables (Client)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_NAKAMA_HOST` | `127.0.0.1` | Nakama server hostname |
| `VITE_NAKAMA_PORT` | `7350` | Nakama HTTP/WS port |
| `VITE_NAKAMA_USE_SSL` | `false` | Enable HTTPS/WSS |
| `VITE_NAKAMA_KEY` | `defaultkey` | Nakama server key |

## Deployment

The game is currently deployed on **Oracle Cloud** (Nakama backend) and **Vercel** (frontend).

### Current Production Setup

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | [multiplayer-tic-tac-toe-game-with-n.vercel.app](https://multiplayer-tic-tac-toe-game-with-n.vercel.app) |
| Nakama API | Oracle Cloud + Caddy | [tictactoe-nakama.duckdns.org](https://tictactoe-nakama.duckdns.org) |
| Admin Console | Oracle Cloud | [68.233.103.226:7351](http://68.233.103.226:7351) |

### Nakama Server (Cloud VM)

Any cloud provider with Docker support works. The current setup uses Oracle Cloud Always Free Tier (Ubuntu 24.04).

#### 1. Provision a VM and install Docker

```bash
ssh ubuntu@YOUR_SERVER_IP

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2. (Recommended) Add swap on low-memory VMs

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### 3. Deploy Nakama

```bash
mkdir -p ~/nakama/server/build

# From your local machine:
scp docker-compose.yml ubuntu@YOUR_SERVER_IP:~/nakama/
scp server/build/index.js ubuntu@YOUR_SERVER_IP:~/nakama/server/build/

# On the server:
cd ~/nakama
docker compose up -d
```

#### 4. HTTPS with Caddy (required for Vercel frontend)

Since Vercel serves over HTTPS, the Nakama API must also use HTTPS to avoid mixed-content errors. [Caddy](https://caddyserver.com/) handles this automatically with free Let's Encrypt certificates.

```bash
sudo apt-get install -y caddy

echo 'your-domain.example.com {
    reverse_proxy localhost:7350
}' | sudo tee /etc/caddy/Caddyfile

sudo systemctl restart caddy
```

A free domain from [DuckDNS](https://www.duckdns.org) works well for this.

#### 5. Open firewall ports

```bash
# OS firewall
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 7350 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 7351 -j ACCEPT
sudo netfilter-persistent save
```

Also open ports 80, 443, 7350, and 7351 in your cloud provider's security group / firewall rules.

### Frontend on Vercel

#### 1. Import repository

Go to [vercel.com](https://vercel.com), import the GitHub repository.

#### 2. Configure build settings

- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

#### 3. Set environment variables

| Variable | Value |
|----------|-------|
| `VITE_NAKAMA_HOST` | Your Caddy domain (e.g. `tictactoe-nakama.duckdns.org`) |
| `VITE_NAKAMA_PORT` | `443` |
| `VITE_NAKAMA_USE_SSL` | `true` |
| `VITE_NAKAMA_KEY` | `defaultkey` |

#### 4. Deploy

Click Deploy. Vercel builds and hosts the static Vite app.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Nakama TypeScript runtime** | First-class type safety for match handlers; same language as frontend |
| **Server-authoritative matches** | Prevents cheating; single source of truth for game state |
| **Device authentication** | Zero-friction onboarding; no signup required |
| **`find_match` RPC pattern** | Simpler than Nakama's matchmaker for 1v1; instant join or create |
| **esbuild bundler** | Fast builds (<50ms); bundles all server TS into single JS file |
| **React + Vite** | Fast dev server with HMR; optimized production builds |
| **Tailwind CSS v4** | Utility-first styling; no CSS files to maintain; dark theme built-in |
| **CockroachDB** | Nakama's recommended database; horizontally scalable |

## License

MIT
