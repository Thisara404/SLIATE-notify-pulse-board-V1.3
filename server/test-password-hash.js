const bcrypt = require('bcryptjs');

async function testPasswordHash() {
    const storedHash = '$2a$10$Lz0yWpr351ZsJDpn9Aknv.aUGQ19lphCk3h02V/JtcaTasQ4iIgZ6';
    
    // Common passwords to test
    const passwordsToTest = [
        'admin123',
        'Admin123',
        'Admin123!',
        'SuperAdmin123!',
        'Dev123!',
        'password',
        '123456',
        'admin',
        'superadmin',
        'Admin123@#'
    ];
    
    console.log('🔍 Testing password hash from database...');
    console.log('Hash:', storedHash);
    
    for (const testPassword of passwordsToTest) {
        try {
            const isMatch = await bcrypt.compare(testPassword, storedHash);
            console.log(`Password "${testPassword}": ${isMatch ? '✅ MATCH!' : '❌ No match'}`);
            
            if (isMatch) {
                console.log(`🎉 FOUND THE PASSWORD: "${testPassword}"`);
                return testPassword;
            }
        } catch (error) {
            console.log(`Password "${testPassword}": ❌ Error - ${error.message}`);
        }
    }
    
    console.log('❌ No matching password found');
    return null;
}

testPasswordHash();