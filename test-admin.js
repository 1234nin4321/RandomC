const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'http://localhost:5000';

async function testAdminAPI() {
  console.log('🧪 Testing Admin API...\n');

  try {
    // 1. Create admin user
    console.log('1. Creating admin user...');
    const createResponse = await fetch(`${BASE_URL}/admin/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (createResponse.ok) {
      console.log('✅ Admin user created successfully');
    } else {
      const error = await createResponse.json();
      console.log('⚠️ Admin creation response:', error.message || 'Admin might already exist');
    }

    // 2. Login as admin
    console.log('\n2. Logging in as admin...');
    const loginResponse = await fetch(`${BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }

    const { token } = await loginResponse.json();
    console.log('✅ Login successful, got token');

    // 3. Test active chats endpoint
    console.log('\n3. Testing active chats endpoint...');
    const chatsResponse = await fetch(`${BASE_URL}/admin/active-chats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (chatsResponse.ok) {
      const chatsData = await chatsResponse.json();
      console.log('✅ Active chats endpoint working');
      console.log(`   Found ${chatsData.chats.length} active chats`);
    } else {
      console.log('❌ Active chats endpoint failed');
    }

    // 4. Test bans endpoint
    console.log('\n4. Testing bans endpoint...');
    const bansResponse = await fetch(`${BASE_URL}/admin/bans`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (bansResponse.ok) {
      const bansData = await bansResponse.json();
      console.log('✅ Bans endpoint working');
      console.log(`   Found ${bansData.bans.length} banned users`);
    } else {
      console.log('❌ Bans endpoint failed');
    }

    // 5. Test ban user
    console.log('\n5. Testing ban user...');
    const banResponse = await fetch(`${BASE_URL}/admin/ban`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: 'test-user-123',
        reason: 'Test ban'
      })
    });

    if (banResponse.ok) {
      console.log('✅ Ban user endpoint working');
    } else {
      console.log('❌ Ban user endpoint failed');
    }

    // 6. Test unban user
    console.log('\n6. Testing unban user...');
    const unbanResponse = await fetch(`${BASE_URL}/admin/unban`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: 'test-user-123'
      })
    });

    if (unbanResponse.ok) {
      console.log('✅ Unban user endpoint working');
    } else {
      console.log('❌ Unban user endpoint failed');
    }

    console.log('\n🎉 All admin API tests completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Click "Admin Panel" button');
    console.log('3. Login with username: admin, password: admin123');
    console.log('4. Test the admin dashboard functionality');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 5000');
  }
}

// Wait a bit for server to start, then run tests
setTimeout(testAdminAPI, 2000); 