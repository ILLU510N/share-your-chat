import browser from 'webextension-polyfill';

import { getChatContent } from '@/modules/chat-content';
import { detectSite } from '@/modules/site-detection';
import { createExportButton } from '@/modules/ui';

console.log(' Content script loaded for', browser.runtime.getManifest().name);

type GeminiInsertionPoint = {
  container: HTMLElement;
  referenceChild: HTMLElement | null;
};

function isVisibleElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return false;
  }

  const styles = window.getComputedStyle(element);
  return styles.display !== 'none' && styles.visibility !== 'hidden';
}

function getGeminiHeaderButtons(): HTMLElement[] {
  const selectors = [
    'top-bar-actions button',
    'top-bar-actions [role="button"]',
    'top-bar-actions [role="link"]',
    '.top-bar-actions button',
    '.top-bar-actions [role="button"]',
    '.top-bar-actions [role="link"]',
    'header button',
    'header [role="button"]',
    'header [role="link"]',
    '[role="banner"] button',
    '[role="banner"] [role="button"]',
    '[role="banner"] [role="link"]',
  ];
  const seen = new Set<HTMLElement>();
  const buttons: HTMLElement[] = [];

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      if (!isVisibleElement(element) || seen.has(element)) {
        continue;
      }

      if (element.closest('[data-testid="export-chat-button"]')) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (rect.top > 240) {
        continue;
      }

      seen.add(element);
      buttons.push(element);
    }
  }

  return buttons.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const verticalDiff = leftRect.top - rightRect.top;

    if (Math.abs(verticalDiff) > 24) {
      return verticalDiff;
    }

    return rightRect.right - leftRect.right;
  });
}

function countButtonLikeChildren(element: HTMLElement): number {
  return Array.from(element.children).filter((child) => {
    if (!(child instanceof HTMLElement) || !isVisibleElement(child)) {
      return false;
    }

    if (child.matches('[data-testid="export-chat-button"]')) {
      return false;
    }

    return (
      child.matches('button, [role="button"], [role="link"]') ||
      child.querySelector('button, [role="button"], [role="link"]') !== null
    );
  }).length;
}

function findGeminiInsertionPoint(): GeminiInsertionPoint | null {
  const headerButtons = getGeminiHeaderButtons();

  for (const anchorButton of headerButtons) {
    let current: HTMLElement | null = anchorButton;

    while (current?.parentElement && current.parentElement !== document.body) {
      const nextContainer = current.parentElement as HTMLElement;
      const rect = nextContainer.getBoundingClientRect();

      if (rect.top > 240) {
        break;
      }

      if (countButtonLikeChildren(nextContainer) >= 2) {
        return { container: nextContainer, referenceChild: current };
      }

      current = nextContainer;
    }

    if (anchorButton.parentElement) {
      return {
        container: anchorButton.parentElement,
        referenceChild: anchorButton,
      };
    }
  }

  return null;
}

function insertGeminiExportButton(): boolean {
  if (document.querySelector('[data-testid="export-chat-button"]')) {
    return true;
  }

  const exportButton = createExportButton();
  const insertionPoint = findGeminiInsertionPoint();

  if (insertionPoint) {
    if (
      insertionPoint.referenceChild &&
      insertionPoint.container.contains(insertionPoint.referenceChild)
    ) {
      insertionPoint.container.insertBefore(exportButton, insertionPoint.referenceChild);
    } else {
      insertionPoint.container.appendChild(exportButton);
    }

    return true;
  }

  // Gemini 页面在未登录或新版布局下可能没有稳定的 header/button 锚点，
  // 这时退回到扩展自有的右上角固定挂载，保证入口始终可见。
  exportButton.classList.add('chat-export-gemini-floating');
  document.body.appendChild(exportButton);
  return true;
}

// listen for messages from popup
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'GET_CHAT_CONTENT'
  ) {
    getChatContent(false)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error: error.message });
      });
  }
  // return true for handled messages to keep the message channel open for async response
  return true;
});

function init() {
  const site = detectSite();

  // track if we've already added the button to prevent infinite loops
  let buttonAdded = false;
  let observer: MutationObserver | null = null;
  let currentUrl = window.location.href;

  // throttle function to prevent excessive DOM queries
  let throttleTimeout: number | null = null;
  const throttledButtonCheck = () => {
    if (throttleTimeout) return;

    throttleTimeout = window.setTimeout(() => {
      throttleTimeout = null;

      // check if button still exists in DOM (might have been removed by SPA navigation)
      const existingButton = document.querySelector('[data-testid="export-chat-button"]');
      if (buttonAdded && !existingButton) {
        // button was removed (likely due to navigation), reset flag
        buttonAdded = false;
      }

      if (buttonAdded) {
        return;
      }

      if (site === 'claude') {
        // for Claude.ai, look for the wiggle-controls-actions container which holds the Share button
        const chatActionsContainer = document.querySelector(
          '[data-testid="wiggle-controls-actions"]'
        );
        if (chatActionsContainer && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          // insert export button before the Share button in the actions container
          chatActionsContainer.insertBefore(exportButton, chatActionsContainer.firstChild);
          buttonAdded = true;
        }
      } else if (site === 'gemini') {
        if (insertGeminiExportButton()) {
          buttonAdded = true;
        }
      } else {
        // for ChatGPT, look for the share button
        const shareButton = document.querySelector('[data-testid="share-chat-button"]');
        if (shareButton && !document.querySelector('[data-testid="export-chat-button"]')) {
          const exportButton = createExportButton();
          shareButton.parentElement?.insertBefore(exportButton, shareButton);
          buttonAdded = true;
        }
      }
    }, 500); // 500ms throttle
  };

  const startObserving = () => {
    // disconnect existing observer if any
    observer?.disconnect();

    observer = new MutationObserver((mutations) => {
      // check for URL changes (SPA navigation)
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        buttonAdded = false; // reset flag on navigation
      }

      // only check if we see significant DOM changes (not just text changes)
      const hasSignificantChanges = mutations.some(
        (mutation) =>
          mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some((node) => node.nodeType === Node.ELEMENT_NODE)
      );

      if (hasSignificantChanges || !buttonAdded) {
        throttledButtonCheck();
      }
    });

    // observe more selectively - target likely parent containers instead of entire body
    const targetElement =
      site === 'gemini'
        ? document.querySelector('top-bar-actions, header, [role="banner"], main, [role="main"]') ||
          document.body
        : document.body;

    observer.observe(targetElement, {
      childList: true,
      subtree: true,
    });
  };

  // listen for popstate events (browser back/forward navigation)
  window.addEventListener('popstate', () => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      throttledButtonCheck();
    }
  });

  // for SPAs that use pushState/replaceState, we need to intercept those calls
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      // delay check to allow DOM to update
      setTimeout(throttledButtonCheck, 500);
    }
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      buttonAdded = false;
      // delay check to allow DOM to update
      setTimeout(throttledButtonCheck, 500);
    }
  };

  // for Gemini, wait a bit before starting to observe since the Angular app needs time to load
  const startDelay = site === 'gemini' ? 2000 : 0;

  setTimeout(() => {
    // try immediate button insertion first
    throttledButtonCheck();

    // start observing - dont stop after 30 seconds for SPAs
    startObserving();
  }, startDelay);
}

init();
