const axios = require('axios');

export default async function handler(req, res) {
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

        // User IP address nikalna zaroori hai FaucetPay ke liye
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

        const payload = new URLSearchParams({
            api_key: process.env.FAUCETPAY_API_KEY,
            amount: amount,
            currency: currency,
            to: recipientAddressOrEmail,
            ip_address: clientIp.split(',')[0].trim()
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
        console.error('FaucetPay Payout Error:', error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: error.response?.data?.message || 'Internal server error during withdrawal.' 
        });
    }
}
