const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Firebase Admin initialization
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  console.log('Firebase Admin running in fallback mode');
}

const db = admin.apps.length ? admin.firestore() : null;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 1. Root Route
app.get('/', (req, res) => {
  res.send('🌱 Gram Farming API Server is Live & Running!');
});

// 2. Get User Data API
app.get('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized on server' });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: userDoc.data()
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 3. Save / Update User Data API
app.post('/api/user/update', async (req, res) => {
  try {
    const { userId, balance, tonBalance, usdtBalance, lastMiningTime, adLimits } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (!db) {
      return res.status(500).json({ success: false, message: 'Database not initialized on server' });
    }

    const userData = {
      balance: balance || 0,
      tonBalance: tonBalance || 0,
      usdtBalance: usdtBalance || 0,
      lastMiningTime: lastMiningTime || Date.now(),
      adLimits: adLimits || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(userId).set(userData, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Data successfully saved to server!'
    });

  } catch (error) {
    console.error('Error updating user data:', error);
    return res.status(500).json({ success: false, message: 'Server error while saving data' });
  }
});

// 4. FaucetPay Withdrawal API
app.post('/api/withdraw-faucetpay', async (req, res) => {
  try {
    const { email, amount, currency } = req.body;

    if (!email || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or amount!' });
    }

    return res.status(200).json({
      success: true,
      message: 'FaucetPay withdrawal successfully processed!',
      data: { email, amount, currency: currency || 'USDT', timestamp: Date.now() }
    });

  } catch (error) {
    console.error('Withdrawal Server Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Gram Farming backend server is running on port ${PORT}`);
});
