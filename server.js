const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS headers configuration
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Aapki FaucetPay API Key
const FAUCETPAY_API_KEY = "54554fbd31a9a72c7e84e4418b59abcde50bd6921c4a89d8dd86ae9b7c8df90a";

app.get('/', (req, res) => {
  res.send('Gram Farming API Server is Live & Running 🚀');
});

// Instant FaucetPay Payout API Route
app.post('/api/withdraw-faucetpay', async (req, res) => {
  try {
    const { email, amount, currency } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Email aur amount likhna zaroori hai!" 
      });
    }

    const params = new URLSearchParams();
    params.append('api_key', FAUCETPAY_API_KEY);
    params.append('amount', Math.round(Number(amount) * 100000000));
    params.append('currency', currency || 'USDT');
    params.append('to', email);
    params.append('ip_address', req.ip || '127.0.0.1');

    const fpResponse = await axios.post('https://faucetpay.io/api/v1/send', params);
    const fpResult = fpResponse.data;

    if (fpResult.status === 200) {
      return res.json({
        success: true,
        txId: fpResult.payout_id || "FP_" + Date.now(),
        message: "Payment successfully send ho gayi!"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: fpResult.message || "FaucetPay se payout nahi ho paya."
      });
    }

  } catch (error) {
    console.error("FaucetPay API Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Server me koi error aa gayi hai." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
