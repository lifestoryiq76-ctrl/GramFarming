const express = require('express');
const app = express(); // यह लाइन सबसे ऊपर होनी चाहिए
const admin = require('firebase-admin');

// Firebase Initialization (अपनी फायरबेस की जानकारी यहाँ जोड़ें)
// admin.initializeApp({ ... });
// const db = admin.firestore();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin Panel Route - डेटाबेस से यूजर्स और बैलेंस फेच करना
app.get('/admin', async (req, res) => {
    try {
        // अगर फायरबेस कनेक्टेड है तो यहाँ से डेटा निकाल सकते हैं:
        // const usersSnapshot = await db.collection('users').get();
        // let users = [];
        // usersSnapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));

        // अभी के लिए सुंदर HTML डैशबोर्ड लेआउट:
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
                            <p id="totalUsers">Loading...</p>
                        </div>
                        <div class="card">
                            <h3>Total Gram Distributed</h3>
                            <p id="totalGram">Loading...</p>
                        </div>
                    </div>
                    <h2>User List</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Telegram ID</th>
                                <th>Balance (Gram)</th>
                                <th>Joined Date</th>
                            </tr>
                        </thead>
                        <tbody id="userTableBody">
                            <tr><td colspan="3" style="text-align: center;">Fetching data from Firestore...</td></tr>
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

// Railway के लिए पोर्ट सेटिंग्स
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
