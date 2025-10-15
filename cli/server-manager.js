// cli/server-manager.js
const { spawn } = require('child_process');
const { sleep } = require('./utils');

class ServerManager {
  constructor(port = 3000) {
    this.port = port;
    this.serverProcess = null;
    this.baseUrl = `http://localhost:${port}`;
    this.detectedPort = null;
    this.fetch = null;
  }

  /**
   * Ensure fetch is loaded (dynamic import for ES module)
   */
  async ensureFetch() {
    if (!this.fetch) {
      this.fetch = (await import('node-fetch')).default;
    }
    return this.fetch;
  }

  /**
   * Check if server is running on a specific port
   */
  async checkPort(port) {
    try {
      const fetch = await this.ensureFetch();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://localhost:${port}`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.status < 500; // Accept any non-server-error response
    } catch {
      return false;
    }
  }

  /**
   * Check if server is already running (checks multiple common ports)
   */
  async isServerRunning() {
    // Check preferred port first
    if (await this.checkPort(this.port)) {
      this.detectedPort = this.port;
      this.baseUrl = `http://localhost:${this.port}`;
      return true;
    }

    // Check alternate ports (3001-3005)
    for (let port = 3001; port <= 3005; port++) {
      if (await this.checkPort(port)) {
        this.detectedPort = port;
        this.baseUrl = `http://localhost:${port}`;
        this.port = port;
        return true;
      }
    }

    return false;
  }

  /**
   * Extract port from server output
   */
  extractPortFromOutput(output) {
    const match = output.match(/localhost:(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Start the Next.js development server
   */
  async start() {
    // Check if already running
    if (await this.isServerRunning()) {
      console.log(`✓ Server already running at ${this.baseUrl}`);
      return { alreadyRunning: true, url: this.baseUrl };
    }

    console.log('Starting Next.js dev server...');

    return new Promise((resolve, reject) => {
      // Start the dev server
      // On Windows, npm is npm.cmd, so we use shell:true for cross-platform compatibility
      const isWindows = process.platform === 'win32';
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: isWindows, // Use shell on Windows to find npm.cmd
      });

      let output = '';
      let serverStarted = false;
      let isCompiling = false;
      let compilationComplete = false;
      let checkedAfterCompilation = false;

      // Capture output
      this.serverProcess.stdout.on('data', (data) => {
        const str = data.toString();
        output += str;

        // Log progress for user visibility
        if (str.includes('Starting...')) {
          console.log('  ✓ Starting...');
        } else if (str.includes('Ready in')) {
          console.log('  ✓ Ready');
        } else if (str.includes('Compiling')) {
          if (!isCompiling) {
            console.log('  ○ Compiling...');
            isCompiling = true;
          }
        } else if (str.includes('Compiled')) {
          console.log('  ✓ Compiled');
          compilationComplete = true;
        }

        // Check for server start indicators
        if (str.includes('Local:') || str.includes('started server')) {
          serverStarted = true;
          // Try to extract port from output
          const port = this.extractPortFromOutput(str);
          if (port) {
            this.port = port;
            this.baseUrl = `http://localhost:${port}`;
            console.log(`  Server will be available at ${this.baseUrl}`);
          }
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const str = data.toString();
        output += str;

        // Check for port change warnings
        if (str.includes('trying') && str.includes('instead')) {
          const port = this.extractPortFromOutput(str);
          if (port) {
            this.port = port;
            this.baseUrl = `http://localhost:${port}`;
          }
        }
      });

      // Wait for server to be ready
      const checkReady = async () => {
        let attempts = 0;
        const maxAttempts = 60; // 60 seconds to allow for compilation (20s+ seen in practice)

        while (attempts < maxAttempts) {
          // Check if server has started
          if (serverStarted) {
            // If compilation is complete, wait a bit then check if server responds
            if (compilationComplete && !checkedAfterCompilation) {
              // Wait 5 seconds after compilation for first request to complete (can take 13-15s)
              console.log('  Waiting for initial page load...');
              checkedAfterCompilation = true;
              await sleep(5000);
            }

            // After waiting post-compilation, check repeatedly if server responds
            if (checkedAfterCompilation) {
              if (await this.isServerRunning()) {
                console.log(`✓ Server ready at ${this.baseUrl}`);
                resolve({ started: true, url: this.baseUrl, process: this.serverProcess });
                return;
              }
            }
          }
          await sleep(1000);
          attempts++;

          // Progress indicator every 10 seconds
          if (attempts % 10 === 0 && serverStarted && !compilationComplete) {
            console.log(`  Waiting for compilation... (${attempts}s elapsed)`);
          }
        }

        // Timeout - but check if server is actually running on any port
        if (await this.isServerRunning()) {
          console.log(`✓ Server running at ${this.baseUrl} (detected after extended wait)`);
          resolve({ started: true, url: this.baseUrl, process: this.serverProcess });
        } else {
          reject(
            new Error(
              `Server failed to start within ${maxAttempts} seconds.\nLast output:\n${output.slice(-1000)}`
            )
          );
        }
      };

      checkReady();

      // Handle process errors
      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0 && code !== null && !serverStarted) {
          reject(new Error(`Server exited with code ${code}.\nOutput:\n${output}`));
        }
      });
    });
  }

  /**
   * Stop the development server
   */
  async stop() {
    if (this.serverProcess) {
      console.log('Stopping dev server...');

      return new Promise((resolve) => {
        this.serverProcess.on('exit', () => {
          console.log('✓ Server stopped');
          this.serverProcess = null;
          resolve();
        });

        // Kill the process
        this.serverProcess.kill('SIGTERM');

        // Force kill after 5 seconds if not stopped
        setTimeout(() => {
          if (this.serverProcess) {
            this.serverProcess.kill('SIGKILL');
            this.serverProcess = null;
            resolve();
          }
        }, 5000);
      });
    }
  }

  /**
   * Ensure server is running (start if needed)
   */
  async ensure() {
    if (await this.isServerRunning()) {
      console.log(`✓ Using existing server at ${this.baseUrl}`);
      return { alreadyRunning: true, url: this.baseUrl };
    }
    return await this.start();
  }

  /**
   * Get the base URL for API calls
   */
  getBaseUrl() {
    return this.baseUrl;
  }
}

module.exports = { ServerManager };
