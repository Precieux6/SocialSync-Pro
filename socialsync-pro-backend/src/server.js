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

import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Nettoie une URL : espaces et slash final retirés (évite les faux refus CORS)
const cleanOrigin = (s) => String(s || '').trim().replace(/\/+$/, '');

const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map(cleanOrigin).filter(Boolean),
  ...(process.env.APP_URL ? [cleanOrigin(process.env.APP_URL)] : []),
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:5173'] : []),
];

// Journal de démarrage : permet de vérifier dans les logs Vercel ce qui est réellement lu
console.log('allowedOrigins :', allowedOrigins);

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    // Pas d'origine (outils serveur, curl) ou origine autorisée : accepté
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Origine refusée : aucune erreur serveur, le navigateur bloquera la requête
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Owner-Id'],
  credentials: true,
  optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/ai/', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, error: "Trop de requêtes vers l'IA, veuillez réessayer plus tard." },
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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
