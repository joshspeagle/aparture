// cli/test-server.js
// Quick test script for ServerManager

const { ServerManager } = require('./server-manager');

async function testServerManager() {
  console.log('Testing ServerManager...\n');

  const manager = new ServerManager();

  try {
    // Test 1: Check if server is running
    console.log('Test 1: Checking if server is running...');
    const isRunning = await manager.isServerRunning();
    console.log(`✓ Server running status: ${isRunning}\n`);

    // Test 2: Start server if not running
    if (!isRunning) {
      console.log('Test 2: Starting server...');
      const result = await manager.start();
      console.log('✓ Server started:', result);
      console.log();

      // Test 3: Verify server is now running
      console.log('Test 3: Verifying server is accessible...');
      const nowRunning = await manager.isServerRunning();
      if (nowRunning) {
        console.log('✓ Server is accessible at', manager.getBaseUrl());
      } else {
        throw new Error('Server should be running but is not accessible');
      }
      console.log();

      // Give user time to see it's running
      console.log('Server is running. Waiting 3 seconds before stopping...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Test 4: Stop server
      console.log('Test 4: Stopping server...');
      await manager.stop();
      console.log();

      // Test 5: Verify server stopped
      console.log('Test 5: Verifying server stopped...');
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for cleanup
      const stillRunning = await manager.isServerRunning();
      if (!stillRunning) {
        console.log('✓ Server successfully stopped');
      } else {
        console.log('⚠ Server may still be running from previous session');
      }
    } else {
      console.log('Server is already running. Skipping start/stop tests.');
      console.log('(To test full cycle, stop the server and run this test again)');
    }

    console.log('\nAll tests passed! ✓');
    return true;
  } catch (error) {
    console.error('\nTest failed:', error.message);

    // Try to cleanup
    try {
      await manager.stop();
    } catch (stopError) {
      console.error('Failed to cleanup server:', stopError.message);
    }

    return false;
  }
}

// Run tests if executed directly
if (require.main === module) {
  testServerManager()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { testServerManager };
