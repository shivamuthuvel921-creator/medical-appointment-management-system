import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  createUser, getUserByEmail, getUserById, updateUserProfile, updateUserPassword,
  createDoctor, createPasswordReset, getPasswordReset, consumePasswordReset, deleteExpiredPasswordResets,
} from '../database.js';
import { generateToken, generateResetToken, authenticate } from '../middleware/auth.js';
import { isValidEmail } from '../middleware/validate.js';
import { sendPasswordResetEmail } from '../services/notifications.js';
import { config } from '../config.js';

const router = Router();

function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8;
}

router.post('/register', async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = getUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const finalRole = role === 'doctor' ? 'doctor' : 'patient';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    passwordHash,
    role: finalRole,
  });

  if (finalRole === 'doctor') {
    createDoctor({
      id: crypto.randomUUID(),
      userId: user.id,
      name: name.trim(),
      specialty: req.body.specialty?.trim() || 'General Medicine',
      experience: req.body.experience?.trim() || '',
      clinic: req.body.clinic?.trim() || '',
      phone: phone.trim(),
      email: normalizedEmail,
    });
  }

  const token = generateToken(user);
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, profilePhoto: user.profilePhoto || '' } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, profilePhoto: user.profilePhoto || '' },
  });
});

router.post('/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  deleteExpiredPasswordResets();
  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user) return res.status(200).json({ message: 'If that email exists, a reset link was sent.' });

  const token = generateResetToken(user);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  createPasswordReset({ userId: user.id, token, expiresAt });

  const resetUrl = `${config.appUrl}/reset-password.html?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(user, resetUrl);
  res.json({ message: 'If that email exists, a reset link was sent.' });
});

router.post('/reset', async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  if (!validPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const reset = getPasswordReset(token);
  if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token' });

  if (new Date(reset.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Reset token has expired' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  updateUserPassword(reset.userId, passwordHash);
  consumePasswordReset(reset.id);

  const user = getUserById(reset.userId);
  const authToken = generateToken(user);
  res.json({ message: 'Password updated', token: authToken, user });
});

router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

router.put('/me', authenticate, (req, res) => {
  const { name, phone } = req.body;
  const fields = {};
  if (name !== undefined) fields.name = name.trim();
  if (phone !== undefined) fields.phone = phone.trim();
  const updated = updateUserProfile(req.user.id, fields);
  res.json(updated);
});

router.put('/password', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old and new passwords are required' });
  }
  if (!validPassword(newPassword)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = getUserByEmail(req.user.email);
  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  updateUserPassword(req.user.id, passwordHash);
  res.json({ message: 'Password updated' });
});

export default router;
