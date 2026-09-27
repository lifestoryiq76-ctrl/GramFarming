const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. FaucetPay Instant Withdraw (Option 1)
app.post('/api/withdraw/faucetpay', async (req, res) => {
  try {
    const { userEmailOrAddress, amount, currency } = req.body;
    const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;

    if (!FAUCETPAY_API_KEY) {
      return res.json({ success: false, message: "FaucetPay API key missing!" });
    }

    const response = await axios.post('https://faucetpay.io/api/v1/send', {
      api_key: FAUCETPAY_API_KEY,
      to: userEmailOrAddress,
      amount: amount,
      currency: currency || 'DGB'
    });

    if (response.data && response.data.status === 200) {
      return res.json({ success: true, message: "FaucetPay withdrawal successful!" });
    } else {
      return res.json({ success: false, message: response.data.message || "Transfer failed." });
    }
  } catch (error) {
    console.error("FaucetPay Error:", error);
    res.json({ success: false, message: "Server error during FaucetPay transfer." });
  }
});

// 2. Second Option connected with FaucetPay as well
app.post('/api/withdraw/second-option', async (req, res) => {
  try {
    const { userEmailOrAddress, amount, currency } = req.body;
    const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY;

    if (!FAUCETPAY_API_KEY) {
      return res.json({ success: false, message: "FaucetPay API key missing!" });
    }

    // Yahan bhi FaucetPay ka hi API request chalega
    const response = await axios.post('https://faucetpay.io/api/v1/send', {
      api_key: FAUCETPAY_API_KEY,
      to: userEmailOrAddress,
      amount: amount,
      currency: currency || 'USDT' // Aap chahein toh currency badal sakte hain
    });

    if (response.data && response.data.status === 200) {
      return res.json({ success: true, message: "Withdrawal successful via FaucetPay!" });
    } else {
      return res.json({ success: false, message: response.data.message || "Transfer failed." });
    }
  } catch (error) {
    console.error("FaucetPay Option 2 Error:", error);
    res.json({ success: false, message: "Server error during transfer." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
