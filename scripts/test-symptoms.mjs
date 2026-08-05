const data = { symptoms: 'I have a persistent cough and shortness of breath' };

const res = await fetch('http://localhost:3000/api/symptoms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Body:', text);
