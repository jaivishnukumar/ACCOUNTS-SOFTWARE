const axios = require('axios');

const BASE_URL = 'http://localhost:5002/api';

async function test() {
    try {
        // 1. Login (assuming a default user exists or we create one)
        // We need a user. Let's check users table first.

        // Actually, let's just try to register a temp user to get a token
        const username = `testuser_${Date.now()}`;
        const password = 'password123';

        console.log("Registering...");
        await axios.post(`${BASE_URL}/register`, { username, password });

        console.log("Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/login`, { username, password });
        const token = loginRes.data.token;
        console.log("Got token");

        // 2. Fetch Companies
        console.log("Fetching companies...");
        const companiesRes = await axios.get(`${BASE_URL}/companies`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Companies found:", companiesRes.data.length);
        console.log(companiesRes.data);

    } catch (error) {
        console.error("Full Error:", error);
        if (error.response) {
            console.error("Response Data:", error.response.data);
            console.error("Response Status:", error.response.status);
        }
    }
}

test();
