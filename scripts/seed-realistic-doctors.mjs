import Database from 'better-sqlite3';
import { config } from '../config.js';

const db = new Database(config.dbPath);

// Realistic fictional doctors - clearly marked as fictional
const REALISTIC_DOCTORS = [
  {
    targetId: 'b999c626-2e31-46b9-87b0-4a3898bd4597',
    name: 'Dr. Vikram Rao',
    specialty: 'Cardiology',
    experience: '14 years',
    clinic: 'MedCare Salem',
    phone: '+91 98765 43210',
    email: 't.dr@test.local',
    qualifications: 'MBBS, MD General Medicine, DM Cardiology',
    consultationFee: '900',
    bio: 'Consultant Cardiologist with 14 years of experience in preventive cardiology, hypertension and heart failure management. Focused on evidence-based care and patient education.',
    avatar: '',
    dob: '1978-03-14',
    gender: 'Male',
    address: '78 Sarada College Road',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636007',
    licenseNumber: 'TNMC-45218',
    languages: 'English, Tamil, Hindi, Telugu',
    department: 'Cardiology',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 2, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 4, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 5, startTime: '14:00', endTime: '17:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' },
    ]
  },
  {
    targetId: 'dd33c23b-6918-402d-ad99-14681224d909',
    name: 'Dr. Rohan Iyer',
    specialty: 'Neurology',
    experience: '12 years',
    clinic: 'MedCare Multispeciality Clinic',
    phone: '+91 98765 43211',
    email: 'smart.doctor@test.local',
    qualifications: 'MBBS, MD General Medicine, DM Neurology',
    consultationFee: '800',
    bio: 'Neurologist specialising in headache, migraine, epilepsy and stroke prevention. Committed to clear communication and thorough follow-up.',
    avatar: '',
    dob: '1982-07-22',
    gender: 'Male',
    address: '12 Cherry Road, Hasthampatti',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636007',
    licenseNumber: 'TNMC-51192',
    languages: 'English, Tamil, Hindi',
    department: 'Neurology',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    ]
  },
  {
    targetId: '9b487442-3e33-4d51-a2f3-dbd7e2b25d7e',
    name: 'Dr. Arjun Mehta',
    specialty: 'General Medicine',
    experience: '9 years',
    clinic: 'MedCare Specialty Clinic',
    phone: '+91 98765 43212',
    email: 'arjun.mehta@medcare.local',
    qualifications: 'MBBS, MD General Medicine',
    consultationFee: '500',
    bio: 'General physician with 9 years of experience in fever, infection, lifestyle disorders and preventive health check-ups. Practices evidence-based, patient-centred care.',
    avatar: '',
    dob: '1986-11-05',
    gender: 'Male',
    address: '142 Trichy Main Road',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636004',
    licenseNumber: 'TNMC-60234',
    languages: 'English, Tamil, Hindi',
    department: 'General Medicine',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
    ]
  },
  {
    targetId: '65041db5-de81-46ad-b7a8-1bf927a3b84e',
    name: 'Dr. Karthik Srinivasan',
    specialty: 'Orthopedics',
    experience: '11 years',
    clinic: 'MedCare Specialty Clinic',
    phone: '+91 98765 43213',
    email: 'karthik.srinivasan@medcare.local',
    qualifications: 'MBBS, MS Orthopedics',
    consultationFee: '750',
    bio: 'Orthopedic surgeon focused on joint pain, arthritis, fracture care and spine health. Emphasises rehabilitation and non-surgical options where appropriate.',
    avatar: '',
    dob: '1983-09-30',
    gender: 'Male',
    address: '142 Trichy Main Road',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636004',
    licenseNumber: 'TNMC-48921',
    languages: 'English, Tamil, Hindi',
    department: 'Orthopedics',
    durationMins: 30,
    consultationType: 'In-clinic',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' },
    ]
  },
  {
    targetId: '048ac8f0-9aa3-495d-b610-b2b4c7ced820',
    name: 'Dr. Ananya Sharma',
    specialty: 'Dermatology',
    experience: '8 years',
    clinic: 'MedCare Specialty Clinic',
    phone: '+91 98765 43214',
    email: 'ananya.sharma@medcare.local',
    qualifications: 'MBBS, MD Dermatology',
    consultationFee: '600',
    bio: 'Dermatologist with 8 years of experience in acne, eczema, skin allergies and general dermatology. Provides clear, personalised skin-care guidance.',
    avatar: '',
    dob: '1990-02-18',
    gender: 'Female',
    address: '142 Trichy Main Road',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636004',
    licenseNumber: 'TNMC-72345',
    languages: 'English, Tamil, Hindi',
    department: 'Dermatology',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    ]
  },
  {
    targetId: '9bce7ad7-91df-4328-96f8-21838babc011',
    name: 'Dr. Neha Kapoor',
    specialty: 'Psychiatry',
    experience: '6 years',
    clinic: 'City Health Care Centre',
    phone: '+91 98765 43215',
    email: 'docmszxx3an@medcare.test',
    qualifications: 'MBBS, MD Psychiatry',
    consultationFee: '650',
    bio: 'Psychiatrist offering supportive care for stress, anxiety, sleep concerns and mood-related needs. Works collaboratively with patients and families.',
    avatar: '',
    dob: '1992-06-10',
    gender: 'Female',
    address: '45 Five Roads Junction',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636004',
    licenseNumber: 'TNMC-81234',
    languages: 'English, Hindi, Tamil',
    department: 'Psychiatry',
    durationMins: 45,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
    ]
  },
];

