const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const FAUCETPAY_API_URL = 'https://faucetpay.io/api/v1/payout';
const FAUCETPAY_API_KEY = '54554fbdf90a';

app.post('/api/withdraw-faucetpay', async (req, res) => {
  try {
    const { email, amount, currency } = req.body;

    if (!email ||!amount ||!currency) {
      return res.status(400).json({ success: false, message: 'Missing required fields (email, amount, currency)' });
    }

    const response = await axios.post(FAUCETPAY_API_URL, {
      api_key: FAUCETPAY_API_KEY,
      to: email,
      amount: Math.floor(amount * 100000000),
      currency: currency
    });

    if (response.data && response.data.status === 200) {
      return res.json({ 
        success: true, 
        message: 'Payout sent successfully via FaucetPay!', 
        txId: response.data.payout_id || response.data.id || 'N/A' 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: response.data.message || 'FaucetPay transfer failed' 
      });
    }
  } catch (error) {
    console.error('FaucetPay Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, message: 'Server error processing FaucetPay withdrawal' });
  }
});

app.get('/', (req, res) => {
  res.send('Gram Farming API Server is running successfully!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
