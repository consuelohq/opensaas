import { Locator, Page } from '@playwright/test';

export class CoachingPanel {
  readonly panel: Locator;
  readonly header: Locator;
  readonly loadingSkeleton: Locator;
  readonly talkingPoints: Locator;
  readonly clarifyingQuestions: Locator;
  readonly objectionResponses: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly postCallSummary: Locator;
  readonly scoreBadge: Locator;
  readonly keyMoments: Locator;
  readonly nextSteps: Locator;

  constructor(public readonly page: Page) {
    this.panel = page.getByText('Coaching');
    this.header = page.getByText('Coaching');
    this.loadingSkeleton = page.locator('[data-loading="true"]');
    this.talkingPoints = page.getByText('Talking Points');
    this.clarifyingQuestions = page.getByText('Clarifying Questions');
    this.objectionResponses = page.getByText('Objection Responses');
    this.errorMessage = page.locator('[role="alert"]');
    this.retryButton = page.getByRole('button', { name: 'Retry' });
    this.postCallSummary = page.getByText('Post-Call Analysis');
    this.scoreBadge = page.locator('[class*="ScoreBadge"]');
    this.keyMoments = page.getByText('Key Moments');
    this.nextSteps = page.getByText('Next Steps');
  }
}
