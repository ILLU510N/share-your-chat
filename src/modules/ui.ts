import { createExportMenuOptions } from '@/modules/export-menu-options';
import { copyToClipboard, exportToTencentDocs, saveToFile } from '@/modules/file-operations';

import { detectSite } from './site-detection';

type ThemeMode = 'dark' | 'light';

type DropdownTheme = {
  backgroundColor: string;
  borderColor: string;
  hoverBackgroundColor: string;
  shadow: string;
  textColor: string;
};

const DARK_DROPDOWN_THEME: DropdownTheme = {
  backgroundColor: 'rgb(24 24 27)',
  borderColor: 'rgba(255, 255, 255, 0.08)',
  hoverBackgroundColor: 'rgb(39 39 42)',
  shadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
  textColor: 'rgb(244 244 245)',
};

const LIGHT_DROPDOWN_THEME: DropdownTheme = {
  backgroundColor: 'rgb(255 255 255)',
  borderColor: 'rgba(24, 24, 27, 0.08)',
  hoverBackgroundColor: 'rgb(244 244 245)',
  shadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
  textColor: 'rgb(24 24 27)',
};

const THEME_SIGNAL_ATTRIBUTES = ['data-theme', 'data-color-mode', 'data-color-scheme'] as const;

function createThemeAwareDropdownItem(optionText: string): HTMLButtonElement {
  const item = document.createElement('button');

  item.type = 'button';
  item.style.width = '100%';
  item.style.display = 'block';
  item.style.padding = '12px 16px';
  item.style.border = 'none';
  item.style.outline = 'none';
  item.style.backgroundColor = 'transparent';
  item.style.textAlign = 'left';
  item.style.font = 'inherit';
  item.style.fontSize = '14px';
  item.style.lineHeight = '20px';
  item.style.cursor = 'pointer';
  item.style.transition = 'background-color 120ms ease';
  item.textContent = optionText;

  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = item.dataset.hoverBackgroundColor ?? item.style.backgroundColor;
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = item.dataset.baseBackgroundColor ?? item.style.backgroundColor;
  });

  return item;
}

function applyDropdownTheme(
  dropdown: HTMLDivElement,
  items: HTMLButtonElement[],
  theme: DropdownTheme
): void {
  dropdown.style.backgroundColor = theme.backgroundColor;
  dropdown.style.color = theme.textColor;
  dropdown.style.border = `1px solid ${theme.borderColor}`;
  dropdown.style.boxShadow = theme.shadow;

  items.forEach((item) => {
    item.dataset.baseBackgroundColor = theme.backgroundColor;
    item.dataset.hoverBackgroundColor = theme.hoverBackgroundColor;
    item.style.backgroundColor = theme.backgroundColor;
    item.style.color = theme.textColor;
  });
}

function resolveDropdownTheme(anchor: HTMLElement): DropdownTheme {
  const themeMode = resolveThemeMode(anchor);

  return themeMode === 'dark' ? DARK_DROPDOWN_THEME : LIGHT_DROPDOWN_THEME;
}

