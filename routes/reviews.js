import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAppointmentById, createReview, getReviewByAppointment, getReviewsByDoctor, getDoctorRating } from '../database.js';

const router = Router();

router.get('/doctor/:doctorId', (req, res) => {
  res.json({ reviews: getReviewsByDoctor(req.params.doctorId), rating: getDoctorRating(req.params.doctorId) });
});

router.post('/', authenticate, (req, res) => {
  const { appointmentId, rating, comment } = req.body;
  if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });
  const ratingNum = parseInt(rating, 10);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }
  const appointment = getAppointmentById(appointmentId);
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  if (appointment.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the patient who booked can review' });
  }
  if (appointment.status !== 'completed' && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'You can only review completed appointments' });
  }
  if (getReviewByAppointment(appointmentId)) {
    return res.status(409).json({ error: 'This appointment has already been reviewed' });
  }
  const review = createReview({
    appointmentId,
    userId: req.user.id,
    doctorId: appointment.doctorId,
    rating: ratingNum,
    comment: comment?.trim() || '',
  });
  res.status(201).json(review);
});

export default router;