const NEW_DOCTORS = [
  {
    name: 'Dr. Priya Nair',
    specialty: 'Pediatrics',
    experience: '7 years',
    clinic: 'City Health Care Centre',
    phone: '+91 98765 43216',
    email: 'priya.nair@medcare.local',
    qualifications: 'MBBS, MD Pediatrics',
    consultationFee: '550',
    bio: 'Pediatrician caring for infants, children and adolescents. Focuses on vaccination, growth, nutrition and common childhood illnesses.',
    avatar: '',
    dob: '1988-04-25',
    gender: 'Female',
    address: '45 Five Roads Junction',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636004',
    licenseNumber: 'TNMC-65412',
    languages: 'English, Tamil, Malayalam',
    department: 'Pediatrics',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' },
    ]
  },
  {
    name: 'Dr. Meera Krishnan',
    specialty: 'Gynecology',
    experience: '10 years',
    clinic: 'MedCare Multispeciality Clinic',
    phone: '+91 98765 43217',
    email: 'meera.krishnan@medcare.local',
    qualifications: 'MBBS, MS Obstetrics & Gynaecology',
    consultationFee: '700',
    bio: 'Gynecologist with 10 years of experience in women’s health, antenatal care and menstrual health. Provides respectful, thorough consultations.',
    avatar: '',
    dob: '1984-12-02',
    gender: 'Female',
    address: '12 Cherry Road, Hasthampatti',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636007',
    licenseNumber: 'TNMC-59876',
    languages: 'English, Tamil, Hindi',
    department: 'Gynecology',
    durationMins: 30,
    consultationType: 'In-clinic',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    ]
  },
  {
    name: 'Dr. Rahul Menon',
    specialty: 'ENT',
    experience: '8 years',
    clinic: 'MedCare Salem',
    phone: '+91 98765 43218',
    email: 'rahul.menon@medcare.local',
    qualifications: 'MBBS, MS ENT',
    consultationFee: '600',
    bio: 'ENT specialist managing ear, nose, throat and sinus concerns including hearing, allergy and sinus care. Focuses on clear diagnosis and practical advice.',
    avatar: '',
    dob: '1987-08-19',
    gender: 'Male',
    address: '78 Sarada College Road',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636007',
    licenseNumber: 'TNMC-63456',
    languages: 'English, Tamil, Hindi',
    department: 'ENT',
    durationMins: 30,
    consultationType: 'In-clinic & Video',
    slots: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 4, startTime: '10:00', endTime: '14:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
    ]
  },
  {
    name: 'Dr. Divya Subramanian',
    specialty: 'Ophthalmology',
    experience: '9 years',
    clinic: 'MedCare Multispeciality Clinic',
    phone: '+91 98765 43219',
    email: 'divya.subramanian@medcare.local',
    qualifications: 'MBBS, MS Ophthalmology',
    consultationFee: '650',
    bio: 'Ophthalmologist specialising in vision, cataract screening, dry eye and general eye health. Emphasises preventive eye care and follow-up.',
    avatar: '',
    dob: '1989-10-11',
    gender: 'Female',
    address: '12 Cherry Road, Hasthampatti',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    postalCode: '636007',
    licenseNumber: 'TNMC-71234',
    languages: 'English, Tamil, Hindi',
    department: 'Ophthalmology',
    durationMins: 30,
    consultationType: 'In-clinic',
    slots: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' },
    ]
  },
];

console.log('--- Starting realistic doctor seeding (idempotent) ---');
const totalBefore = db.prepare('SELECT COUNT(*) as n FROM doctors').get().n;
let isFreshDb = totalBefore === 0;
if (isFreshDb) console.log('Fresh database detected (0 doctors) — will seed all 10 realistic doctors as new records.');

