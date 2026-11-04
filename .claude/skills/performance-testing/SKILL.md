---
name: performance-testing
description: >-
  Core Web Vitals and UI performance validation with Playwright: LCP, CLS, INP and TTFB in the
  browser, Chromium DevTools Protocol metrics, network and CPU throttling, performance budgets as
  assertions, and k6 load scripts with thresholds for the APIs behind the UI. Use whenever the user
  asks about page speed, Core Web Vitals, performance budgets, slow pages, load or stress testing,
  latency SLAs, throughput or how the app behaves under concurrent users. Not for functional API
  checks (api-testing) or debugging a single failing test (defect-analysis).
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Performance testing

Measure what users feel in the browser, and what the backend does under load. Both need budgets
decided up front.

## Non-negotiables
- Every performance check has a budget or threshold; a measurement without one is only an observation.
- Browser metrics run in a dedicated project with one worker, Chromium only, on a quiet runner.
- Load tests ramp up gradually, use realistic think time, take URLs and credentials from the environment, and never hit production without approval from the system owner.

## Browser: Core Web Vitals
```typescript
// @skill-example: fragment — src/perf/vitals.ts
import type { Page } from '@playwright/test';
export async function installVitals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __v: { lcp: number; cls: number; inp: number } };
    w.__v = { lcp: 0, cls: 0, inp: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) w.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__v.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries() as unknown as Array<{ duration: number }>) w.__v.inp = Math.max(w.__v.inp, e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
}
export const readVitals = (page: Page) => page.evaluate(() => (window as unknown as { __v: { lcp: number; cls: number; inp: number } }).__v);
```
```typescript
// @skill-example: fragment — tests/perf/home.perf.spec.ts
import { test, expect } from '@fixtures';
import { installVitals, readVitals } from '@perf/vitals';

test('home page meets Core Web Vitals budgets', { tag: ['@perf', '@P2', '@home'] }, async ({ page, homePage, browserName }) => {
  test.skip(browserName !== 'chromium', 'Performance observers and CDP are Chromium-only');
  await installVitals(page);
  await homePage.goto();
  await expect.poll(async () => (await readVitals(page)).lcp).toBeGreaterThan(0);
  const v = await readVitals(page);
  await test.info().attach('vitals.json', { body: JSON.stringify(v), contentType: 'application/json' });
  expect(v.lcp, 'LCP ms').toBeLessThan(2500);
  expect(v.cls, 'CLS').toBeLessThan(0.1);
});
```
CDP adds lab detail: `const cdp = await page.context().newCDPSession(page)`, then `Performance.getMetrics`, `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate` for slow-device budgets.

| Metric | Good (budget) |
|---|---|
| LCP | under 2.5 s |
| INP | under 200 ms |
| CLS | under 0.1 |
| TTFB | under 800 ms |

## Backend: k6 load
```javascript
// @skill-example: fragment — k6/scripts/coupon-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  scenarios: { load: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '2m', target: 50 }, { duration: '5m', target: 50 }, { duration: '1m', target: 0 }] } },
  thresholds: { http_req_duration: ['p(95)<800', 'p(99)<1500'], http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] },
};
export default function () {
  const res = http.post(`${__ENV.API_BASE_URL}/api/cart/coupon`, JSON.stringify({ code: 'SAVE10' }),
    { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.API_TOKEN}` }, tags: { name: 'POST /api/cart/coupon' } });
  check(res, { 'status is 200': r => r.status === 200 });
  sleep(Math.random() * 3 + 1);
}
```
Profiles: smoke (1 virtual user, 1 minute) before every load profile; load, stress (step ramp), spike and soak as needed. Run with `k6 run --summary-export k6/results/<name>.json k6/scripts/<name>.js`.

## Procedure
1. Agree budgets: Web Vitals per key page; p95 latency, error rate and throughput per endpoint.
2. Add browser checks for key pages and k6 scripts for the endpoints behind them.
3. Run smoke first, then the agreed profile, in a production-like environment.
4. Compare with the previous run or stored baseline; report regressions with the metric, budget and trend.

## Definition of Done
- Each page and endpoint in scope has a budget and a passing or explained result.
- Results attached (vitals JSON, k6 summary) and compared with the baseline.
