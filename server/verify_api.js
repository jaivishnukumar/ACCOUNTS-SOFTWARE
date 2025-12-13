const axios = require('axios');

const BASE_URL = 'http://localhost:5002/api';

async function test() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/login`, {
            username: 'vishnu',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log("Login Success. Token obtained.");

        console.log("Fetching Companies...");
        const compRes = await axios.get(`${BASE_URL}/companies`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Companies Response Status:", compRes.status);
        console.log("Companies Count:", compRes.data.length);
        console.log("Companies Data:", JSON.stringify(compRes.data, null, 2));

    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
    }
}

test();
