const axios = require('axios');
const jwt = require('jsonwebtoken');

const PORT = 5002;
const JWT_SECRET = 'your-secret-key';
const BASE_URL = `http://localhost:${PORT}/api`;

// Generate a fake admin token
const token = jwt.sign(
    { id: 1, username: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function check() {
    console.log(`Checking API at ${BASE_URL}...`);
    try {
        const res = await axios.get(`${BASE_URL}/companies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Response Status:", e.response.status);
            console.error("Response Data:", e.response.data);
        }
    }
}

check();
