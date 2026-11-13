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
import setupRoutes from './routes/setup.js';
import accountRoutes from './routes/account.js';
import internalRoutes from './routes/internal.js';

import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Vercel place l'application derrière un proxy : sans ce réglage, toutes les
// requêtes partagent la même IP et les limiteurs bloquent tout le monde à la fois.
app.set('trust proxy', 1);

const cleanOrigin = (s) => String(s || '').trim().replace(/\/+$/, '');

const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map(cleanOrigin).filter(Boolean),
  ...(process.env.APP_URL ? [cleanOrigin(process.env.APP_URL)] : []),
  ...(!IS_PROD ? ['http://localhost:3000', 'http://localhost:5173'] : []),
];

if (!IS_PROD) console.log('allowedOrigins :', allowedOrigins);

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Owner-Id', 'X-Cron-Secret'],
  credentials: true,
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

// Limite globale par adresse IP (une page charge une vingtaine de requêtes)
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Changement de mot de passe : protection contre le devinage du mot de passe actuel
app.use('/api/profile/password', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
}));

// Invitations : évite l'envoi massif d'e-mails
app.use(['/api/team/invite', '/api/team/invitations'], rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Trop d'invitations envoyées. Réessayez plus tard." },
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Route interne : protégée par CRON_SECRET, sans authentification utilisateur
app.use('/api/internal', internalRoutes);

// Les limites IA sont appliquées par utilisateur, à l'intérieur de aiRoutes
app.use('/api/calendar', requireAuth, calendarRoutes);
app.use('/api/videos', requireAuth, videosRoutes);
app.use('/api/comments', requireAuth, commentsRoutes);
app.use('/api/media', requireAuth, mediaRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/team', requireAuth, teamRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/profile', requireAuth, profileRoutes);
app.use('/api/setup', requireAuth, setupRoutes);
app.use('/api/account', requireAuth, accountRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route introuvable.' });
});

app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ success: false, error: 'Erreur interne.' });
});

app.listen(PORT, () => {
  console.log(`Serveur SocialSync Pro en écoute sur le port ${PORT}`);
});
