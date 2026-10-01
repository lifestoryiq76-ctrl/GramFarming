const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const { TonClient, WalletContractV4, internal } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- 1. Firebase Initialization (Direct JSON Config) ---
const serviceAccount = {
  type: "service_account",
  project_id: "gramfarmingbot-1a570",
  private_key_id: "d7e7e98f12c7be3221841c329cf8ca544d029a8b",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDb3UNKZU5IhKJp\n6qnYpBnO/1gmkpp3sswgWrb64W4hU+W6mjgz+Pfuu5rG5ApO0bY/S5ZxtoVTKi9p\nQGxFnkcK0aCZC9PFhst2Kr4Ylkrn+F9CQkZTPanrF1IdQP2P1eJ3KNqlVsmq33LF\nyJs5hJ8BjfxKPKSDMJKIQpEzfczyR41S6yr+tQ1NBBkPcYiTFtjjupnlyL6rcSuK\n2uSnBONN98wRq/G9k6PX8TeFWGEGP8cQxHAVSMmd8FrcT64bDFH/QLYv/5ksb2c5\nof/ObdISEwmVEN6IzxoDyluBAkVKsvpm5aOgFlWcVKoPYqoTSfny8553YJ6o/LbR\nLV7LKzQnAgMBAAECggEAXsFGsWbkrJtA9d3VElFy8AObJZCUMtcjYyRFbO0/zew+\n+0NgyoFXtRM0WthH2v1FipTUgzBy2Es7gKRrpTtYCcEbcionPB9iS4yTPbx0DvI7\nd65haZmPRAracFIklVtMDSfVx2EWa+Z+K+BPiaPu9TgQjZwCGKoT1Na/hk4GyDki\nng5dFXh+e1U4R4qCLx6VLtflYzhPmUjWek8u0ethKqOLAkUnNpy/PmHxuOXkOqVp\nT+vM3PHfpNWIKJ2Wis3i3g8TTkaJlAOrRX4tLP12J9DvEkQaHjrEpTrXeCXvDZgu\n6DPy5c8Wdl4pTcSZqnOcxKzBsfpkK42DuYL/rM1F0QKBgQDvWGKFXDSGgIANjaG2\n5XM18XmpeD0giXYnanNPvIzmeA4841SQThp7njokvjG4jKLdqMZWGtIS8uFHeszm\n/LaFSBHdSF/nqhPlfPCKEYc0+xueFKan9a/eShwDnS/Wg3EI6CI2BvX2DPyqVGfq\nvWCQX8NAAdgAeM/RmkjnoYLx8QKBgQDrKdnexPYqNvL6rrX3oaQWQpIvJvuK5ziX\ntINlpdBV2/S4TNymJ3Lni65ct3J07xT3K8WzMGr4gCZR1UQL4sc1Mq+GqXmwycXR\nJuADnqZCjL57kwVoWqf3DdsX9Ym0JIaL60/MAgn/PqvKmXxDj6LSfUXNIkvZUysv\nMTPz2XdvlwKBgQCHhy7SgTGk7+KSyh5GKIsigof3tIQ4hl4HV7nP7t6CKn01cSyT\Qgaw9RnLcH9LFyeqCEW2wB0waaOzDBA2w+a+dd7XxIG59o6ppiO2qtI65+3th5gP\nB4n8f055pWpPN8Kr3nZwzWQ9XYE9Gep1+6JQXkl7Vw/uxHo5H/okX0p8oQKBgByh\ndMgdfMb4964zlS33/Q1Ev52EBn4L1qUJsjGu9WVuqSXDHd4Q0XmFVQ4uu32nGgtZ\nxfEiBPQKTiAKcgVsb8p3SE2B1rICbtYfAIkQSLezgQF0jeT9nJOEmVcaatCG3eat\nGIMDAIqV675331wuYal03Qmzkj58VLajK+sVX+gzAoGBAJzdc80qKafeVRLlbEUO\niEaDCc22IxnEBY0XXbO9mrxaieD58uuuXpaAaU/7D82e7aFLwxNFpAx/gWpgztCZ\njFSFEt+thkVtThoW7d1iQDgYt6+ta8jxhYMyctcLJWrqPSwzKinXdKVwmpnzl6sW\nsKQQgEbOWGn1crT7VPz3f/1+\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@gramfarmingbot-1a570.iam.gserviceaccount.com",
  client_id: "112904174776419598252",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gramfarmingbot-1a570.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// --- 2. Keys & Configs ---
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;
const TON_MNEMONIC = process.env.TON_MNEMONIC ? process.env.TON_MNEMONIC.split(' ') : [];
const TON_NETWORK = process.env.TON_NETWORK || 'mainnet';

// --- 3. Firebase Auth Middleware ---
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

// --- 4. Helper Function: Send TON directly to user's pasted address ---
async function sendTonToAddress(recipientAddress, amountInTon) {
  try {
    const endpoint = TON_NETWORK === 'mainnet' 
      ? 'https://toncenter.com/api/v2/jsonRPC' 
      : 'https://testnet.toncenter.com/api/v2/jsonRPC';
    
    const client = new TonClient({ endpoint });
    const key = await mnemonicToPrivateKey(TON_MNEMONIC);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const walletContract = client.open(wallet);

    const seqno = await walletContract.getSeqno();
    const nanoAmount = BigInt(Math.floor(amountInTon * 1000000000)); // TON to Nanoton

    await walletContract.sendTransfer({
      seqno,
      secretKey: key.secretKey,
      messages: [
        internal({
          to: recipientAddress,
          value: nanoAmount,
          body: 'Gram Farming Instant Payout',
          bounce: false
        })
      ]
    });

    return { success: true };
  } catch (error) {
    console.error('TON Transfer Error:', error);
    return { success: false, error: error.message };
  }
}

// --- 5. Withdraw API for both TON & FaucetPay ---
app.post('/api/withdraw', verifyFirebaseToken, async (req, res) => {
  const userId = req.user.uid;
  const { amount, payout_method, destination } = req.body; 

  try {
    const minWithdraw = 0.5; 
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

    // A. TON Payout
    if (payout_method === 'ton') {
      const tonResult = await sendTonToAddress(destination, amount);
      if (!tonResult.success) {
        return res.status(400).json({ success: false, message: 'TON Transfer Failed: ' + tonResult.error });
      }
      payoutResponse = { network: 'TON', address: destination };
    } 
    // B. FaucetPay Payout
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

    // Update balance in Firebase
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
      message: 'Withdrawal successful! Payment sent instantly.',
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
