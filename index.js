require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID;

const app = express();
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const HEADER_ROW = ['Date', 'Name', 'Phone', 'Email', 'Property Interest'];

async function ensureHeaderRow() {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A1:E1',
  });

  if (!data.values || data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:E1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER_ROW] },
    });
    console.log('Header row created in Sheet1.');
  }
}

const FORM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Lead Tracker</title>
<style>
  body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
  h1 { font-size: 1.4rem; }
  label { display: block; margin-top: 12px; font-weight: bold; }
  input { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; }
  button { margin-top: 20px; padding: 10px 16px; cursor: pointer; }
  #message { margin-top: 16px; font-weight: bold; }
</style>
</head>
<body>
<h1>New Lead</h1>
<form id="lead-form">
  <label for="name">Name</label>
  <input type="text" id="name" name="name" required>

  <label for="phone">Phone</label>
  <input type="text" id="phone" name="phone" required>

  <label for="email">Email</label>
  <input type="email" id="email" name="email" required>

  <label for="propertyInterest">Property Interest</label>
  <input type="text" id="propertyInterest" name="propertyInterest" required>

  <button type="submit">Submit</button>
</form>
<div id="message"></div>

<script>
  const form = document.getElementById('lead-form');
  const message = document.getElementById('message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    message.style.color = 'black';

    const payload = {
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      propertyInterest: form.propertyInterest.value,
    };

    try {
      const res = await fetch('/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        message.style.color = 'green';
        message.textContent = 'Lead saved successfully!';
        form.reset();
      } else {
        message.style.color = 'red';
        message.textContent = data.error || 'Something went wrong.';
      }
    } catch (err) {
      message.style.color = 'red';
      message.textContent = 'Could not reach the server.';
    }
  });
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(FORM_HTML);
});

app.post('/lead', async (req, res) => {
  const { name, phone, email, propertyInterest } = req.body || {};

  if (!name || !phone || !email || !propertyInterest) {
    return res.status(400).json({
      error: 'All fields are required: name, phone, email, propertyInterest.',
    });
  }

  const date = new Date().toLocaleDateString('en-US');

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[date, name, phone, email, propertyInterest]] },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Failed to append lead to Google Sheet:', err);
    res.status(500).json({
      error: 'Unable to save lead right now, please try again later.',
    });
  }
});

async function start() {
  try {
    await ensureHeaderRow();
  } catch (err) {
    console.error('Failed to verify/create header row on startup:', err);
  }

  app.listen(PORT, () => {
    console.log(`Lead Tracker running at http://localhost:${PORT}`);
  });
}

start();
