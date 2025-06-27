const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'Admin123@#'; // Example password, replace with your own
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  console.log('Password:', password);
  console.log('Hash:', hashedPassword);
  
  // Test the hash
  const isMatch = await bcrypt.compare(password, hashedPassword);
  console.log('Hash verification:', isMatch);
}

generateHash();