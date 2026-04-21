import { createClient, RedisClientType } from 'redis';

export interface Session {
  id: string;
  streamerId: string;
  streamerName: string;
  viewers: string[];
  isActive: boolean;
  createdAt: number;
  offers: Record<string, any>;
  answers: Record<string, any>;
  iceCandidates: Record<string, any[]>;
}

export class SessionManager {
  private redis: RedisClientType;
  private SESSION_PREFIX = 'session:';
  private SIGNAL_PREFIX = 'signal:';
  private ICE_PREFIX = 'ice:';

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  async createSession(sessionId: string, streamerId: string, streamerName: string): Promise<Session> {
    const session: Session = {
      id: sessionId,
      streamerId,
      streamerName,
      viewers: [],
      isActive: false,
      createdAt: Date.now(),
      offers: {},
      answers: {},
      iceCandidates: {},
    };

    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.set(key, JSON.stringify(session), { EX: 3600 }); // 1 hour expiry

    console.log(`[SessionManager] Created session ${sessionId}`);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const updated = { ...session, ...updates };
    const key = `${this.SESSION_PREFIX}${sessionId}`;
    await this.redis.set(key, JSON.stringify(updated), { EX: 3600 });

    return updated;
  }

  async addViewer(sessionId: string, viewerId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    if (!session.viewers.includes(viewerId)) {
      session.viewers.push(viewerId);
      await this.updateSession(sessionId, session);
    }

    console.log(`[SessionManager] Added viewer ${viewerId} to session ${sessionId}`);
    return session;
  }

  async removeViewer(sessionId: string, viewerId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    session.viewers = session.viewers.filter((id) => id !== viewerId);
    await this.updateSession(sessionId, session);

    console.log(`[SessionManager] Removed viewer ${viewerId} from session ${sessionId}`);
    return session;
  }

  async storeOffer(sessionId: string, offer: any): Promise<void> {
    const key = `${this.SIGNAL_PREFIX}${sessionId}:offer`;
    await this.redis.set(key, JSON.stringify(offer), { EX: 3600 });
    console.log(`[SessionManager] Stored offer for session ${sessionId}`);
  }

  async getOffer(sessionId: string): Promise<any | null> {
    const key = `${this.SIGNAL_PREFIX}${sessionId}:offer`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async storeAnswer(sessionId: string, viewerId: string, answer: any): Promise<void> {
    const key = `${this.SIGNAL_PREFIX}${sessionId}:answer:${viewerId}`;
    await this.redis.set(key, JSON.stringify(answer), { EX: 3600 });
    console.log(`[SessionManager] Stored answer for viewer ${viewerId} in session ${sessionId}`);
  }

  async getAnswer(sessionId: string, viewerId: string): Promise<any | null> {
    const key = `${this.SIGNAL_PREFIX}${sessionId}:answer:${viewerId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async addIceCandidate(sessionId: string, userId: string, candidate: any): Promise<void> {
    const key = `${this.ICE_PREFIX}${sessionId}:${userId}`;
    const candidates = await this.redis.lRange(key, 0, -1);
    const parsed = candidates.map((c) => JSON.parse(c));
    parsed.push(candidate);
    
    await this.redis.del(key);
    for (const cand of parsed) {
      await this.redis.rPush(key, JSON.stringify(cand));
    }
    await this.redis.expire(key, 3600);
  }

  async getIceCandidates(sessionId: string, userId: string): Promise<any[]> {
    const key = `${this.ICE_PREFIX}${sessionId}:${userId}`;
    const candidates = await this.redis.lRange(key, 0, -1);
    return candidates.map((c) => JSON.parse(c));
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const keys = [
      `${this.SESSION_PREFIX}${sessionId}`,
      `${this.SIGNAL_PREFIX}${sessionId}:offer`,
      `${this.SIGNAL_PREFIX}${sessionId}:answer:*`,
      `${this.ICE_PREFIX}${sessionId}:*`,
    ];

    for (const pattern of keys) {
      const matchedKeys = await this.redis.keys(pattern);
      if (matchedKeys.length > 0) {
        await this.redis.del(matchedKeys);
      }
    }

    console.log(`[SessionManager] Deleted session ${sessionId}`);
  }

  async getAllSessions(): Promise<Session[]> {
    const keys = await this.redis.keys(`${this.SESSION_PREFIX}*`);
    const sessions: Session[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }

    return sessions;
  }
}
