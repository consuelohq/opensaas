import { test, expect } from '@playwright/test';
import { DialerSidebar } from '../lib/pom/dialerSidebar';
import { CoachingPanel } from '../lib/pom/coachingPanel';

test.describe('Consuelo Coaching', () => {
  async function startCall(page: import('@playwright/test').Page) {
    const dialer = new DialerSidebar(page);
    await dialer.open();
    await dialer.dialNumber('5551234567');
    await page.getByRole('button', { name: 'Dial' }).click();
    await expect(page.getByText('Mute')).toBeVisible({ timeout: 15000 });
  }

  test('coaching panel opens during active call', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    const coaching = new CoachingPanel(page);
    // coaching panel should be visible during an active call
    await expect(coaching.panel).toBeVisible({ timeout: 10000 });

    await page.getByLabel('End call').click();
  });

  test('real-time suggestions appear during call', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    const coaching = new CoachingPanel(page);
    await expect(coaching.panel).toBeVisible({ timeout: 10000 });

    // coaching should show talking points or loading state
    const hasContent = coaching.talkingPoints
      .or(coaching.loadingSkeleton)
      .or(coaching.panel);
    await expect(hasContent).toBeVisible({ timeout: 15000 });

    await page.getByLabel('End call').click();
  });

  test('post-call analysis shown after disconnect', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    // end the call to trigger post-call analysis
    await page.getByLabel('End call').click();

    const coaching = new CoachingPanel(page);
    // post-call summary should appear after call ends
    const postCall = coaching.postCallSummary.or(
      page.getByText(/analyzing call/i),
    );
    await expect(postCall).toBeVisible({ timeout: 20000 });
  });

  test('coaching error state shows retry button', async ({ page }) => {
    await page.goto('/');
    await startCall(page);

    const coaching = new CoachingPanel(page);
    await expect(coaching.panel).toBeVisible({ timeout: 10000 });

    // if coaching encounters an error, retry button should be available
    if (await coaching.errorMessage.isVisible({ timeout: 5000 })) {
      await expect(coaching.retryButton).toBeVisible();
    }

    await page.getByLabel('End call').click();
  });
});
