const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// FaucetPay Withdrawal API Route
app.post('/api/withdraw-faucetpay', async (req, res) => {
    try {
        const { email, amount } = req.body;
        
        if (!email || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and amount are required.' 
            });
        }

        // FaucetPay processing logic yahan aayega
        console.log(`Processing withdrawal of ${amount} for ${email}`);

        return res.json({ 
            success: true, 
            message: 'Withdrawal processed successfully via Vercel Serverless!' 
        });
        
    } catch (error) {
        console.error('FaucetPay Error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Vercel ke liye app ko export karna zaroori hai
module.exports = app;
