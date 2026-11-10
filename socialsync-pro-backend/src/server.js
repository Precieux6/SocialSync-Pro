// socialsync-pro-backend/src/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import calendarRoutes from './routes/calendar.js';
import videosRoutes from './routes/videos.js';
import commentsRoutes from './routes/comments.js';
import teamRoutes from './routes/team.js';
import aiRoutes from './routes/ai.js';
import mediaRoutes from './routes/media.js';
import analyticsRoutes from './routes/analytics.js';
import profileRoutes from './routes/profile.js';

import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Sécurité & Middlewares globaux
app.use(helmet());
app.use(cors({
  origin: ['https://social-sync-pro.vercel.app', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-client-id', 'x-user-role'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Appliquer le middleware d'authentification sécurisé sur l'ensemble des routes /api
app.use('/api', requireAuth);

// Limitation de débit globale et spécifique IA
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: "Trop de requêtes vers l'IA, veuillez réessayer plus tard." }
});
app.use('/api/ai/', aiLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'SocialSync Pro Backend API (Supabase + RBAC Sécurisé + team_member)',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/calendar', calendarRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/profile', profileRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Serveur SocialSync Pro en écoute sur le port ${PORT}`);
});
