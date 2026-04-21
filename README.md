# 🎥 Streaming Mallu - Backend Server

WebRTC Signalling Server mit Socket.IO und Redis für Screen Sharing Applikation.

## 🚀 Features

- **Socket.IO** - Real-time WebRTC signalling
- **Redis** - Persistent session storage
- **TypeScript** - Type-safe code
- **Docker** - Production-ready containerization

## 📋 Requirements

- Node.js 18+
- Redis 6+ (oder via Docker)
- npm/yarn

## 🛠️ Setup

### Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

3. **Start Redis (separate terminal):**
   ```bash
   # Option A: Using Docker
   docker run -d -p 6379:6379 redis:7-alpine
   
   # Option B: Using existing Redis
   redis-server
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

Server läuft auf `http://localhost:3001`

### Docker (Production)

```bash
# Build und starten
docker-compose up -d

# Logs anschauen
docker-compose logs -f backend

# Stoppen
docker-compose down
```

## 🔌 Socket.IO Events

### Client → Server

- **join-session**
  ```javascript
  socket.emit('join-session', {
    sessionId: string,
    userId: string,
    userName: string,
    isStreamer: boolean
  })
  ```

- **webrtc-offer**
  ```javascript
  socket.emit('webrtc-offer', {
    sessionId: string,
    offer: RTCSessionDescriptionInit
  })
  ```

- **webrtc-answer**
  ```javascript
  socket.emit('webrtc-answer', {
    sessionId: string,
    viewerId: string,
    answer: RTCSessionDescriptionInit
  })
  ```

- **ice-candidate**
  ```javascript
  socket.emit('ice-candidate', {
    sessionId: string,
    userId: string,
    candidate: RTCIceCandidateInit
  })
  ```

- **start-stream**
  ```javascript
  socket.emit('start-stream', {
    sessionId: string
  })
  ```

- **stop-stream**
  ```javascript
  socket.emit('stop-stream', {
    sessionId: string
  })
  ```

### Server → Client

- **join-success** - Erfolgreiches Join mit Session
- **session-updated** - Session wurde aktualisiert
- **offer-available** - Neues Offer verfügbar
- **answer-available** - Answer von Viewer verfügbar
- **ice-candidate** - ICE Candidate empfangen
- **stream-started** - Stream gestartet
- **stream-stopped** - Stream gestoppt
- **error** - Fehler bei Operation

## 🌍 Environment Variables

```
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## 🔗 Integration mit Next.js Frontend

Ändere die Next.js App um sich zu diesem Server zu verbinden:

```typescript
// Ersetze HTTP Polling mit Socket.IO
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001');
```

## 📦 Build & Deployment

```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Type check
npm run type-check
```

## 🐳 Docker Hub Deployment

```bash
# Build Docker image
docker build -t streaming-mallu-backend .

# Run container
docker run -p 3001:3001 \
  -e REDIS_HOST=your-redis-host \
  -e CORS_ORIGIN=https://your-frontend.com \
  streaming-mallu-backend
```

## 📊 Logs

Server gibt detaillierte Logs für Debugging:

```
[Socket.IO] User connected: abc123
[SessionManager] Created session session-xyz
[Socket.IO] join-session: sessionId=session-xyz, userId=user1, isStreamer=true
```

## 🔒 Security Notes

- Redis sollte mit Authentifizierung protected sein
- CORS_ORIGIN muss auf deine Frontend-URL gesetzt sein
- Verwende HTTPS/WSS für Production
- Redis mit Firewall schützen (nur Backend kann Zugriff)

## 🚨 Troubleshooting

**"Cannot connect to Redis"**
- Redis läuft? `redis-cli ping`
- Host/Port korrekt in .env?

**"CORS errors"**
- CORS_ORIGIN in .env mit Frontend URL?

**"Sessions verschwinden"**
- Redis Expiry ist 1 Stunde
- Länger brauchbar? `sessionManager.ts` anpassen

## 📝 License

MIT
