const { MongoClient } = require('mongodb');

// MongoDB Connection Setup
const uri = process.env.MONGO_URI || "mongodb+srv://lifestoryiq76_db_user:Rajesh123@cluster0.fpbqneq.mongodb.net/?retryWrites=true&w=majority";
let client;
let dbInstance;

async function getDB() {
    if (dbInstance) return dbInstance;
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    dbInstance = client.db('gram_farming');
    return dbInstance;
}

export default async function handler(req, res) {
  // CORS Headers set karein taaki network block na ho
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { userId, displayName, amount } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid user or deposit amount' });
  }

  const ADMIN_WALLET = "UQDFz_BjBSx-zBiwQx4wDs6BkFKy8z_uJoRnCYshNrgqthtd";
  const expectedNano = Math.round(parseFloat(amount) * 1e9); // TON/Gram to nanoTON

  try {
    // 1st Attempt: TonAPI Fetch
    let isFound = false;
    let response = await fetch(`https://tonapi.io/v2/blockchain/accounts/${ADMIN_WALLET}/transactions?limit=15`);
    
    if (response.ok) {
      let data = await response.json();
      const nowSec = Math.floor(Date.now() / 1000);

      if (data && data.transactions) {
        for (let tx of data.transactions) {
          if (tx.in_msg && tx.in_msg.value) {
            let val = parseInt(tx.in_msg.value);
            let txTime = tx.utime;
            // Amount Match & Time within last 20 minutes (1200 seconds)
            if (Math.abs(val - expectedNano) <= 20000000 && (nowSec - txTime) <= 1200) {
              isFound = true;
              break;
            }
          }
        }
      }
    }

    // 2nd Backup Attempt: Toncenter Fallback
    if (!isFound) {
      let tcResp = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${ADMIN_WALLET}&limit=15`);
      if (tcResp.ok) {
        let tcData = await tcResp.json();
        const nowSec = Math.floor(Date.now() / 1000);
        if (tcData.ok && tcData.result) {
          for (let tx of tcData.result) {
            if (tx.in_msg && tx.in_msg.value) {
              let val = parseInt(tx.in_msg.value);
              let txTime = tx.utime;
              if (Math.abs(val - expectedNano) <= 20000000 && (nowSec - txTime) <= 1200) {
                isFound = true;
                break;
              }
            }
          }
        }
      }
    }

    if (isFound) {
      const db = await getDB();
      const usersCollection = db.collection('users');
      const depositsCollection = db.collection('deposits');

      // 1. Fetch current user data from MongoDB to update balance
      const userQuery = { userId: String(userId) };
      let userData = await usersCollection.findOne(userQuery);
      
      let currentTonBalance = userData && userData.tonBalance !== undefined ? parseFloat(userData.tonBalance) : 0.0590;
      let newTonBalance = currentTonBalance + parseFloat(amount);

      // 2. Update user's Ton Balance in MongoDB
      await usersCollection.updateOne(
        userQuery,
        { $set: { tonBalance: newTonBalance } },
        { upsert: true }
      );

      // 3. Save Deposit Record in MongoDB for Transaction History
      const depositKey = `dep_${Date.now()}`;
      const depositRecord = {
        id: depositKey,
        requestId: depositKey,
        userName: displayName || 'User',
        userId: String(userId),
        method: 'Gram Deposit',
        amount: parseFloat(amount),
        status: 'SUCCESS',
        date: new Date().toLocaleString()
      };

      await depositsCollection.updateOne(
        { userId: String(userId), id: depositKey },
        { $set: depositRecord },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Deposit verified & credited successfully on blockchain!'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Transaction not found. Please wait 1-2 minutes after sending GRAM and try again.'
      });
    }

  } catch (error) {
    console.error("TON Verify Error:", error);
    return res.status(500).json({
      success: false,
      message: 'Network verification timeout. Please click verify again after 10 seconds.'
    });
  }
}
