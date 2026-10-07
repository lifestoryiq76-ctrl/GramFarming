const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Agar axios use karna ho, nahi toh built-in fetch use kar sakte hain

const app = express();

app.use(express.json());
app.use(cors());

// Health check route Render ke liye
app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Render Server is running smoothly!' });
});

// Ping route
app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: 'Pong! Server is awake.' });
});

// ==> YAHAN NAYA FAUCETPAY WITHDRAWAL ROUTE ADD KIYA GAYA HAI <==
app.post('/api/withdraw-faucetpay', async (req, res) => {
    try {
        const { userId, amount, coin, to } = req.body;

        if (!userId || !amount || !coin || !to) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // FaucetPay API integration logic yahan aayega
        // Apni FaucetPay API Key yahan ya environment variable mein daalein
        const FAUCETPAY_API_KEY = process.env.FAUCETPAY_API_KEY || "YOUR_FAUCETPAY_API_KEY";

        // FaucetPay Send API request
        const response = await fetch('https://faucetpay.io/api/v1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: FAUCETPAY_API_KEY,
                amount: amount,
                to: to, // Email or Address
                currency: coin,
                referral: false
            })
        });

        const data = await response.json();

        if (data.status === 200) {
            return res.status(200).json({ 
                success: true, 
                message: "Withdrawal successful!",
                payout_id: data.payout_id 
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: data.message || "FaucetPay API error" 
            });
        }

    } catch (error) {
        console.log("Withdrawal Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// Render ke liye port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Server running on port ${PORT}`);
});
