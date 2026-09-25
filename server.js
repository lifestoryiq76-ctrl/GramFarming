const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully!'))
  .catch((err) => console.log('Database Connection Error: ', err));

// User Schema
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: { type: String },
  balance: { type: Number, default: 0 },
  lastFarmingTime: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Home route
app.get('/', (req, res) => {
  res.send('Gram Farming Backend is Running Successfully!');
});

// 1. Get or Create User API
app.post('/api/user', async (req, res) => {
  try {
    const { telegramId, username } = req.body;
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({ telegramId, username, balance: 0 });
      await user.save();
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update Balance / Farming API
app.post('/api/update-balance', async (req, res) => {
  try {
    const { telegramId, pointsToAdd } = req.body;
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $inc: { balance: pointsToAdd } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
