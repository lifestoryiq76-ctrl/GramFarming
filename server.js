const admin = require('firebase-admin');

// सुनिश्चित करें कि आपके प्रोजेक्ट में Firebase इनिशियलाइज्ड है
// (यदि पहले से है तो इस initialization को दोबारा न लिखें)

app.get('/admin', async (req, res) => {
    try {
        // डेटाबेस से यूजर्स की कुल संख्या और लिस्ट प्राप्त करें
        const usersSnapshot = await admin.firestore().collection('users').get();
        const totalUsers = usersSnapshot.size;

        let usersHtml = '';
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            usersHtml += `
                <tr>
                    <td>${doc.id}</td>
                    <td>${data.balance || 0} Coins</td>
                </tr>
            `;
        });

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gram Farming Admin Panel</title>
                <style>
                    body { font-family: Arial, sans-serif; background: #0f172a; color: #fff; padding: 20px; text-align: center; }
                    .card { background: #1e293b; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                    h1 { color: #38bdf8; font-size: 24px; }
                    p { color: #94a3b8; }
                    table { width: 100%; margin-top: 15px; border-collapse: collapse; }
                    th, td { padding: 10px; border-bottom: 1px solid #334155; font-size: 14px; text-align: left; }
                    th { color: #38bdf8; }
                </style>
            </head>
            <body>
                <h1>Gram Farming Admin Panel</h1>
                <div class="card">
                    <h3>Dashboard Overview</h3>
                    <p>Bot Status: <span style="color: #4ade80;">Online & Connected</span></p>
                    <p>Total Users: <b>${totalUsers}</b></p>
                    <p>Adsgram Integration: Active (Block ID: 52000)</p>
                    
                    <table>
                        <tr>
                            <th>User ID / Telegram ID</th>
                            <th>Balance</th>
                        </tr>
                        ${usersHtml || '<tr><td colspan="2" style="text-align:center;">No users found</td></tr>'}
                    </table>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Admin Panel Error:", error);
        res.status(500).send("Internal Server Error while loading admin panel.");
    }
});
