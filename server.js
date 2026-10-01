const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // FaucetPay API calls के लिए
const { TonClient, WalletContractV4, internal, mnemonicToPrivateKey } = require("@ton/ton");

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // अगर frontend files public folder में हैं

// ==========================================
// 1. FAUCETPAY WITHDRAWAL ROUTE
// ==========================================
app.post('/api/withdraw-faucetpay', async (req, res) => {
    try {
        const { email, amount, currency } = req.body;

        if (!email || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid FaucetPay parameters" });
        }

        const faucetPayApiKey = process.env.FAUCETPAY_API_KEY; // Render environment variable
        
        const response = await axios.post('https://faucetpay.io/api/v1/send', null, {
            params: {
                api_key: faucetPayApiKey,
                to: email,
                amount: Math.floor(amount * 100000000), // Satoshis / smallest unit
                currency: currency || 'USDT'
            }
        });

        if (response.data && response.data.status === 200) {
            return res.json({ success: true, message: "FaucetPay payout successful", data: response.data });
        } else {
            return res.json({ success: false, message: response.data.message || "FaucetPay transfer failed" });
        }

    } catch (error) {
        console.error("FaucetPay Payout Error:", error.response?.data || error.message);
        return res.json({ success: false, message: error.message });
    }
});


// ==========================================
// 2. TON WALLET INSTANT PAYOUT ROUTE
// ==========================================
app.post('/api/withdraw-ton', async (req, res) => {
    try {
        const { recipientAddress, amount } = req.body; // amount TON में होगा
        
        if (!recipientAddress || !amount || amount <= 0) {
            return res.json({ success: false, message: "Invalid TON parameters" });
        }

        // 1. TonClient initialize करें (Mainnet)
        const client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.TONCENTER_API_KEY || '' 
        });

        // 2. Render के Environment Variable से एडमिन वॉलेट की mnemonic लें
        const mnemonicSeed = process.env.ADMIN_MNEMONIC;
        if (!mnemonicSeed) {
            return res.json({ success: false, message: "Admin TON wallet not configured on server." });
        }

        const mnemonic = mnemonicSeed.split(" ");
        const key = await mnemonicToPrivateKey(mnemonic);
        
        let workchain = 0;
        let wallet = WalletContractV4.create({ workchain, publicKey: key.publicKey });
        let contract = client.open(wallet);

        // 3. Transfer message तैयार करें
        const seqno = await contract.getSeqno();
        const nanoAmount = BigInt(Math.floor(amount * 1000000000)); // TON to NanoTON conversion

        await contract.sendTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: recipientAddress,
                    value: nanoAmount,
                    bounce: false,
                    body: "Gram Farming Instant Payout"
                })
            ]
        });

        return res.json({ success: true, message: "TON sent successfully!", txId: seqno });

    } catch (error) {
        console.error("TON Payout Error:", error);
        return res.json({ success: false, message: error.message });
    }
});

// Server Port Setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
