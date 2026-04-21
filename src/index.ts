import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { SessionManager } from './lib/sessionManager';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Redis setup
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redis.on('error', (err) => console.error('[Redis] Error:', err));
redis.on('connect', () => console.log('[Redis] Connected'));

// Session manager
let sessionManager: SessionManager;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  socket.on('join-session', async (data) => {
    const { sessionId, userId, userName, isStreamer } = data;
    console.log(`[Socket.IO] join-session: sessionId=${sessionId}, userId=${userId}, isStreamer=${isStreamer}`);

    try {
      let session = await sessionManager.getSession(sessionId);

      if (!session) {
        if (isStreamer) {
          session = await sessionManager.createSession(sessionId, userId, userName);
        } else {
          return socket.emit('error', 'Session not found');
        }
      }

      if (!isStreamer) {
        session = await sessionManager.addViewer(sessionId, userId);
      }

      // Join socket room
      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.userId = userId;

      // Notify others
      io.to(sessionId).emit('session-updated', session);

      // If viewer is joining and there's a stored offer, send it immediately
      if (!isStreamer) {
        const storedOffer = await sessionManager.getOffer(sessionId);
        if (storedOffer) {
          console.log(`[Socket.IO] Sending stored offer to viewer ${userId}`);
          socket.emit('offer-available', { offer: storedOffer });
        }
      }

      socket.emit('join-success', { session });
    } catch (error) {
      console.error('[Socket.IO] Error in join-session:', error);
      socket.emit('error', 'Failed to join session');
    }
  });

  socket.on('webrtc-offer', async (data) => {
    const { sessionId, offer } = data;
    console.log(`[Socket.IO] webrtc-offer for session ${sessionId}`);

    try {
      await sessionManager.storeOffer(sessionId, offer);
      io.to(sessionId).emit('offer-available', { offer });
    } catch (error) {
      console.error('[Socket.IO] Error in webrtc-offer:', error);
    }
  });

  socket.on('webrtc-answer', async (data) => {
    const { sessionId, viewerId, answer } = data;
    console.log(`[Socket.IO] webrtc-answer from viewer ${viewerId} for session ${sessionId}`);

    try {
      await sessionManager.storeAnswer(sessionId, viewerId, answer);
      io.to(sessionId).emit('answer-available', { viewerId, answer });
    } catch (error) {
      console.error('[Socket.IO] Error in webrtc-answer:', error);
    }
  });

  socket.on('ice-candidate', async (data) => {
    const { sessionId, userId, candidate } = data;

    try {
      await sessionManager.addIceCandidate(sessionId, userId, candidate);
      io.to(sessionId).emit('ice-candidate', { userId, candidate });
    } catch (error) {
      console.error('[Socket.IO] Error in ice-candidate:', error);
    }
  });

  socket.on('start-stream', async (data) => {
    const { sessionId } = data;
    console.log(`[Socket.IO] start-stream for session ${sessionId}`);

    try {
      const session = await sessionManager.updateSession(sessionId, { isActive: true });
      io.to(sessionId).emit('stream-started', { session });
    } catch (error) {
      console.error('[Socket.IO] Error in start-stream:', error);
    }
  });

  socket.on('stop-stream', async (data) => {
    const { sessionId } = data;
    console.log(`[Socket.IO] stop-stream for session ${sessionId}`);

    try {
      const session = await sessionManager.updateSession(sessionId, { isActive: false });
      io.to(sessionId).emit('stream-stopped', { session });
    } catch (error) {
      console.error('[Socket.IO] Error in stop-stream:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);

    const sessionId = socket.data.sessionId;
    const userId = socket.data.userId;

    if (sessionId && userId) {
      try {
        const session = await sessionManager.removeViewer(sessionId, userId);
        io.to(sessionId).emit('session-updated', { session });

        // Clean up sessions only when streamer disconnects
        if (session && userId === session.streamerId) {
          console.log(`[Socket.IO] Streamer disconnected, deleting session ${sessionId}`);
          await sessionManager.deleteSession(sessionId);
        }
      } catch (error) {
        console.error('[Socket.IO] Error in disconnect:', error);
      }
    }
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3001');

const startServer = async () => {
  try {
    // Connect Redis
    await redis.connect();
    sessionManager = new SessionManager(redis);

    httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🔗 CORS enabled for: ${process.env.CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📌 Shutting down gracefully...');
  await redis.quit();
  httpServer.close();
  process.exit(0);
});
