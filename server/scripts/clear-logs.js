// Log Cleanup Script for SLIATE Notice System
const fs = require('fs').promises;
const path = require('path');

async function clearLogs() {
  console.log('🧹 Clearing log files...');

  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Check if logs directory exists
    try {
      await fs.access(logsDir);
    } catch (error) {
      console.log('📁 No logs directory found - nothing to clean');
      return;
    }

    // Read all files in logs directory
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(file => 
      file.endsWith('.log') || 
      file.endsWith('.log.gz') ||
      file.startsWith('security-') ||
      file.startsWith('metrics-')
    );

    if (logFiles.length === 0) {
      console.log('📄 No log files found to clean');
      return;
    }

    // Delete log files
    let deletedCount = 0;
    for (const file of logFiles) {
      try {
        await fs.unlink(path.join(logsDir, file));
        deletedCount++;
        console.log(`🗑️  Deleted: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${file}:`, error.message);
      }
    }

    console.log(`✅ Log cleanup completed: ${deletedCount} files deleted`);

  } catch (error) {
    console.error('💥 Log cleanup error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearLogs();
}

module.exports = { clearLogs };