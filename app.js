import express from 'express';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppointment, sortAppointments } from './scheduler.js';
import { getAllAppointments, createAppointmentInDb, deleteAppointmentById } from './database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'home.html'));
});

app.use(express.static(join(__dirname, 'public')));

app.get('/api/appointments', (_req, res) => {
  const appointments = getAllAppointments();
  res.json(sortAppointments(appointments));
});

app.post('/api/appointments', (req, res) => {
  const { patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status } = req.body;

  const missing = [];
  if (!patientName?.trim()) missing.push('patientName');
  if (!medication?.trim()) missing.push('medication');
  if (!doctorName?.trim()) missing.push('doctorName');
  if (!appointmentDate?.trim()) missing.push('appointmentDate');
  if (!appointmentTime?.trim()) missing.push('appointmentTime');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const normalized = createAppointment({ patientName, medication, doctorName, appointmentDate, appointmentTime, notes, status });
  const saved = createAppointmentInDb(normalized);
  res.status(201).json(saved);
});

app.delete('/api/appointments/:id', (req, res) => {
  const deleted = deleteAppointmentById(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  res.json({ message: 'Deleted' });
});

export default app;
