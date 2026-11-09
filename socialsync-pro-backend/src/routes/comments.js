import express from 'express';
import { INITIAL_COMMENTS } from '../data/mockData.js';

const router = express.Router();
router.get('/', (req, res) => {
  res.json({ success: true, count: INITIAL_COMMENTS.length, comments: INITIAL_COMMENTS });
});

router.post('/reply', (req, res) => {
  res.json({ success: true, message: 'Réponse envoyée avec succès.' });
});

export default router;
