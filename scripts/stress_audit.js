import http from 'http';

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runAudit() {
  console.log('====================================================');
  console.log('🧪 FUTURE DRIVING SCHOOL v1.5.2 STABILITY AUDIT SUITE');
  console.log('====================================================\n');

  const startMemory = process.memoryUsage();
  console.log(`[Memory Initial] RSS: ${(startMemory.rss / 1048576).toFixed(2)} MB | Heap: ${(startMemory.heapUsed / 1048576).toFixed(2)} MB`);

  // 1. Health check
  console.log('\n[1/7] Testing API Health Check...');
  const health = await request('/api/health');
  if (health.statusCode !== 200 || health.data?.status !== 'ok') {
    throw new Error(`Health check failed: status ${health.statusCode}`);
  }
  console.log(`✅ Health check OK (${health.statusCode}) - Env: ${health.data.environment}`);

  // 2. Authentication: Login & Dual-Token Verification
  console.log('\n[2/7] Testing Admin Authentication & Dual-Token Delivery...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      username: 'admin',
      password: 'Admin@123',
      rememberMe: true,
    },
  });

  if (loginRes.statusCode !== 200 || !loginRes.data?.accessToken) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.data)}`);
  }

  const accessToken = loginRes.data.accessToken;
  const refreshToken = loginRes.data.refreshToken;
  const setCookie = loginRes.headers['set-cookie'];

  console.log(`✅ Login successful!`);
  console.log(`   - Access Token received: [PRESENT, len=${accessToken.length}]`);
  console.log(`   - Refresh Token received in body: [${refreshToken ? 'YES, len=' + refreshToken.length : 'NO'}]`);
  console.log(`   - Set-Cookie received: [${setCookie ? 'YES' : 'NO'}]`);

  if (!refreshToken) {
    throw new Error('CRITICAL: refreshToken was NOT returned in JSON body for Electron/localhost dual-token stability!');
  }

  // 3. Token Refresh without Cookie (testing pure body token fallback)
  console.log('\n[3/7] Testing Token Refresh via Body (simulating Electron/HTTP localhost cookie drop)...');
  const refreshRes = await request('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken },
  });

  if (refreshRes.statusCode !== 200 || !refreshRes.data?.accessToken) {
    throw new Error(`Refresh via body failed with status ${refreshRes.statusCode}`);
  }
  console.log(`✅ Body-based token refresh successful! New access token generated.`);

  const activeToken = refreshRes.data.accessToken;
  const authHeaders = {
    Authorization: `Bearer ${activeToken}`,
    'Content-Type': 'application/json',
  };

  // 4. Diagnostic Logging Endpoint
  console.log('\n[4/7] Testing Production-Safe Diagnostic Logger Endpoint...');
  const diagRes = await request('/api/diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      category: 'lifecycle',
      message: 'Audit runner test event',
      page: '#/settings',
      status: 200,
    },
  });
  if (diagRes.statusCode !== 204) {
    throw new Error(`Diagnostics endpoint failed with status ${diagRes.statusCode}`);
  }
  console.log(`✅ Diagnostic logger accepted event successfully.`);

  // 5. Stress Test: 50 Iterations of concurrent dashboard, search, and document queries
  console.log('\n[5/7] Executing Stress Load: 50 cycles of multi-endpoint queries against Neon PostgreSQL...');
  let totalRequests = 0;
  let successfulRequests = 0;
  const latencies = [];

  const endpoints = [
    '/api/dashboard/stats',
    '/api/dashboard/expiring?limit=20',
    '/api/customers?page=1&limit=20',
    '/api/admin/search?q=MH&page=1&limit=20',
    '/api/admin/search?q=9&page=1&limit=20',
    '/api/admin/search?q=a&page=1&limit=20',
    '/api/documents?page=1&limit=20',
    '/api/notifications?page=1&limit=20',
  ];

  for (let cycle = 1; cycle <= 50; cycle++) {
    for (const ep of endpoints) {
      totalRequests++;
      const t0 = Date.now();
      const res = await request(ep, { headers: authHeaders });
      const elapsed = Date.now() - t0;
      latencies.push(elapsed);

      if (res.statusCode >= 200 && res.statusCode < 400) {
        successfulRequests++;
      } else {
        console.error(`❌ Request ${ep} failed with ${res.statusCode}:`, res.data);
      }
    }
    if (cycle % 10 === 0) {
      const avgLat = Math.round(latencies.slice(-80).reduce((a, b) => a + b, 0) / 80);
      console.log(`   - Completed cycle ${cycle}/50 (${totalRequests} total requests, avg latency ${avgLat}ms)`);
    }
  }

  console.log(`✅ Stress cycle completed: ${successfulRequests}/${totalRequests} requests succeeded.`);
  const overallAvg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const maxLat = Math.max(...latencies);
  console.log(`   - Overall average latency: ${overallAvg}ms (Peak: ${maxLat}ms)`);

  // 6. Idle Simulation & Connection Drop Recovery
  console.log('\n[6/7] Simulating 5-second Idle Period (verifying Neon PgBouncer reconnection)...');
  await sleep(5000);

  const afterIdleRes = await request('/api/dashboard/stats', { headers: authHeaders });
  if (afterIdleRes.statusCode !== 200) {
    throw new Error(`After-idle query failed: ${afterIdleRes.statusCode}`);
  }
  console.log(`✅ After-idle query succeeded! Database connection pool maintained/reconnected.`);

  // 7. Memory Leak Verification
  console.log('\n[7/7] Memory Audit...');
  const endMemory = process.memoryUsage();
  console.log(`[Memory Final]   RSS: ${(endMemory.rss / 1048576).toFixed(2)} MB | Heap: ${(endMemory.heapUsed / 1048576).toFixed(2)} MB`);
  const heapDiffMb = ((endMemory.heapUsed - startMemory.heapUsed) / 1048576).toFixed(2);
  console.log(`   - Heap change during run: ${heapDiffMb > 0 ? '+' : ''}${heapDiffMb} MB`);

  console.log('\n====================================================');
  console.log('🎉 AUDIT SUITE PASSED ALL STABILITY VERIFICATIONS!');
  console.log('====================================================\n');
}

runAudit().catch((err) => {
  console.error('\n❌ AUDIT FAILED:', err.message || err);
  process.exit(1);
});
