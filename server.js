const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// Health check route Render ke liye
app.get('/', (req, res) => {
    res.json({ status: 'online', message: 'Render Server is running smoothly!' });
});

// Background tasks ya general routes yahan rakh sakte hain
app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: 'Pong! Server is awake.' });
});

// Render ke liye port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Render Server running on port ${PORT}`);
});
