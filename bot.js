const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
// Static files (jaise index.html aur admin.html) ko serve karne ke liye
app.use(express.static(path.join(__dirname)));

// FaucetPay Withdrawal API Endpoint
app.post('/api/withdraw', async (req, res) => {
    const { email, amount } = req.body;
    
    if (!email || !amount) {
        return res.json({ success: false, message: "Email aur amount dono zaroori hain!" });
    }

    // Yahan FaucetPay API integration ka logic aayega
    console.log(`Processing withdrawal: ${amount} to FaucetPay email: ${email}`);
    
    // Success response
    res.json({ success: true, message: "FaucetPay par withdrawal successfully bhej diya gaya hai!" });
});

// Admin Broadcast API Endpoint
app.post('/api/admin/broadcast', (req, res) => {
    const { key, message } = req.body;
    
    // Apne hisab se yahan admin password change kar sakte hain
    const ADMIN_SECRET = "mySecretAdmin123"; 

    if (key !== ADMIN_SECRET) {
        return res.json({ success: false, message: "Galat Admin Key hai!" });
    }

    console.log(`Admin Broadcast Message: ${message}`);
    res.json({ success: true, message: "Broadcast sabhi users ko bhej diya gaya hai!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server successfully port ${PORT} par chal raha hai!`);
});
