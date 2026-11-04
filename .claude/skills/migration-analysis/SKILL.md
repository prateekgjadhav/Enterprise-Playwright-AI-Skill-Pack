---
name: migration-analysis
description: >-
  Plans and performs migration of Robot Framework, Selenium (Java, Python, C#, JavaScript),
  Cypress and TestNG suites to Playwright TypeScript: reads the legacy code without running it,
  builds a backlog with complexity and migration waves, converts tests by intent rather than syntax,
  and proves behaviour with a parity comparison against the legacy run. Use whenever the user wants
  to migrate, convert, port or assess a legacy UI test suite, estimate migration effort, plan
  waves, or compare legacy and Playwright results. Not for writing brand-new tests
  (playwright-test-generation).
metadata:
  tier: "2"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Migration analysis

Migrate behaviour, not code. The legacy suite stays untouched and keeps running until the new
tests prove they check the same things.

## Non-negotiables
- **Legacy is read-only.** Never edit, move or delete legacy files. Retiring a legacy test is a human decision after parity holds for the agreed number of runs.
- **Translate intent.** `Wait Until …`, `WebDriverWait` and `cy.wait('@alias')` become web-first assertions or specific waits for a response; sleeps disappear; XPath becomes a role or label locator.
- **Never weaken an assertion** to make a migrated test pass. If a step cannot be expressed, leave `TODO(migration)` and lower the confidence.
- Every migrated test carries an annotation `{ type: 'legacy-id', description: '<id>' }`.

## Legacy ids
`robot:<file>::<test name>` · `java:<package>.<Class>#<method>` (TestNG and JUnit) · `py:<path>.py::[<Class>::]<function>` · `cs:<namespace>.<Class>.<method>` · `cy:<spec file>::<it title>`

## Procedure
1. **Scan (read-only).** Find suites: `.robot`/`.resource` (sections, the driving `Library` — Browser or SeleniumLibrary — tags, Pabot), Selenium (`org.openqa.selenium`, `from selenium`, `OpenQA.Selenium`, `selenium-webdriver`), TestNG (`@Test`, `groups`, `dataProvider`, `testng.xml`), Cypress (`cypress.config.*`, `*.cy.*`). Record per test: id, file, line, feature (file stem), tags, priority (smoke/critical/P0 → P0; regression → P1; else P2) and signals (steps, keyword depth, sleeps, XPath, frames, JS execution).
2. **Backlog and waves** in `migration-backlog.json`. Complexity bands S/M/L/XL. Wave 1 is one low-complexity pilot feature with P0 tests; wave 2 other P0 features; wave 3 the rest; wave 4 is XL, unsupported (desktop or mobile libraries), disabled or duplicate tests for human review. Report counts and estimated effort per wave.
3. **Convert one test at a time.** Read the test and everything it calls (keywords, resources, page objects, helpers, custom commands). Reuse existing pages and modules (`page-object-engineering`); choose locators with `locator-strategy`; data via `test-data-management`. Write `tests/migrated/<feature>/<test>.spec.ts` and `conversion-notes.md` (findings, unported steps, confidence 0–1). If a knowledge server is configured, search the `patterns` collection for similar conversions first.
4. **Validate and run** with the verify script and `--repeat-each=3`.
5. **Parity.** Run legacy and migrated tests against the same build. Compare by legacy id: both pass (parity), both fail (route to `defect-analysis`), legacy passes and migrated fails (migration regression — blocking), legacy fails and migrated passes (possibly weakened — blocking until explained). For Robot Framework, read the legacy result from `output.xml` (see below).
6. **Retire** only after parity holds for the agreed runs, with the user's approval. List eligible legacy tests; never delete them yourself.

## Mapping
| Legacy | Playwright |
|---|---|
| Robot `Open Browser` / `Go To` | page object `goto()`; browser from the project |
| Robot `Click Element` / `Input Text` / `Input Password` | `click()` / `fill(v)` / `fill(credentials.password)` |
| Robot `Wait Until Element Is Visible`, `Element Should Be Visible` | `await expect(loc).toBeVisible()` |
| Robot `Element Should Contain` / `Page Should Contain` | `toContainText` / `expect(region.getByText(t)).toBeVisible()` |
| Robot `Sleep`, `Set Selenium Implicit Wait` | removed |
| Robot `Wait Until Keyword Succeeds` | `expect(async () => { … }).toPass()` |
| Robot `[Template]`, DataDriver | loop generating `test()` per row |
| Robot user keyword | page method (one action) or module method (workflow) |
| Selenium `driver.get` / `findElement(By…).click()` / `sendKeys` | `goto()` / `click()` / `fill()` |
| Selenium `isDisplayed` / `getText` assertions | `toBeVisible()` / `toHaveText()` |
| Selenium `Thread.sleep`, implicit waits / `WebDriverWait` | removed / web-first assertion |
| Selenium `switchTo().frame / window / alert` | `frameLocator()` / `context.waitForEvent('page')` / `page.once('dialog', …)` |
| Selenium `@FindBy` + PageFactory | `readonly` locators on a page object built by fixtures |
| TestNG `@BeforeMethod` / `@BeforeSuite` | test fixture / worker fixture or `globalSetup` |
| TestNG `@DataProvider`, `groups`, `dependsOnMethods` | data loop, tags, independent tests (no ordering) |
| TestNG `testng.xml` suites and parallel settings | Playwright projects, `--grep`, `workers`, `--shard` |
| Cypress `cy.visit` / `cy.get(...).click()` / `.type()` | `goto()` / `click()` / `fill()` |
| Cypress `.should('be.visible')` / `.should('contain', t)` | `toBeVisible()` / `toContainText(t)` |
| Cypress `cy.intercept` + `cy.wait('@alias')` | `page.route()` or `page.waitForResponse()` |
| Cypress `cy.request` | `request` / `apiAs(role)` |
| Cypress custom commands, `beforeEach` | fixtures and modules |
| Cypress `cy.wait(ms)` | removed |

## Robot Framework specifics
Robot Framework suites differ most by the library that drives them — detect it first, because it sets the effort. A Browser-library suite is already running on Playwright, so porting is largely mechanical; a SeleniumLibrary suite needs the usual wait and locator translation.

### Which library drives the suite
| `*** Settings ***` import | What it is | Effort to port |
|---|---|---|
| `Library    Browser` (robotframework-browser) | browser automation **powered by Playwright** — the same engine, auto-waiting and selector syntax | Low: keywords and `css=`/`xpath=`/`text=`/`id=` selectors map almost one-to-one to Playwright locators |
| `Library    SeleniumLibrary` | Selenium WebDriver | Medium: explicit/implicit waits and WebDriver idioms become web-first assertions and role/label locators |
| `Library    RequestsLibrary` | HTTP / API | Low: map to `request` / `apiAs(role)` (`api-testing`) |
| `Library    AppiumLibrary` | mobile native | Out of scope — flag for human review (wave 4) |
| `Library    DatabaseLibrary` | SQL | becomes seeding and teardown (`test-data-management`) |

A suite can mix libraries (for example Browser + Requests). The Browser library installs its own Playwright browsers with `rfbrowser init`, which is the signal that the suite's selectors and waiting already behave like Playwright's.

### Sections and setup
`.robot` suites and shared `.resource` files are split into sections; map them structurally, not line by line.

| Section | Holds | Becomes |
|---|---|---|
| `*** Settings ***` | `Library`, `Resource`, `Variables`, `Suite`/`Test Setup` & `Teardown`, `Force`/`Default Tags`, `Metadata` | imports, shared modules, fixtures/hooks, tags |
| `*** Variables ***` | suite variables | config, data factories, or fixture state |
| `*** Test Cases ***` | tests, with `[Tags]`, `[Setup]`, `[Teardown]`, `[Template]` | `test()` with tags and fixtures |
| `*** Keywords ***` | user keywords (reusable steps) | a page method (one action) or a module method (a workflow) |
| `.resource` files | keywords and variables imported by suites | shared page objects / modules / fixtures |

`Suite Setup`/`Suite Teardown` → `globalSetup` or a worker fixture; `Test Setup`/`Test Teardown` → a test fixture. Keep setup out of the test body, expressed as fixtures.

### Variables
| Robot | Meaning | Playwright |
|---|---|---|
| `${scalar}` | one value | a value or fixture |
| `@{list}` | many values | an array |
| `&{dict}` | key–value pairs | an object |
| `%{ENV_VAR}` | environment variable | `process.env` / typed config |
| `Set Suite`/`Global Variable` | widen a variable's scope across tests | shared fixture state — avoid cross-test coupling; prefer per-test data |
| `Variables    data.py` / `data.yaml` | external variable file | a data module or config loaded by `test-data-management` |

### Test-case styles
- **Keyword-driven** (the default): each step is a keyword call → a page or module method.
- **Data-driven** (`[Template]` or the DataDriver library): one run per data row → a loop generating a `test()` per row.
- **BDD** (`Given`/`When`/`Then`/`And`/`But`): Robot ignores these prefixes when matching keywords, so each line is still just a keyword call. Preserve the readability with `test.step('…')` blocks or well-named methods; do not invent a Gherkin layer that was not there.

### Results and execution (scan and parity)
- A run writes `output.xml` (machine-readable) alongside `log.html` and `report.html`. For parity (step 5), parse `output.xml` and key each result by `robot:<suite>::<test>` to compare against the Playwright run.
- Parallelism is usually **Pabot** (`pabot`), not built in → Playwright `workers` and `--shard`. Re-running only failures (`robot --rerun-failed` then `rebot --merge`) → Playwright `--last-failed`.

## Selenium specifics
Selenium drives a real browser through the W3C WebDriver protocol via a per-browser driver. Most of the migration is replacing that driver, wait and locator model with Playwright's built-in engine.

### Architecture (what you are replacing)
Selenium is client–server: test code → the WebDriver API → a browser driver (ChromeDriver, GeckoDriver, EdgeDriver, SafariDriver) → the browser, over the W3C WebDriver protocol; Selenium Grid distributes sessions to remote nodes. Playwright ships and manages its own browsers and talks to them directly, so there is no separate driver or Grid layer to port. Grid and remote capabilities → Playwright projects and `workers` (plus a cloud provider only if one is still required).

### Locators (`By` → locator)
| Selenium | Playwright |
|---|---|
| `By.id` / `By.name` | `locator('#id')` / `locator('[name="…"]')` — prefer `getByRole`/`getByLabel` |
| `By.cssSelector` | `locator(css)` |
| `By.xpath` | a role/label/text locator (avoid XPath) |
| `By.linkText` / `By.partialLinkText` | `getByRole('link', { name })` |
| `By.className` / `By.tagName` | `locator('.class')` / `locator('tag')` |
| Relative locators (`above`, `below`, `near`) | `locator.filter({ … })` or a layout-independent role/label locator |

Translate to the `locator-strategy` priority (role, label, placeholder, text, test id) rather than porting CSS or XPath verbatim.

### Waits (three models → one)
| Selenium | Playwright |
|---|---|
| Implicit wait (`implicitlyWait`) | removed — Playwright auto-waits for actionability |
| Explicit `WebDriverWait` + `ExpectedConditions` (`visibilityOfElementLocated`, `elementToBeClickable`, …) | `await expect(locator).toBeVisible()` / `.toBeEnabled()` |
| `FluentWait` (custom polling, ignored exceptions) | `await expect(async () => { … }).toPass({ intervals: […] })` |
| `Thread.sleep`, page-load-strategy tweaks | removed / built-in waiting (`waitForLoadState` only if needed) |

Mixing implicit and explicit waits is a common Selenium source of flakiness; Playwright has a single waiting model, so the mix disappears.

### Other APIs
| Selenium | Playwright |
|---|---|
| `Actions` (hover, drag-and-drop, key chords) | `locator.hover()`, `locator.dragTo()`, `page.keyboard` |
| `Select` (dropdowns) | `locator.selectOption()` |
| `JavascriptExecutor.executeScript` | `page.evaluate()` — last resort; prefer real interactions |
| `driver.manage().getCookies()` / add cookies | `context.cookies()` / `context.addCookies()` |
| `ChromeOptions` / headless / capabilities | project `use` options in `playwright.config.ts` |
| `getScreenshotAs` | `page.screenshot()` / `visual-testing` |

Navigation, click, `sendKeys`, `isDisplayed`/`getText`, frames, windows, alerts and `@FindBy` are in the Mapping table above.

## TestNG specifics
TestNG provides the lifecycle, data and suite configuration around Java Selenium tests. Map its annotations to fixtures, `testng.xml` to Playwright config and projects, and drop ordering and dependencies in favour of independent, parallel-safe tests.

### Lifecycle and test annotations
| TestNG | Playwright |
|---|---|
| `@BeforeSuite` / `@AfterSuite` | `globalSetup` / `globalTeardown` |
| `@BeforeTest`/`@AfterTest`, `@BeforeClass`/`@AfterClass` | worker- or describe-scoped fixtures (`beforeAll`/`afterAll`) |
| `@BeforeGroups` / `@AfterGroups` | a composed tag-scoped fixture (no direct equivalent) |
| `@BeforeMethod` / `@AfterMethod` | a test fixture (per-test setup/teardown) |
| `@Test` | `test()` |
| `@Test(enabled = false)` | `test.skip` / `test.fixme` |
| `@Test(priority = n)`, `dependsOnMethods`, `dependsOnGroups` | drop the ordering — make tests independent; Playwright runs them in parallel |
| `@Test(groups = { … })` | a tag, `{ tag: ['@group'] }` |
| `@DataProvider` (returns `Object[][]`, may run in parallel, may read CSV/Excel/JSON) | a loop generating a `test()` per row, data via `test-data-management` |
| `@Parameters` (values from `testng.xml`) | typed config / env / fixtures |
| `@Factory` | parameterised test generation (a loop) |

### Suite configuration (`testng.xml`) → Playwright config
`testng.xml` is an XML suite (not a Java class) that decides which classes, packages and groups run, with which parameters and on how many threads, without recompiling. Map it to `playwright.config.ts` projects plus CLI filters.

| TestNG | Playwright |
|---|---|
| `<classes>` / `<packages>`, include/exclude `<groups>` | `testDir`/`testMatch` and `--grep` / `--grep-invert` on tags |
| `parallel="methods\|classes\|tests\|instances"` + `thread-count` | `workers` (and `--shard` in CI) |
| `ThreadLocal<WebDriver>` for thread safety | not needed — each worker and browser context is isolated by default |
| `<parameter>` values | config / env |
| `preserve-order` | not applicable — tests are independent |

### Assertions, listeners, retries, reports
| TestNG | Playwright |
|---|---|
| `Assert.*` (hard) | `expect(...)` |
| `SoftAssert` / `assertAll()` | `expect.soft(...)` |
| `ITestListener` (e.g. screenshot on failure) | reporters + `trace` / `screenshot: 'only-on-failure'` in config — no custom listener |
| `IRetryAnalyzer` | `retries` in config — but prefer fixing flakiness (`regression-optimization`) |
| built-in HTML report | the Playwright HTML reporter (`reporting-analytics`) |

## Maven and the Java toolchain
A Java Selenium/TestNG suite is usually a Maven (or Gradle) project, so migrating the suite also replaces the build and runtime. Read `pom.xml` for the dependency versions and how tests are run.

| Maven / Java | Playwright / Node |
|---|---|
| `pom.xml` dependencies and versions | `package.json` (npm) |
| `org.seleniumhq.selenium:selenium-java` + `org.testng:testng` | `@playwright/test` (a single dependency) |
| WebDriverManager, a driver-binary plugin, or manual driver binaries | not needed — Playwright installs and pins its own browsers (`npx playwright install`) |
| `maven-surefire-plugin` running TestNG in the `test` phase (`<suiteXmlFiles>`) | the Playwright runner (`npx playwright test`) |
| `maven-failsafe-plugin` for integration tests (`verify` phase) | Playwright projects / CI stages |
| `mvn test` / `mvn clean install`, `-Dgroups=…`, `-Dtest=…` | `npx playwright test`, `--grep @tag`, a test path |
| `src/test/java` layout, Maven profiles | `tests/` layout, npm scripts |

No separate driver, Grid or Surefire wiring survives the move — the Playwright runner, its config and its browser management replace the whole Maven test toolchain.

## Cypress specifics
Cypress is a JavaScript/TypeScript end-to-end framework with a distinctive architecture: unlike Selenium (and Playwright), which drive the browser from outside, Cypress runs in the same run loop as the application. That makes most Cypress tests map cleanly to Playwright, but a few in-process tricks need rework.

### Architecture (and what migrates cleanly)
Cypress executes inside the browser, in the application's run loop, with a Node process behind it; it does not use WebDriver. Playwright, like Selenium, drives the browser out-of-process over a protocol.

| Cypress relies on | In Playwright |
|---|---|
| in-browser run loop with automatic waiting | the same intent: Playwright auto-waits for actionability and web-first assertions retry |
| a single tab, same-origin by default (`cy.origin()` for cross-origin) | native multiple tabs/pages, windows and origins — `cy.origin()` blocks disappear |
| Chrome-family and Firefox | add WebKit/Safari for free (three engines) |
| native in-process access to `window`, app stores and functions | reach app internals only via `page.evaluate` / `exposeFunction` / `addInitScript`; prefer real user interactions |

Clean to migrate: UI journeys, network stubbing, assertions. Needs rework: tests that call application functions directly, mutate internal stores, or force hidden elements — translate to real interactions, or mark `TODO(migration)` and lower the confidence.

### Commands, queries and retry-ability
Cypress chains are enqueued commands, not real promises, and Cypress automatically retries its queries and the last assertion until they pass or time out. Translate the chain to real `async`/`await` and let web-first assertions carry the retry.

| Cypress | Playwright |
|---|---|
| `cy.visit(url)` | `await page.goto(url)` |
| `cy.get(sel)` / `cy.contains(t)` | `page.locator(sel)` / `page.getByText(t)` |
| `cy.get('[data-cy="x"]')` | `page.getByTestId('x')` (set `testIdAttribute: 'data-cy'`) |
| `.find()` / `.filter()` / `.eq(n)` / `.first()` | `locator.locator()` / `.filter()` / `.nth(n)` / `.first()` |
| `.click()` / `.type('abc{enter}')` / `.clear()` | `.click()` / `.fill('abc')` then `.press('Enter')` / `.clear()` |
| `.click({ force: true })` | `.click({ force: true })` — but prefer fixing the reason |
| `cy.wait(ms)` | removed (auto-waiting) |

### Assertions (Chai → expect)
| Cypress `.should(...)` / `expect` | Playwright |
|---|---|
| `.should('be.visible')` / `.should('exist')` | `toBeVisible()` / `toBeAttached()` |
| `.should('contain', t)` / `.should('have.text', t)` | `toContainText(t)` / `toHaveText(t)` |
| `.should('have.length', n)` | `toHaveCount(n)` |
| `.should('have.value', v)` | `toHaveValue(v)` |
| `.should('have.attr', a, v)` | `toHaveAttribute(a, v)` |
| `.should('be.checked')` / `.should('be.disabled')` | `toBeChecked()` / `toBeDisabled()` |
| chained `.and(...)` | separate `expect` calls |

### Network, time and test doubles
| Cypress | Playwright |
|---|---|
| `cy.intercept(...)` (stub/spy) + `cy.wait('@alias')` | `page.route(...)` + `page.waitForResponse(...)` |
| `cy.request(...)` | `request` / `apiAs(role)` (`api-testing`) |
| `cy.clock()` / `cy.tick()` | `page.clock` |
| `cy.stub()` / `cy.spy()` on app functions | `page.exposeFunction` / `page.evaluate` — stubbing app internals is harder out-of-process; flag anything that cannot be expressed |

### Fixtures, custom commands and hooks
| Cypress | Playwright |
|---|---|
| `cy.fixture('data.json')` | data via `test-data-management` |
| `Cypress.Commands.add('login', …)` (custom command) | a page method (one action), a module method (a workflow), or a fixture |
| `before` / `beforeEach` / `after` / `afterEach` (Mocha) | `test.beforeAll` / `beforeEach` / `afterAll` / `afterEach`, or fixtures |
| `describe` / `context` / `it` | `test.describe` / `test` |
| `cy.session(id, setup)` (cached auth) | `storageState` — authenticate once in `globalSetup`, reuse via `storageState` |
| `cy.origin()` cross-origin | not needed — Playwright handles cross-origin natively |

### Config, CLI and layout
| Cypress | Playwright |
|---|---|
| `cypress.config.{js,ts}` (`baseUrl`, `specPattern`, `e2e`, `retries`, `viewport`) | `playwright.config.ts` (`use.baseURL`, `testMatch`, `projects`, `retries`, viewport in `use`) |
| `cypress run` / `cypress open` | `npx playwright test` / `npx playwright test --ui` |
| `*.cy.{js,ts}` specs under `cypress/e2e` | `*.spec.ts` under `tests/` |
| Cloud parallelisation across machines | `workers` locally and `--shard` in CI |
| Mocha reporters | Playwright reporters (`reporting-analytics`) |

## Definition of Done
- Backlog lists every legacy test with id, complexity and wave.
- Each converted test has a `legacy-id`, conversion notes and confidence, and passes the verify script.
- Parity report has no unexplained blocking rows; no legacy file changed.
