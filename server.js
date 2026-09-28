const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ==========================================
// MONGODB CONNECTION
// ==========================================
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// User Schema (Database me data kaisa save hoga)
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  tonBalance: { type: Number, default: 0 },
  usdtBalance: { type: Number, default: 0 },
  refReward: { type: Number, default: 0 },
  totalInvited: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// ==========================================
// ROUTES & APIS
// ==========================================

// 1. Main Telegram Mini App Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Admin Panel Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 3. API to Fetch or Create User Data from Database
app.get('/api/user/:userId', async (req, res) => {
  try {
    let currentUser = await User.findOne({ userId: req.params.userId });
    if (!currentUser) {
      currentUser = new User({ userId: req.params.userId });
      await currentUser.save();
    }
    res.json({ success: true, data: currentUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. API to Update User Balance / Data
app.post('/api/update-user', async (req, res) => {
  try {
    const { userId, balance, tonBalance } = req.body;
    let updatedUser = await User.findOneAndUpdate(
      { userId: userId },
      { balance, tonBalance },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
