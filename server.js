const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Manual CORS configuration (Bina kisi extra package ke)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', (req, res) => {
  res.send('Gram Farming API Server is Live & Running 🚀');
});

// FaucetPay Payout API Route
app.post('/api/withdraw-faucetpay', (req, res) => {
  try {
    const { email, amount, currency } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Email aur amount dena zaroori hai!" 
      });
    }

    // Filhal successful payout response bhej rahe hain
    return res.json({
      success: true,
      txId: "FP_SIM_" + Math.random().toString(36).substring(2, 10),
      message: "Payout successfully processed!"
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error during withdrawal." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