function resolveThemeMode(anchor: HTMLElement): ThemeMode {
  const candidates = collectThemeCandidates(anchor);

  for (const candidate of candidates) {
    const attributeSignal = readThemeModeFromAttributes(candidate);
    if (attributeSignal) {
      return attributeSignal;
    }

    const colorSchemeSignal = readThemeModeFromColorScheme(candidate);
    if (colorSchemeSignal) {
      return colorSchemeSignal;
    }

    const backgroundSignal = readThemeModeFromBackground(candidate);
    if (backgroundSignal) {
      return backgroundSignal;
    }
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function collectThemeCandidates(anchor: HTMLElement): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  let current: HTMLElement | null = anchor;

  while (current && candidates.length < 6) {
    candidates.push(current);
    current = current.parentElement;
  }

  if (document.body && !candidates.includes(document.body)) {
    candidates.push(document.body);
  }

  if (
    document.documentElement instanceof HTMLElement &&
    !candidates.includes(document.documentElement)
  ) {
    candidates.push(document.documentElement);
  }

  return candidates;
}

function readThemeModeFromAttributes(element: HTMLElement): ThemeMode | null {
  const attributeValues = THEME_SIGNAL_ATTRIBUTES.map((attributeName) =>
    element.getAttribute(attributeName)
  ).filter((value): value is string => Boolean(value));
  const className = typeof element.className === 'string' ? element.className : '';
  const signalText = `${className} ${attributeValues.join(' ')}`.toLowerCase();

  if (signalText.includes('dark')) {
    return 'dark';
  }

  if (signalText.includes('light')) {
    return 'light';
  }

  return null;
}

function readThemeModeFromColorScheme(element: HTMLElement): ThemeMode | null {
  const colorScheme = window.getComputedStyle(element).colorScheme.toLowerCase();

  if (colorScheme.includes('dark')) {
    return 'dark';
  }

  if (colorScheme.includes('light')) {
    return 'light';
  }

  return null;
}

function readThemeModeFromBackground(element: HTMLElement): ThemeMode | null {
  const backgroundColor = window.getComputedStyle(element).backgroundColor;
  const colorChannels = backgroundColor.match(/\d+(\.\d+)?/g);

  if (!colorChannels || colorChannels.length < 3) {
    return null;
  }

  const [red, green, blue, alpha = '1'] = colorChannels.map(Number);
  if (alpha === 0) {
    return null;
  }

  // 用背景亮度做最后兜底，避免页面没有暴露主题信号时下拉菜单不可读。
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance < 0.5 ? 'dark' : 'light';
}

export function createExportButton(): HTMLElement {
  const site = detectSite();
  const buttonContainer = document.createElement('div');
  buttonContainer.style.position = 'relative';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Export');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('data-testid', 'export-chat-button');

  if (site === 'claude') {
    // 复用 Claude 顶部操作区的按钮尺寸和排版。
    button.className = `inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300
      ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none
      disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none font-base-bold
      border-0.5 relative overflow-hidden transition duration-100 backface-hidden h-8 rounded-md px-3
      min-w-[4rem] active:scale-[0.985] whitespace-nowrap !text-xs`;
    buttonContainer.className = 'mr-1';
    buttonContainer.style.position = 'relative';
  } else if (site === 'gemini') {
    // Gemini 改版频繁，这里只使用扩展自有样式，不依赖站点内部类名。
    buttonContainer.className = 'chat-export-gemini-container';
    button.className = 'chat-export-gemini-button';
    button.title = 'Export';
    button.appendChild(document.createTextNode('Export'));
  } else {
    button.className = 'btn relative btn-secondary text-token-text-primary';
  }

  if (site !== 'gemini') {
    const buttonContent = document.createElement('div');
    buttonContent.className =
      site === 'claude' ? '' : 'flex w-full items-center justify-center gap-1.5';

    buttonContent.appendChild(document.createTextNode('Export'));
    button.appendChild(buttonContent);
  }

  buttonContainer.appendChild(button);

  const dropdown = document.createElement('div');
  const dropdownItems: HTMLButtonElement[] = [];
  dropdown.setAttribute('role', 'menu');
  dropdown.style.position = 'absolute';
  dropdown.style.zIndex = '99999';
  dropdown.style.display = 'none';
  dropdown.style.minWidth = site === 'gemini' ? '168px' : '192px';
  dropdown.style.padding = '8px 0';
  dropdown.style.borderRadius = '8px';
  dropdown.style.overflow = 'hidden';

  const options = createExportMenuOptions({
    copyToClipboard,
    exportToTencentDocs,
    saveToFile,
  });

  options.forEach((option, index) => {
    const item = createThemeAwareDropdownItem(option.text);
    item.setAttribute('role', 'menuitem');

    if (index > 0) {
      item.style.marginTop = '4px';
    }

    dropdownItems.push(item);
    dropdown.appendChild(item);
    item.onclick = () => {
      dropdown.style.display = 'none';
      void option.action();
    };
  });

  document.body.appendChild(dropdown);

  button.onclick = (event) => {
    event.stopPropagation();
    const shouldOpen = dropdown.style.display === 'none' || dropdown.style.display === '';

    if (!shouldOpen) {
      dropdown.style.display = 'none';
      return;
    }

    applyDropdownTheme(dropdown, dropdownItems, resolveDropdownTheme(button));
    dropdown.style.display = 'block';

    // 先显示再测量宽度，确保 Gemini 右对齐时拿到真实菜单尺寸。
    const buttonRect = button.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const top = buttonRect.bottom + window.scrollY + 8;
    const preferredLeft =
      site === 'gemini'
        ? buttonRect.right + window.scrollX - dropdownRect.width
        : buttonRect.left + window.scrollX;
    const maxLeft = window.scrollX + window.innerWidth - dropdownRect.width - 8;
    const left = Math.max(window.scrollX + 8, Math.min(preferredLeft, maxLeft));

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  };

  document.addEventListener('click', (event) => {
    if (
      event.target instanceof Node &&
      (buttonContainer.contains(event.target) || dropdown.contains(event.target))
    ) {
      return;
    }

    dropdown.style.display = 'none';
  });

  return buttonContainer;
}
