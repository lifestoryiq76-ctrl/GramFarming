const express = require('express');
const app = express();
const admin = require('firebase-admin');

// Firebase Initialization (अगर आपने फायरबेस कनेक्ट किया है)
// admin.initializeApp({ ... });
// const db = admin.firestore();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Root / Homepage Route (अब यहाँ एरर नहीं आएगी)
app.get('/', (req, res) => {
    res.send('Gram Farming Mini App Backend is Live! 🚀 Visit /admin for Dashboard.');
});

// 2. Admin Panel Route
app.get('/admin', async (req, res) => {
    try {
        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gram Farming Admin Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; margin: 0; padding: 20px; }
                    .container { max-width: 900px; margin: auto; background: #1e293b; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
                    h1 { color: #38bdf8; text-align: center; }
                    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                    .card { background: #334155; padding: 15px 25px; border-radius: 8px; text-align: center; flex: 1; margin: 0 10px; }
                    .card h3 { margin: 0; font-size: 16px; color: #94a3b8; }
                    .card p { font-size: 24px; font-weight: bold; margin: 10px 0 0; color: #facc15; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #475569; }
                    th { background: #0f172a; color: #38bdf8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Gram Farming Admin Panel</h1>
                    <div class="stats">
                        <div class="card">
                            <h3>Total Users</h3>
                            <p id="totalUsers">0</p>
                        </div>
                        <div class="card">
                            <h3>Total Gram Distributed</h3>
                            <p id="totalGram">0</p>
                        </div>
                    </div>
                    <h2>User List</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Telegram ID</th>
                                <th>Balance (Gram)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="userTableBody">
                            <tr><td colspan="3" style="text-align: center;">Connected successfully! Waiting for users data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send("Error loading admin panel: " + error.message);
    }
});

// 3. Adsgram Reward API Route (विज्ञापन देखने के बाद यूजर को ग्राम देने के लिए)
app.post('/api/reward', async (req, res) => {
    try {
        const { telegramId } = req.body;
        if (!telegramId) {
            return res.status(400).json({ success: false, message: "Telegram ID missing" });
        }

        // यहाँ डेटाबेस में यूजर का बैलेंस अपडेट करने का कोड जोड़ सकते हैं
        // उदा: const userRef = db.collection('users').doc(String(telegramId));
        // await userRef.update({ balance: admin.firestore.FieldValue.increment(10) });

        res.json({ success: true, message: "Reward added successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Railway पोर्ट के अनुसार सर्वर चलाना
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
