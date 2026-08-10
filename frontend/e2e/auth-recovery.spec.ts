/**
 * Location: frontend/e2e/auth-recovery.spec.ts
 * Purpose: Verify OAuth cancellation and storage-denied auth recovery.
 * Why: Terminal failures must release other tabs and still reach server logout.
 */

import { expect, test } from "@playwright/test";

const TEST_SERVER = "http://127.0.0.1:4010";

test.beforeEach(async ({ request }) => {
  await request.post(`${TEST_SERVER}/test/reset`);
});

test("OAuth back navigation releases another tab", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const oauthPage = await context.newPage();
  const otherPage = await context.newPage();
  await Promise.all([
    oauthPage.goto("/e2e/auth-cookie-race.html"),
    otherPage.goto("/e2e/auth-cookie-race.html"),
  ]);

  await oauthPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    await createAuthCookieOperations().runOAuthStart(
      async () => "authorization-url",
    );
  });
  await otherPage.evaluate(async () => {
    const { createAuthCookieOperations } = await import(
      "/src/lib/auth-cookie-operations.ts"
    );
    (window as Window & { authOperationDone?: boolean }).authOperationDone =
      false;
    void createAuthCookieOperations().run(async () => {
      (window as Window & { authOperationDone?: boolean }).authOperationDone =
        true;
    });
  });
  await expect
    .poll(() =>
      otherPage.evaluate(
        () =>
          (window as Window & { authOperationDone?: boolean })
            .authOperationDone,
      ),
    )
    .toBe(false);

  await oauthPage.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });

  await expect
    .poll(() =>
      otherPage.evaluate(
        () =>
          (window as Window & { authOperationDone?: boolean })
            .authOperationDone,
      ),
    )
    .toBe(true);
  await context.close();
});

test("storage denial cannot prevent login or server logout", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  const page = await context.newPage();
  await page.goto("/e2e/auth-cookie-race.html");

  await page.getByRole("button", { name: "Login A" }).click();
  await expect(page.getByTestId("current-user")).toHaveText("user-a");
  const logoutResponse = page.waitForResponse("**/api/v1/auth/logout");
  await page.getByRole("button", { name: "Logout" }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByTestId("current-user")).toHaveText("guest");

  const cookies = await context.cookies(TEST_SERVER);
  expect(cookies.some((cookie) => cookie.name === "refreshToken")).toBe(
    false,
  );
  await context.close();
});

test("sessionStorage denial without an OAuth lease still reaches logout", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage denied", "SecurityError");
      },
    });
  });
  const page = await context.newPage();
  await page.goto("/e2e/auth-cookie-race.html");

  await page.getByRole("button", { name: "Login A" }).click();
  await expect(page.getByTestId("current-user")).toHaveText("user-a");
  const logoutResponse = page.waitForResponse("**/api/v1/auth/logout");
  await page.getByRole("button", { name: "Logout" }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByTestId("current-user")).toHaveText("guest");
  await context.close();
});
