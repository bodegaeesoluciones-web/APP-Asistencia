const fs = require('fs');

async function clean() {
  try {
    // 1. Login as admin
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin123!' })
    });
    const loginData = await loginRes.json();
    
    if (!loginData.accessToken) {
      console.log("Failed to login:", loginData);
      return;
    }
    
    const token = loginData.accessToken;
    console.log("✅ Logged in as admin");

    // 2. Call clear-users
    const clearRes = await fetch('http://localhost:3000/api/admin/clear-users', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const clearData = await clearRes.json();
    console.log("✅ Clear response:", clearData);
    
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

clean();
