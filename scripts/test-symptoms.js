const http = require('http');
const data = JSON.stringify({ symptoms: 'I have a persistent cough and shortness of breath' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/symptoms',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  console.log('Status:', res.statusCode);
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { console.log('Body:', body); });
});

req.on('error', (err) => { console.error('Request error:', err.message); });
req.write(data);
req.end();