const dupId = '9ca80c03-7f16-4889-a1e9-10d4eefe7ab1';
const dup = db.prepare('SELECT * FROM doctors WHERE id=?').get(dupId);
if (dup) {
  const hasAppts = db.prepare('SELECT COUNT(*) as n FROM appointments WHERE doctorId=?').get(dupId).n;
  const hasSlots = db.prepare('SELECT COUNT(*) as n FROM doctor_slots WHERE doctorId=?').get(dupId).n;
  console.log(`Duplicate check ${dupId}: appts=${hasAppts} slots=${hasSlots}`);
  if (hasAppts === 0 && hasSlots === 0) {
    console.log(`Removing duplicate doctor ${dup.name} (${dupId})`);
    db.prepare('DELETE FROM doctor_slots WHERE doctorId=?').run(dupId);
    db.prepare('DELETE FROM doctor_blocks WHERE doctorId=?').run(dupId);
    db.prepare('DELETE FROM doctors WHERE id=?').run(dupId);
  }
}

const updateDoctorStmt = db.prepare(`
  UPDATE doctors SET name=@name, specialty=@specialty, experience=@experience, clinic=@clinic, phone=@phone, email=@email,
    qualifications=@qualifications, consultationFee=@consultationFee, bio=@bio, avatar=@avatar,
    dob=@dob, gender=@gender, address=@address, city=@city, state=@state, country=@country,
    postalCode=@postalCode, licenseNumber=@licenseNumber, languages=@languages, department=@department,
    durationMins=@durationMins, consultationType=@consultationType
  WHERE id=@id
`);
const insertDoctorStmt = db.prepare(`
  INSERT INTO doctors (id, userId, name, specialty, experience, clinic, phone, email, qualifications, consultationFee, bio, avatar)
  VALUES (@id, @userId, @name, @specialty, @experience, @clinic, @phone, @email, @qualifications, @consultationFee, @bio, @avatar)
`);

for (const rd of REALISTIC_DOCTORS) {
  const existing = db.prepare('SELECT * FROM doctors WHERE id=?').get(rd.targetId);
  if (!existing) {
    if (isFreshDb) {
      console.log(`Fresh DB — inserting ${rd.name} as ${rd.targetId}`);
      insertDoctorStmt.run({
        id: rd.targetId,
        userId: null,
        name: rd.name,
        specialty: rd.specialty,
        experience: rd.experience,
        clinic: rd.clinic,
        phone: rd.phone,
        email: rd.email,
        qualifications: rd.qualifications,
        consultationFee: rd.consultationFee,
        bio: rd.bio,
        avatar: rd.avatar,
      });
      db.prepare(`
        UPDATE doctors SET dob=@dob, gender=@gender, address=@address, city=@city, state=@state, country=@country,
          postalCode=@postalCode, licenseNumber=@licenseNumber, languages=@languages, department=@department,
          durationMins=@durationMins, consultationType=@consultationType WHERE id=@id
      `).run({
        id: rd.targetId,
        dob: rd.dob,
        gender: rd.gender,
        address: rd.address,
        city: rd.city,
        state: rd.state,
        country: rd.country,
        postalCode: rd.postalCode,
        licenseNumber: rd.licenseNumber,
        languages: rd.languages,
        department: rd.department,
        durationMins: rd.durationMins,
        consultationType: rd.consultationType,
      });
      const slotInsert = db.prepare('INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime) VALUES (?, ?, ?, ?, ?)');
      const tx = db.transaction((slots) => {
        for (const s of slots) slotInsert.run(crypto.randomUUID(), rd.targetId, s.dayOfWeek, s.startTime, s.endTime);
      });
      tx(rd.slots);
      continue;
    }
    console.log(`Skip update: doctor ${rd.targetId} not found`);
    continue;
  }
  const payload = {
    id: rd.targetId,
    name: rd.name,
    specialty: rd.specialty,
    experience: rd.experience,
    clinic: rd.clinic,
    phone: rd.phone,
    email: rd.email,
    qualifications: rd.qualifications,
    consultationFee: rd.consultationFee,
    bio: rd.bio,
    avatar: rd.avatar,
    dob: rd.dob,
    gender: rd.gender,
    address: rd.address,
    city: rd.city,
    state: rd.state,
    country: rd.country,
    postalCode: rd.postalCode,
    licenseNumber: rd.licenseNumber,
    languages: rd.languages,
    department: rd.department,
    durationMins: rd.durationMins,
    consultationType: rd.consultationType,
  };
  console.log(`Updating ${existing.name} (${rd.targetId}) -> ${rd.name} (${rd.specialty})`);
  updateDoctorStmt.run(payload);
  db.prepare('UPDATE appointments SET doctorName=? WHERE doctorId=?').run(rd.name, rd.targetId);
  if (existing.userId) {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(existing.userId);
    if (user && user.name !== rd.name) {
      console.log(`  Sync user ${user.email}: "${user.name}" -> "${rd.name}"`);
      db.prepare('UPDATE users SET name=? WHERE id=?').run(rd.name, existing.userId);
    }
  }
  db.prepare('DELETE FROM doctor_slots WHERE doctorId=?').run(rd.targetId);
  const slotInsert = db.prepare('INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime) VALUES (?, ?, ?, ?, ?)');
  const tx = db.transaction((slots) => {
    for (const s of slots) slotInsert.run(crypto.randomUUID(), rd.targetId, s.dayOfWeek, s.startTime, s.endTime);
  });
  tx(rd.slots);
  console.log(`  Slots set: ${rd.slots.length} windows`);
}

