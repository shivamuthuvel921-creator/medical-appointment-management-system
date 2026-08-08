import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { host, port, user, pass } = config.smtp;
  if (!host || !user) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailEnabled() {
  return !!getTransporter();
}

export async function sendMail({ to, subject, text, html }) {
  const tr = getTransporter();
  if (!tr) {
    console.log(`[mail:disabled] to=${to} subject="${subject}"`);
    return { skipped: true };
  }
  try {
    const info = await tr.sendMail({ from: config.smtp.from, to, subject, text, html });
    console.log(`[mail] sent to=${to} subject="${subject}" id=${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[mail:error] to=${to}`, err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendAppointmentCreatedEmail(user, appointment) {
  return sendMail({
    to: user.email,
    subject: 'Appointment booked — MedCare',
    text: `Hi ${user.name},\n\nYour appointment with Dr. ${appointment.doctorName} is booked for ${appointment.appointmentDate} at ${appointment.appointmentTime}.\nMedication: ${appointment.medication}\nStatus: ${appointment.status}\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your appointment with <strong>Dr. ${appointment.doctorName}</strong> is booked for <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>Medication: ${appointment.medication}<br/>Status: ${appointment.status}</p><p>— MedCare</p>`,
  });
}

export async function sendAppointmentCancelledEmail(user, appointment) {
  return sendMail({
    to: user.email,
    subject: 'Appointment cancelled — MedCare',
    text: `Hi ${user.name},\n\nYour appointment with Dr. ${appointment.doctorName} on ${appointment.appointmentDate} at ${appointment.appointmentTime} has been cancelled.\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your appointment with <strong>Dr. ${appointment.doctorName}</strong> on <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong> has been cancelled.</p><p>— MedCare</p>`,
  });
}

export async function sendAppointmentReminder(user, appointment) {
  return sendMail({
    to: user.email,
    subject: 'Upcoming appointment reminder — MedCare',
    text: `Hi ${user.name},\n\nReminder: you have an appointment with Dr. ${appointment.doctorName} on ${appointment.appointmentDate} at ${appointment.appointmentTime}.\nMedication: ${appointment.medication}\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Reminder: you have an appointment with <strong>Dr. ${appointment.doctorName}</strong> on <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>Medication: ${appointment.medication}</p><p>— MedCare</p>`,
  });
}

export async function sendMedicationReminderEmail(user, dose, medication) {
  return sendMail({
    to: user.email,
    subject: `Medication reminder — ${medication.name} — MedCare`,
    text: `Hi ${user.name},\n\nReminder: take ${medication.name} (${medication.dosage || 'as prescribed'}) at ${dose.scheduledAt}.\n${medication.instructions ? `Instructions: ${medication.instructions}\n` : ''}Remember to take your medication on time.\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Reminder: take <strong>${medication.name}</strong> (${medication.dosage || 'as prescribed'}) at <strong>${dose.scheduledAt}</strong>.</p>${medication.instructions ? `<p>Instructions: ${medication.instructions}</p>` : ''}<p>Remember to take your medication on time.</p><p>— MedCare</p>`,
  });
}

export async function sendPasswordResetEmail(user, resetUrl) {
  return sendMail({
    to: user.email,
    subject: 'Reset your password — MedCare',
    text: `Hi ${user.name},\n\nClick the link below to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Click the link below to reset your password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p><p>— MedCare</p>`,
  });
}
