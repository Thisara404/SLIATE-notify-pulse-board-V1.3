// Create this file in your server root to test authentication
require('dotenv').config();
const secureDatabase = require('./src/config/database');

async function testAuth() {
    try {
        console.log('🔍 Testing authentication system...');
        
        // Initialize database
        await secureDatabase.initialize();
        
        // Test users query
        const usersQuery = 'SELECT id, username, email, role FROM users';
        const result = await secureDatabase.executeQuery(usersQuery);
        
        console.log('👥 Found users:');
        result.rows.forEach(user => {
            console.log(`   - ${user.username} (${user.role}) - ID: ${user.id}`);
        });
        
        // Test specific user
        const userQuery = 'SELECT * FROM users WHERE username = ?';
        const userResult = await secureDatabase.executeQuery(userQuery, ['superadmin']);
        
        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            console.log('🔍 Super admin user found:');
            console.log('   - Username:', user.username);
            console.log('   - Email:', user.email);
            console.log('   - Role:', user.role);
            console.log('   - Password hash:', user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'No hash');
        } else {
            console.log('❌ Super admin user not found');
        }
        
        await secureDatabase.close();
        console.log('✅ Test completed successfully');
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    }
}

testAuth();