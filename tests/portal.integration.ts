import { test, expect } from "@playwright/test";

test("portal toggles between Sign in and Sign out via Lifecycle.Env", async ({
  page,
}) => {
  await page.goto("/portal");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Hey, Guest!");

  const signIn = page.getByRole("button", { name: /^Sign in$/i });
  const signOut = page.getByRole("button", { name: /^Sign out$/i });

  await expect(signIn).toBeVisible();
  await expect(signOut).toHaveCount(0);

  await signIn.click();
  await expect(signOut).toBeVisible();
  await expect(signIn).toHaveCount(0);
  await expect(heading).not.toHaveText("Hey, Guest!");

  await signOut.click();
  await expect(signIn).toBeVisible();
  await expect(signOut).toHaveCount(0);
  await expect(heading).toHaveText("Hey, Guest!");
});
