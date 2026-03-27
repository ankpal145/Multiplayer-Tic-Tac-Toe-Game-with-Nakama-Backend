# XOXO - Multiplayer Tic-Tac-Toe with Nakama Backend

A production-ready, real-time multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using [Nakama](https://heroiclabs.com/nakama/) as the backend and **React + Vite + Tailwind CSS** for the frontend.

## Architecture

```
┌─────────────────────────┐         ┌───────────────────────────────────┐
│   React + Vite Client   │  WS/HTTP│      Nakama Server (Docker)       │
│                         │◄────────►                                   │
│  • Auth Screen          │         │  • Device Authentication          │
│  • Lobby / Matchmaking  │ :7350   │  • Match Handler (TS Runtime)     │
│  • Game Board           │         │  • find_match RPC                 │
│  • Leaderboard          │         │  • Leaderboard API                │
│  • Timer (timed mode)   │         │  • CockroachDB (persistence)      │
└─────────────────────────┘         └───────────────────────────────────┘
      Vercel / Static                     DigitalOcean Droplet
```

### How It Works

1. **Authentication** - Client connects via device authentication (UUID stored in localStorage). Nakama creates/returns a session with JWT tokens.
2. **Matchmaking** - Client calls the `find_match` RPC with a mode (`classic` or `timed`). The server either finds an open match or creates a new one.
3. **Gameplay** - Once two players join, the server broadcasts game start. Players send moves via WebSocket. The server validates every move, checks win conditions, and broadcasts state updates.
4. **Leaderboard** - After each game, the server writes to three Nakama leaderboards (wins, losses, win_streak). The client fetches aggregated stats via `get_leaderboard` RPC.

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

## OpCode Protocol

Communication between client and server uses numeric operation codes:

| OpCode | Direction | Name | Payload |
|--------|-----------|------|---------|
| 1 | Server → Client | START | `{ marks: {userId: 1\|2}, activePlayer, mode, board, turnDeadline }` |
| 2 | Server → Client | UPDATE | `{ board, activePlayer, turnDeadline }` |
| 3 | Server → Client | DONE | `{ board, winner, winnerUserId, reason }` |
| 4 | Client → Server | MOVE | `{ position }` (0-8) |
| 5 | Server → Client | TIMER | `{ secondsRemaining }` |
| 6 | Server → Client | ERROR | `{ message }` |

**Winner values:** 0 = none, 1 = X won, 2 = O won, 3 = draw

**Reason values:** `"win"`, `"draw"`, `"timeout"`, `"opponent_left"`, `"server_shutdown"`

## Server Configuration

### Nakama Docker Compose Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Image | `nakama:3.24.2` | Nakama server version |
| Database | CockroachDB 23.1 | Persistent storage |
| Logger level | DEBUG | Full logging for development |
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

### Nakama Server on DigitalOcean

#### 1. Create a Droplet

- **Image:** Ubuntu 24.04
- **Size:** 2 vCPU / 2 GB RAM (Basic Droplet, ~$18/mo)
- **Region:** Choose closest to your users

#### 2. Install Docker

```bash
ssh root@YOUR_DROPLET_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin
```

#### 3. Deploy Nakama

```bash
# Create project directory
mkdir -p /opt/nakama/server/build

# Copy files to the droplet (run from your local machine)
scp docker-compose.yml root@YOUR_DROPLET_IP:/opt/nakama/
scp server/build/index.js root@YOUR_DROPLET_IP:/opt/nakama/server/build/
```

#### 4. Configure for production

On the droplet, edit `/opt/nakama/docker-compose.yml`:

- Change `--socket.server_key "defaultkey"` to a strong random key
- Change `--logger.level DEBUG` to `--logger.level INFO`
- Add `restart: always` to both services

```bash
cd /opt/nakama
docker compose up -d
```

#### 5. Configure firewall

```bash
ufw allow 7350/tcp   # Nakama API/WebSocket
ufw allow 7351/tcp   # Admin console (restrict to your IP in production)
ufw enable
```

#### 6. (Optional) HTTPS with Nginx

For production, set up Nginx as a reverse proxy with Let's Encrypt:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx to proxy /nakama to localhost:7350
# Then: certbot --nginx -d your-domain.com
```

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
| `VITE_NAKAMA_HOST` | Your Droplet IP or domain |
| `VITE_NAKAMA_PORT` | `7350` |
| `VITE_NAKAMA_USE_SSL` | `true` (if using HTTPS) or `false` |
| `VITE_NAKAMA_KEY` | Your server key |

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
