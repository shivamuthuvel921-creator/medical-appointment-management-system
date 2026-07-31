import { Router } from 'express';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { getAllUsers, setUserRole, getDoctorByUserId, createDoctor } from '../database.js';

const router = Router();

router.use(authenticate, adminOnly);

router.get('/', (_req, res) => {
  res.json(getAllUsers());
});

router.put('/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['patient', 'doctor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = getAllUsers().find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  setUserRole(req.params.id, role);

  if (role === 'doctor' && !getDoctorByUserId(req.params.id)) {
    createDoctor({
      id: crypto.randomUUID(),
      userId: req.params.id,
      name: user.name,
      specialty: 'General Medicine',
      experience: '',
      clinic: '',
      phone: user.phone,
      email: user.email,
    });
  }

  res.json({ message: 'Role updated', id: req.params.id, role });
});

export default router;
