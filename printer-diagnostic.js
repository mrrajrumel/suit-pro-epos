#!/usr/bin/env node

/**
 * SUIT PRO EPOS - Qucom BTD Printer Diagnostic Tool
 * Usage: node printer-diagnostic.js
 */

const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runDiagnostics() {
  log('\n' + '='.repeat(70), 'bright');
  log(' SUIT PRO EPOS - Qucom BTD Printer Diagnostic Tool', 'blue');
  log('='.repeat(70) + '\n', 'bright');

  // Test 1: Server Connection
  log('[1/5] Testing Server Connection...', 'blue');
  try {
    const config = await makeRequest('/api/config');
    if (config.status === 200) {
      log('✓ Server is running on port 3000', 'green');
      log(`  App: ${config.data.appName}`, 'green');
      log(`  Environment: ${config.data.environment}`, 'green');
    } else {
      log('✗ Server responded with status ' + config.status, 'red');
      return;
    }
  } catch (err) {
    log('✗ Cannot connect to server on localhost:3000', 'red');
    log('  Make sure you ran: npm run dev', 'yellow');
    log(`  Error: ${err.message}`, 'red');
    return;
  }

  // Test 2: Printer Detection
  log('\n[2/5] Checking Printer Availability...', 'blue');
  try {
    const check = await makeRequest('/api/printer/check');
    if (check.status === 200) {
      if (check.data.available) {
        log('✓ Printers detected:', 'green');
        check.data.printers.forEach((printer) => {
          log(`  - ${printer.name} (${printer.type})`, 'green');
          log(`    ID: ${printer.id}`, 'green');
          log(`    Status: ${printer.status}`, 'green');
          if (printer.port) log(`    Port: ${printer.port}`, 'green');
        });
      } else {
        log('⚠ No printers detected', 'yellow');
        log('  Check your .env file and physical connections', 'yellow');
      }
    } else {
      log('✗ Printer check failed', 'red');
    }
  } catch (err) {
    log('✗ Error checking printers: ' + err.message, 'red');
  }

  // Test 3: Qucom BTD Health Check
  log('\n[3/5] Checking Qucom BTD Health...', 'blue');
  try {
    const health = await makeRequest('/api/printer/health');
    if (health.status === 200) {
      if (health.data.healthy) {
        log('✓ Qucom BTD is HEALTHY and ready to print', 'green');
        log(`  Status: ${health.data.status}`, 'green');
        log(`  Port: ${health.data.port}`, 'green');
      } else {
        log('✗ Qucom BTD is OFFLINE or not detected', 'red');
        log(`  Troubleshooting:`, 'yellow');
        log(`  1. Check physical USB connection`, 'yellow');
        log(`  2. Verify correct port in .env (currently: ${health.data.port})`, 'yellow');
        log(`  3. Check for driver issues in Device Manager`, 'yellow');
        log(`  4. Try restarting the device`, 'yellow');
      }
    }
  } catch (err) {
    log('✗ Health check error: ' + err.message, 'red');
  }

  // Test 4: Send Test Print Job
  log('\n[4/5] Sending Test Print Job...', 'blue');
  try {
    const testReceipt = {
      receipt: {
        headerGreetings: 'SUIT PRO - TEST RECEIPT',
        items: [
          { name: 'Test Item 1', qty: 1, price: 9.99 },
          { name: 'Test Item 2', qty: 2, price: 15.50 },
        ],
        subtotal: 40.99,
        vat: 8.20,
        total: 49.19,
        timestamp: new Date().toISOString(),
        invoiceId: 'DIAG-' + Date.now(),
        salesperson: 'Diagnostic',
        paymentMethod: 'Test',
      },
      receiptText:
        '================================\nSUIT PRO - TEST RECEIPT\n================================\n\nItems:\nTest Item 1 x1 @ £9.99\nTest Item 2 x2 @ £15.50\n\n--------------------------------\nSubtotal: £40.99\nVAT (20%): £8.20\nTOTAL: £49.19\n\nSalesperson: Diagnostic\nPayment: Test\nTime: ' +
        new Date().toISOString() +
        '\nInvoice: DIAG-' +
        Date.now() +
        '\n================================\n',
    };

    const print = await makeRequest('/api/printer/print', 'POST', testReceipt);
    if (print.status === 200 && print.data.success) {
      log('✓ Test print job sent successfully', 'green');
      log(`  Job ID: ${print.data.jobId}`, 'green');
      log('  Check your Qucom BTD printer for output', 'green');
    } else if (print.status === 200 && !print.data.success) {
      log('⚠ Print job queued but printer unavailable', 'yellow');
      log(`  Fallback: ${print.data.fallback}`, 'yellow');
      log('  The receipt will print via ' + print.data.fallback, 'yellow');
    } else {
      log('✗ Print job failed with status ' + print.status, 'red');
      log(`  Response: ${JSON.stringify(print.data, null, 2)}`, 'red');
    }
  } catch (err) {
    log('✗ Error sending print job: ' + err.message, 'red');
  }

  // Test 5: Print Queue Status
  log('\n[5/5] Checking Print Queue...', 'blue');
  try {
    const devices = await makeRequest('/api/printer/devices');
    if (devices.status === 200) {
      log('✓ Queue Status:', 'green');
      log(`  Active print jobs: ${devices.data.queueLength}`, 'green');
      log(`  Available printers: ${devices.data.printers.length}`, 'green');
      devices.data.printers.forEach((printer) => {
        log(
          `    - ${printer.name} (${printer.status})`,
          printer.status === 'ready' ? 'green' : 'yellow'
        );
      });
    }
  } catch (err) {
    log('✗ Error checking queue: ' + err.message, 'red');
  }

  // Summary
  log('\n' + '='.repeat(70), 'bright');
  log('📋 DIAGNOSTIC COMPLETE', 'blue');
  log('='.repeat(70), 'bright');

  log('\n📝 Next Steps:', 'blue');
  log('1. If printer is HEALTHY: Try printing a receipt from the POS terminal', 'green');
  log('2. If printer is OFFLINE:', 'yellow');
  log('   - Verify USB cable connection', 'yellow');
  log('   - Check .env for correct QUCOM_BTD_PORT', 'yellow');
  log('   - See QUCOM_BTD_SETUP.md for detailed troubleshooting', 'yellow');
  log('3. For Web Serial API direct connection:', 'blue');
  log('   - Use Chrome/Edge browser', 'blue');
  log('   - Check browser console for connection status', 'blue');

  log('\n📖 Documentation: See QUCOM_BTD_SETUP.md\n', 'blue');
}

// Run diagnostics
runDiagnostics().catch((err) => {
  log('\n✗ Fatal error: ' + err.message, 'red');
  process.exit(1);
});
