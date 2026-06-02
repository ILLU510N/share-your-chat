import { Site } from './types';

const PLATFORM_NAMES: Record<Site, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
};

const MODEL_CANDIDATE_SELECTORS: Record<Site, string[]> = {
  chatgpt: [
    '[data-testid="model-switcher-dropdown-button"]',
    '[data-testid*="model"]',
    'header button',
    'header [role="button"]',
  ],
  claude: ['[data-testid*="model"]', 'header button', 'header [role="button"]'],
  gemini: [
    'ms-toolbar button',
    'ms-toolbar [role="button"]',
    '[data-testid*="model"]',
    'header button',
    'header [role="button"]',
  ],
};

const MODEL_PATTERNS: Record<Site, RegExp[]> = {
  chatgpt: [
    /\bChatGPT\s+[A-Za-z0-9.-]+(?:\s+[A-Za-z0-9.-]+){0,2}\b/i,
    /\bGPT-[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.-]+){0,2}\b/i,
    /\bo\d(?:-[A-Za-z0-9.]+){0,3}\b/i,
  ],
  claude: [
    /\bClaude\s+(?:Opus|Sonnet|Haiku)(?:\s+[0-9.]+)?\b/i,
    /\b(?:Opus|Sonnet|Haiku)\s+[0-9.]+\b/i,
    /\bclaude-[a-z0-9.-]+\b/i,
  ],
  gemini: [
    /\bGemini\s+[0-9.]+\s+(?:Pro|Flash|Ultra|Nano)(?:\s+[A-Za-z0-9.-]+){0,2}\b/i,
    /\bgemini-[a-z0-9.-]+\b/i,
  ],
};

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function collectModelCandidateTexts(site: Site): string[] {
  const candidates = new Set<string>();

  const addCandidate = (value: string | null | undefined) => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue || normalizedValue.length > 120) {
      return;
    }

    candidates.add(normalizedValue);
  };

  const selectors = MODEL_CANDIDATE_SELECTORS[site];
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      addCandidate(element.textContent);
      addCandidate(element.getAttribute('aria-label'));
      addCandidate(element.getAttribute('title'));
    }
  }

  return Array.from(candidates);
}

function detectModelName(site: Site): string | undefined {
  // 这几个站点都没有稳定的结构化 model 字段，这里只在顶部工具栏附近做启发式识别。
  const candidates = collectModelCandidateTexts(site);

  for (const candidate of candidates) {
    for (const pattern of MODEL_PATTERNS[site]) {
      const match = candidate.match(pattern);
      if (match?.[0]) {
        return normalizeText(match[0]);
      }
    }
  }

  return undefined;
}

export function getPlatformName(site: Site): string {
  return PLATFORM_NAMES[site];
}

export function getAssistantDisplayName(site: Site): string {
  const platformName = getPlatformName(site);
  const modelName = detectModelName(site);

  if (!modelName) {
    return platformName;
  }

  if (modelName.toLowerCase().startsWith(platformName.toLowerCase())) {
    return modelName;
  }

  return `${platformName} (${modelName})`;
}
