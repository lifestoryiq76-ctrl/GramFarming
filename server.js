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

// --- 1. Firebase Initialization ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
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
  // payout_method: 'ton' या 'faucetpay'
  // destination: यूजर द्वारा डाला गया TON एड्रेस या FaucetPay ईमेल

  try {
    const minWithdraw = 0.5; // न्यूनतम विथड्रॉल लिमिट
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

    // A. TON Payout (यूजर के दिए गए एड्रेस पर सीधा ट्रांसफर)
    if (payout_method === 'ton') {
      const tonResult = await sendTonToAddress(destination, amount);
      if (!tonResult.success) {
        return res.status(400).json({ success: false, message: 'TON Transfer Failed: ' + tonResult.error });
      }
      payoutResponse = { network: 'TON', address: destination };
    } 
    // B. FaucetPay Payout (यूजर के दिए गए ईमेल/नंबर पर ट्रांसफर)
    else if (payout_method === 'faucetpay') {
      const currency = 'USDT'; // या TRX / DOGE जो भी आप देना चाहें
      const fpRes = await axios.post('https://faucetpay.io/api/v1/send', {
        api_key: FAUCETPAY_API_KEY,
        to: destination,
        amount: Math.floor(amount * 100000000), // Satoshis
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

    // पेमेंट सफल होने पर Firebase में यूजर का बैलेंस तुरंत काट लें
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