for (const nd of NEW_DOCTORS) {
  const exists = db.prepare('SELECT * FROM doctors WHERE email=?').get(nd.email);
  if (exists) {
    console.log(`New doctor ${nd.name} already exists as ${exists.id}, updating`);
    const payload = {
      id: exists.id,
      name: nd.name,
      specialty: nd.specialty,
      experience: nd.experience,
      clinic: nd.clinic,
      phone: nd.phone,
      email: nd.email,
      qualifications: nd.qualifications,
      consultationFee: nd.consultationFee,
      bio: nd.bio,
      avatar: nd.avatar,
      dob: nd.dob,
      gender: nd.gender,
      address: nd.address,
      city: nd.city,
      state: nd.state,
      country: nd.country,
      postalCode: nd.postalCode,
      licenseNumber: nd.licenseNumber,
      languages: nd.languages,
      department: nd.department,
      durationMins: nd.durationMins,
      consultationType: nd.consultationType,
    };
    updateDoctorStmt.run(payload);
    db.prepare('DELETE FROM doctor_slots WHERE doctorId=?').run(exists.id);
    const slotInsert = db.prepare('INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction((slots) => {
      for (const s of slots) slotInsert.run(crypto.randomUUID(), exists.id, s.dayOfWeek, s.startTime, s.endTime);
    });
    tx(nd.slots);
    continue;
  }
  const id = crypto.randomUUID();
  console.log(`Inserting new doctor ${nd.name} (${nd.specialty}) -> ${id}`);
  insertDoctorStmt.run({
    id,
    userId: null,
    name: nd.name,
    specialty: nd.specialty,
    experience: nd.experience,
    clinic: nd.clinic,
    phone: nd.phone,
    email: nd.email,
    qualifications: nd.qualifications,
    consultationFee: nd.consultationFee,
    bio: nd.bio,
    avatar: nd.avatar,
  });
  db.prepare(`
    UPDATE doctors SET dob=@dob, gender=@gender, address=@address, city=@city, state=@state, country=@country,
      postalCode=@postalCode, licenseNumber=@licenseNumber, languages=@languages, department=@department,
      durationMins=@durationMins, consultationType=@consultationType WHERE id=@id
  `).run({
    id,
    dob: nd.dob,
    gender: nd.gender,
    address: nd.address,
    city: nd.city,
    state: nd.state,
    country: nd.country,
    postalCode: nd.postalCode,
    licenseNumber: nd.licenseNumber,
    languages: nd.languages,
    department: nd.department,
    durationMins: nd.durationMins,
    consultationType: nd.consultationType,
  });
  const slotInsert = db.prepare('INSERT INTO doctor_slots (id, doctorId, dayOfWeek, startTime, endTime) VALUES (?, ?, ?, ?, ?)');
  const tx = db.transaction((slots) => {
    for (const s of slots) slotInsert.run(crypto.randomUUID(), id, s.dayOfWeek, s.startTime, s.endTime);
  });
  tx(nd.slots);
}

const remainingTests = db.prepare("SELECT id, name FROM doctors WHERE lower(name) LIKE '%test%'").all();
if (remainingTests.length) {
  console.log('Remaining test doctors found, cleaning:', remainingTests);
  for (const r of remainingTests) {
    const clean = r.name.replace(/\bTest\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Dr.';
    db.prepare('UPDATE doctors SET name=? WHERE id=?').run(clean, r.id);
    db.prepare('UPDATE appointments SET doctorName=? WHERE doctorId=?').run(clean, r.id);
  }
}
const docs = db.prepare('SELECT id, name FROM doctors').all();
for (const d of docs) db.prepare('UPDATE appointments SET doctorName=? WHERE doctorId=?').run(d.name, d.id);

console.log('\n--- Final doctors ---');
const final = db.prepare('SELECT id, name, specialty, experience, clinic, city, consultationFee, languages FROM doctors ORDER BY specialty, name').all();
console.log(JSON.stringify(final, null, 2));
console.log(`Total doctors: ${final.length}`);
console.log('Done.');
db.close();
