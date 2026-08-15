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

export async function sendAppointmentBookedDoctorEmail(doctor, appointment) {
  return sendMail({
    to: doctor.email,
    subject: 'New appointment booked — MedCare',
    text: `Hi Dr. ${doctor.name},\n\nYou have a new appointment with ${appointment.patientName} on ${appointment.appointmentDate} at ${appointment.appointmentTime}.\nMedication: ${appointment.medication}\nNotes: ${appointment.notes || 'None'}\n\n— MedCare`,
    html: `<p>Hi <strong>Dr. ${doctor.name}</strong>,</p><p>You have a new appointment with <strong>${appointment.patientName}</strong> on <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>Medication: ${appointment.medication}<br/>Notes: ${appointment.notes || 'None'}</p><p>— MedCare</p>`,
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

export async function sendAppointmentStatusEmail(user, appointment, status) {
  const label = status === 'confirmed' ? 'confirmed' : 'rejected';
  const heading = status === 'confirmed' ? 'Your appointment has been confirmed' : 'Your appointment was not accepted';
  const text = status === 'confirmed'
    ? `Hi ${user.name},\n\nYour appointment with Dr. ${appointment.doctorName} on ${appointment.appointmentDate} at ${appointment.appointmentTime} has been confirmed by the doctor.\n\n— MedCare`
    : `Hi ${user.name},\n\nUnfortunately your appointment with Dr. ${appointment.doctorName} on ${appointment.appointmentDate} at ${appointment.appointmentTime} was not accepted. Please book another time.\n\n— MedCare`;
  const html = `<p>Hi <strong>${user.name}</strong>,</p><p>${heading} (<strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>, Dr. ${appointment.doctorName}).</p>${status !== 'confirmed' ? '<p>Please book another time slot.</p>' : ''}<p>— MedCare</p>`;
  return sendMail({ to: user.email, subject: `Appointment ${label} — MedCare`, text, html });
}

export async function sendAppointmentRescheduledEmail(user, appointment) {
  return sendMail({
    to: user.email,
    subject: 'Appointment rescheduled — MedCare',
    text: `Hi ${user.name},\n\nYour appointment with Dr. ${appointment.doctorName} has been rescheduled to ${appointment.appointmentDate} at ${appointment.appointmentTime}.\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>Your appointment with <strong>Dr. ${appointment.doctorName}</strong> has been rescheduled to <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>— MedCare</p>`,
  });
}

export async function sendAppointmentCancelledDoctorEmail(doctor, appointment) {
  return sendMail({
    to: doctor.email,
    subject: 'Appointment cancelled — MedCare',
    text: `Hi Dr. ${doctor.name},\n\nYour appointment with ${appointment.patientName} on ${appointment.appointmentDate} at ${appointment.appointmentTime} has been cancelled.\n\n— MedCare`,
    html: `<p>Hi <strong>Dr. ${doctor.name}</strong>,</p><p>Your appointment with <strong>${appointment.patientName}</strong> on <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong> has been cancelled.</p><p>— MedCare</p>`,
  });
}

export async function sendAppointmentRescheduledDoctorEmail(doctor, appointment) {
  return sendMail({
    to: doctor.email,
    subject: 'Appointment rescheduled — MedCare',
    text: `Hi Dr. ${doctor.name},\n\nYour appointment with ${appointment.patientName} has been rescheduled to ${appointment.appointmentDate} at ${appointment.appointmentTime}.\n\n— MedCare`,
    html: `<p>Hi <strong>Dr. ${doctor.name}</strong>,</p><p>Your appointment with <strong>${appointment.patientName}</strong> has been rescheduled to <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>— MedCare</p>`,
  });
}

export async function sendAppointmentFollowUpEmail(user, appointment) {
  return sendMail({
    to: user.email,
    subject: 'Follow-up appointment scheduled — MedCare',
    text: `Hi ${user.name},\n\nA follow-up appointment with Dr. ${appointment.doctorName} has been scheduled for ${appointment.appointmentDate} at ${appointment.appointmentTime}.\n\n— MedCare`,
    html: `<p>Hi <strong>${user.name}</strong>,</p><p>A follow-up appointment with <strong>Dr. ${appointment.doctorName}</strong> has been scheduled for <strong>${appointment.appointmentDate} at ${appointment.appointmentTime}</strong>.</p><p>— MedCare</p>`,
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
