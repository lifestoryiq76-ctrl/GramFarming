const express = require('express');
const cors = require('cors');
const axios = require('axios'); // FaucetPay API call ke liye

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// FaucetPay API Configuration
// Apni FaucetPay API key y yahan ya Render environment variables (process.env.FAUCETPAY_API_KEY) me set karein
const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || "APNI_FAUCETPAY_API_KEY_YAHAN_DALEN";

// Root test route
app.get('/', (req, res) => {
  res.send('Gram Farming API Server is Live & Running 🚀');
});

// FaucetPay Payout API Route
app.post('/api/withdraw-faucetpay', async (req, res) => {
  try {
    const { email, amount, currency } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Email aur amount dena zaroori hai!" 
      });
    }

    // FaucetPay Send API Request Parameters
    // Note: FaucetPay API documentation ke mutabiq parameters bhejte hain
    const faucetpayPayload = new URLSearchParams({
      api_key: FAUCETPAY_API_KEY,
      amount: Math.round(amount * 100000000), // Satoshis / smallest unit me convert karne ke liye (agar required ho) ya direct amount
      currency: currency || 'USDT',
      to: email,
      ip_address: req.ip || '127.0.0.1'
    });

    // Agar FaucetPay ki official Send API hit karni ho:
    /*
    const fpResponse = await axios.post('https://faucetpay.io/api/v1/send', faucetpayPayload);
    const fpData = fpResponse.data;

    if (fpData.status === 200) {
      return res.json({
        success: true,
        txId: fpData.payout_id || 'FP_' + Date.now(),
        message: "Payout successful via FaucetPay!"
      });
    } else {
      return res.status(400).json({
        success: false,
        message: fpData.message || "FaucetPay payout failed."
      });
    }
    */

    // Filhal testing / simulation ke liye direct success response (Jab FaucetPay API key active ho jaye toh upar wala axios code uncomment kar sakte hain):
    return res.json({
      success: true,
      txId: "FP_SIM_" + Math.random().toString(36).substring(2, 10),
      message: "Payout successfully processed!"
    });

  } catch (error) {
    console.error("FaucetPay Payout Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Server error during FaucetPay withdrawal request." 
    });
  }
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
