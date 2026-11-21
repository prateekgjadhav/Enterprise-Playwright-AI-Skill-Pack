---
id: PAT-web-first
title: Assert the cart total with web-first assertions
relates: page:CartPage
---
# Web-first assertions for the cart total

Assert the cart total with `await expect(cartPage.total).toHaveText(...)` so Playwright retries until the total
settles. Reading textContent once and comparing it makes the assertion flaky while the cart recalculates.
