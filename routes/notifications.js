import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createNotification, getNotificationsForUser, markNotificationRead, markAllNotificationsRead } from '../database.js';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => {
  res.json(getNotificationsForUser(req.user.id));
});

router.post('/', (req, res) => {
  const { type, title, message } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Notification title is required' });
  const allowed = ['reminder', 'confirmation', 'cancellation', 'reschedule', 'prescription', 'followup', 'emergency', 'system'];
  const notifType = allowed.includes(type) ? type : 'system';
  const notification = createNotification({ userId: req.user.id, type: notifType, title, message });
  res.status(201).json(notification);
});

router.patch('/:id/read', (req, res) => {
  const notification = markNotificationRead(req.params.id, req.user.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json(notification);
});

router.post('/read-all', (req, res) => {
  res.json(markAllNotificationsRead(req.user.id));
});

export default router;
