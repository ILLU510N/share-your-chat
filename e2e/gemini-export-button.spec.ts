import { expect } from '@playwright/test';

import { test } from './extention-fixtures';

function mockGeminiPage(): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Gemini mock</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
      }

      top-bar-actions {
        position: fixed;
        top: 8px;
        right: 12px;
        left: 288px;
        z-index: 3;
        display: flex;
        height: 48px;
      }

      .top-bar-actions {
        display: grid;
        width: 100%;
        height: 48px;
      }

      .right-section {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .buttons-container {
        display: flex;
        align-items: center;
        height: 48px;
      }

      .upgrade-button {
        width: 100px;
        height: 40px;
      }

      .conversation-actions-button {
        width: 36px;
        height: 36px;
      }
    </style>
  </head>
  <body>
    <chat-app>
      <main class="chat-app">
        <top-bar-actions class="side-nav-expanded">
          <div class="top-bar-actions">
            <div class="right-section">
              <div class="buttons-container adv-upsell">
                <button class="upgrade-button" data-test-id="bard-g1-dynamic-upsell-menu-button">升级</button>
              </div>
              <div class="buttons-container">
                <button class="conversation-actions-button" aria-label="Conversation actions"></button>
              </div>
            </div>
          </div>
        </top-bar-actions>
        <section>Gemini conversation placeholder</section>
      </main>
    </chat-app>
  </body>
</html>`;
}

test.describe('Gemini export button', () => {
  test('should mount in top bar actions without overlapping the upgrade button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route('https://gemini.google.com/mock-chat', async (route) => {
      await route.fulfill({
        body: mockGeminiPage(),
        contentType: 'text/html',
        status: 200,
      });
    });

    await page.goto('https://gemini.google.com/mock-chat');

    const exportButton = page.locator('[data-testid="export-chat-button"]');
    await expect(exportButton).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.chat-export-gemini-container')).not.toHaveClass(
      /chat-export-gemini-floating/
    );

    const buttonPositions = await page.evaluate(() => {
      const exportButtonElement = document.querySelector('[data-testid="export-chat-button"]');
      const upgradeButton = document.querySelector('.upgrade-button');
      const conversationActionsButton = document.querySelector('.conversation-actions-button');

      if (!exportButtonElement || !upgradeButton || !conversationActionsButton) {
        throw new Error('Missing Gemini top bar buttons');
      }

      const exportRect = exportButtonElement.getBoundingClientRect();
      const upgradeRect = upgradeButton.getBoundingClientRect();
      const conversationActionsRect = conversationActionsButton.getBoundingClientRect();

      return {
        exportLeft: exportRect.left,
        exportRight: exportRect.right,
        isOverlappingUpgrade:
          exportRect.left < upgradeRect.right &&
          exportRect.right > upgradeRect.left &&
          exportRect.top < upgradeRect.bottom &&
          exportRect.bottom > upgradeRect.top,
        menuLeft: conversationActionsRect.left,
        upgradeRight: upgradeRect.right,
      };
    });

    expect(buttonPositions.isOverlappingUpgrade).toBe(false);
    expect(buttonPositions.exportLeft).toBeGreaterThan(buttonPositions.upgradeRight);
    expect(buttonPositions.exportRight).toBeLessThan(buttonPositions.menuLeft);
  });
});
