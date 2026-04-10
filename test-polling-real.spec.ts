import { test, expect } from '@playwright/test';

test('flow result actually appears', async ({ page }) => {
  await page.goto('http://localhost:3000/chat/flows/flow-def-1775325287429-axvxya8j5');

  // First, we need to select a flow before we can start it
  // Let's wait for the page to load and check for flow selection
  await page.waitForTimeout(2000);
  
  // Check if there's a flow selector - if not, we might need to create one first
  // For now, let's try to click the start button and see what happens
  // start flow
  await page.click('[data-test=start-flow]');

  // wait until polling should be done
  await page.waitForTimeout(65000);

  // ❗ REAL CHECK: text/content exists in UI
  const content = await page.locator('[data-test=flow-result]').textContent();

  if (content && content.length > 0) {
    console.log('WORKED');
  } else {
    console.log('DIDNT');
  }

  expect(content).not.toBe('');
});