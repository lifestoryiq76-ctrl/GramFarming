const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. Firebase Initialization ---
let privateKey = process.env.FIREBASE_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDb3UNKZU5IhKJp\n6qnYpBnO/1gmkpp3sswgWrb64W4hU+W6mjgz+Pfuu5rG5ApO0bY/S5ZxtoVTKi9p\nQGxFnkcK0aCZC9PFhst2Kr4Ylkrn+F9CQkZTPanrF1IdQP2P1eJ3KNqlVsmq33LF\nyJs5hJ8BjfxKPKSDMJKIQpEzfczyR41S6yr+tQ1NBBkPcYiTFtjjupnlyL6rcSuK\n2uSnBONN98wRq/G9k6PX8TeFWGEGP8cQxHAVSMmd8FrcT64bDFH/QLYv/5ksb2c5\nof/ObdISEwmVEN6IzxoDyluBAkVKsvpm5aOgFlWcVKoPYqoTSfny8553YJ6o/LbR\LV7LKzQnAgMBAAECggEAXsFGsWbkrJtA9d3VElFy8AObJZCUMtcjYyRFbO0/zew+\n+0NgyoFXtRM0WthH2v1FipTUgzBy2Es7gKRrpTtYCcEbcionPB9iS4yTPbx0DvI7\nd65haZmPRAracFIklVtMDSfVx2EWa+Z+K+BPiaPu9TgQjZwCGKoT1Na/hk4GyDki\ng5dFXh+e1U4R4qCLx6VLtflYzhPmUjWek8u0ethKqOLAkUnNpy/PmHxuOXkOqVp\nT+vM3PHfpNWIKJ2Wis3i3g8TTkaJlAOrRX4tLP12J9DvEkQaHjrEpTrXeCXvDZgu\n6DPy5c8Wdl4pTcSZqnOcxKzBsfpkK42DuYL/rM1F0QKBgQDvWGKFXDSGgIANjaG2\n5XM18XmpeD0giXYnanNPvIzmeA4841SQThp7njokvjG4jKLdqMZWGtIS8uFHeszm\n/LaFSBHdSF/nqhPlfPCKEYc0+xueFKan9a/eShwDnS/Wg3EI6CI2BvX2DPyqVGfq\nvWCQX8NAAdgAeM/RmkjnoYLx8QKBgQDrKdnexPYqNvL6rrX3oaQWQpIvJvuK5ziX\ntINlpdBV2/S4TNymJ3Lni65ct3J07xT3K8WzMGr4gCZR1UQL4sc1Mq+GqXmwycXR\JuADnqZCjL57kwVoWqf3DdsX9Ym0JIaL60/MAgn/PqvKmXxDj6LSfUXNIkvZUysv\nMTPz2XdvlwKBgQCHhy7SgTGk7+KSyh5GKIsigof3tIQ4hl4HV7nP7t6CKn01cSyT\Qgaw9RnLcH9LFyeqCEW2wB0waaOzDBA2w+a+dd7XxIG59o6ppiO2qtI65+3th5gP\nB4n8f055pWpPN8Kr3nZwzWQ9XYE9Gep1+6JQXkl7Vw/uxHo5H/okX0p8oQKBgByh\ndMgdfMb4964zlS33/Q1Ev52EBn4L1qUJsjGu9WVuqSXDHd4Q0XmFVQ4uu32nGgtZ\xfEiBPQKTiAKcgVsb8p3SE2B1rICbtYfAIkQSLezgQF0jeT9nJOEmVcaatCG3eat\nGIMDAIqV675331wuYal03Qmzkj58VLajK+sVX+gzAoGBAJzdc80qKafeVRLlbEUO\niEaDCc22IxnEBY0XXbO9mrxaieD58uuuXpaAaU/7D82e7aFLwxNFpAx/gWpgztCZ\njFSFEt+thkVtThoW7d1iQDgYt6+ta8jxhYMyctcLJWrqPSwzKinXdKVwmpnzl6sW\nsKQQgEbOWGn1crT7VPz3f/1+\n-----END PRIVATE KEY-----";

privateKey = privateKey.replace(/\\n/g, '\n');

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "gramfarmingbot-1a570",
  private_key_id: "d7e7e98f12c7be3221841c329cf8ca544d029a8b",
  private_key: privateKey,
  client_email: "firebase-adminsdk-fbsvc@gramfarmingbot-1a570.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid token', error: error.message });
  }
};

// --- Withdraw API ---
app.post('/api/withdraw', verifyFirebaseToken, async (req, res) => {
  const userId = req.user.uid;
  const { amount, payout_method, destination } = req.body; 

  try {
    const minWithdraw = 0.01; 
    if (!amount || amount < minWithdraw) {
      return res.status(400).json({ success: false, message: `Minimum withdraw amount is ${minWithdraw}` });
    }

    if (!payout_method || !destination) {
      return res.status(400).json({ success: false, message: 'Payout method and destination details are required' });
    }

    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = doc.data();
    const currentBalance = userData.balance || 0;

    if (currentBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance!' });
    }

    let payoutResponse = null;

    if (payout_method === 'ton' || payout_method === 'gram') {
      await db.collection('withdrawals').add({
        userId: userId,
        amount: amount,
        payoutMethod: payout_method,
        destination: destination,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      payoutResponse = { network: 'TON / Gram Jetton', address: destination, amount: amount, status: 'Pending Manual Review' };
    } 
    else if (payout_method === 'faucetpay') {
      const currency = 'USDT'; 
      const fpRes = await axios.post('https://faucetpay.io/api/v1/send', {
        api_key: FAUCETPAY_API_KEY,
        to: destination,
        amount: Math.floor(amount * 100000000), 
        currency: currency
      });

      if (fpRes.data.status !== 200) {
        return res.status(400).json({ success: false, message: 'FaucetPay Error: ' + fpRes.data.message });
      }
      payoutResponse = fpRes.data;
    } 
    else {
      return res.status(400).json({ success: false, message: 'Invalid payout method' });
    }

    await db.runTransaction(async (transaction) => {
      const freshDoc = await transaction.get(userRef);
      const newBalance = freshDoc.data().balance - amount;
      transaction.update(userRef, {
        balance: newBalance,
        lastWithdraw: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.status(200).json({
      success: true,
      message: payout_method === 'faucetpay' ? 'Withdrawal successful! Sent via FaucetPay.' : 'Withdrawal request submitted successfully! Admin will process it soon.',
      data: payoutResponse
    });

  } catch (error) {
    console.error('Withdrawal System Error:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
