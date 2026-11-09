import express from 'express';
import { INITIAL_VIDEOS_TO_FILM } from '../data/mockData.js';

const router = express.Router();
router.get('/to-film', (req, res) => {
  res.json({ success: true, count: INITIAL_VIDEOS_TO_FILM.length, videos: INITIAL_VIDEOS_TO_FILM });
});

export default router;
