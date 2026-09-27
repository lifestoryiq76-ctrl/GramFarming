const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// 1. Main Telegram Mini App Route (Home UI)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Admin Panel Route (`/admin`) - Fixes Cannot GET /admin error
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// API endpoint for TON withdrawal processing
app.post('/api/withdraw-ton', (req, res) => {
  const { userId, tonAddress, amountTon } = req.body;
  res.json({ success: true, message: "Withdrawal request processed successfully" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
