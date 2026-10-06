const axios = require('axios');

export default async function handler(req, res) {
    // CORS headers allow karne ke liye
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { amount, currency, recipientAddressOrEmail } = req.body;

        const payload = new URLSearchParams({
            api_key: process.env.FAUCETPAY_API_KEY, // Vercel Environment Variables se uthayega
            amount: amount,
            currency: currency,
            to: recipientAddressOrEmail
        });

        const response = await axios.post('https://faucetpay.io/api/v1/send', payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (response.data.status === 200) {
            return res.status(200).json({ success: true, message: 'Withdrawal sent successfully!', data: response.data });
        } else {
            return res.status(400).json({ success: false, message: response.data.message || 'FaucetPay error' });
        }

    } catch (error) {
        console.error('FaucetPay Payout Error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error during withdrawal.' });
    }
}
