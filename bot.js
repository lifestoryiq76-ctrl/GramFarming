const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
// Static files (jaise index.html) ko serve karne ke liye
app.use(express.static(path.join(__dirname)));

// Root Route check karne ke liye taaki Cannot GET / na aaye
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// FaucetPay Withdrawal API Endpoint
app.post('/api/withdraw', async (req, res) => {
    const { email, amount } = req.body;
    
    if (!email || !amount) {
        return res.json({ success: false, message: "Email aur amount dono zaroori hain!" });
    }

    console.log(`Processing withdrawal: ${amount} to FaucetPay email: ${email}`);
    res.json({ success: true, message: "FaucetPay par withdrawal successfully bhej diya gaya hai!" });
});

// Admin Broadcast API Endpoint
app.post('/api/admin/broadcast', (req, res) => {
    const { key, message } = req.body;
    const ADMIN_SECRET = "mySecretAdmin123"; 

    if (key !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Galat Admin Key hai!" });
    }

    console.log(`Admin Broadcast Message: ${message}`);
    res.json({ success: true, message: "Broadcast sabhi users ko bhej diya gaya hai!" });
});

// Vercel ke liye serverless export aur local ke liye app.listen
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server successfully port ${PORT} par chal raha hai!`);
    });
}

module.exports = app;
