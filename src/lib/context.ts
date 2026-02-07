/**
 * Page context extraction utilities
 */

import type { PageContext, DomSnapshot, ElementInfo, AccessibilityNode } from './protocol';

/**
 * Extract basic page context from the current document
 */
export function extractPageContext(): PageContext {
  const selection = window.getSelection();
  
  return {
    url: window.location.href,
    title: document.title,
    favicon: getFavicon(),
    selectedText: selection?.toString() || undefined,
    visibleText: extractVisibleText(),
    meta: extractMetaTags(),
  };
}

/**
 * Get the page favicon URL
 */
function getFavicon(): string | undefined {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]'
  );
  return link?.href;
}

/**
 * Extract visible text content from the page
 */
function extractVisibleText(maxLength = 50000): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip hidden elements
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip script/style content
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const chunks: string[] = [];
  let length = 0;

  while (walker.nextNode() && length < maxLength) {
    const text = walker.currentNode.textContent?.trim();
    if (text) {
      chunks.push(text);
      length += text.length;
    }
  }

  return chunks.join(' ').slice(0, maxLength);
}

/**
 * Extract common meta tags
 */
function extractMetaTags(): Record<string, string> {
  const meta: Record<string, string> = {};
  
  const tags = ['description', 'keywords', 'author', 'og:title', 'og:description'];
  
  for (const name of tags) {
    const el = document.querySelector<HTMLMetaElement>(
      `meta[name="${name}"], meta[property="${name}"]`
    );
    if (el?.content) {
      meta[name] = el.content;
    }
  }
  
  return meta;
}

/**
 * Generate a DOM snapshot with element references
 */
export function generateDomSnapshot(): DomSnapshot {
  const elements: ElementInfo[] = [];
  let refCounter = 0;

  const interactiveSelectors = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[onclick]',
    '[tabindex]',
  ].join(',');

  document.querySelectorAll(interactiveSelectors).forEach((el) => {
    const rect = el.getBoundingClientRect();
    
    // Skip off-screen or invisible elements
    if (rect.width === 0 || rect.height === 0) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const ref = `e${refCounter++}`;
    el.setAttribute('data-pincer-ref', ref);

    elements.push({
      ref,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: el.className ? el.className.split(' ').filter(Boolean) : undefined,
      text: el.textContent?.trim().slice(0, 100) || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      attributes: getRelevantAttributes(el),
    });
  });

  return { elements };
}

/**
 * Get relevant attributes for an element
 */
function getRelevantAttributes(el: Element): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  const relevant = ['href', 'src', 'type', 'name', 'placeholder', 'aria-label', 'role', 'value'];
  
  for (const name of relevant) {
    const value = el.getAttribute(name);
    if (value) {
      attrs[name] = value.slice(0, 200);
    }
  }
  
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/**
 * Find element by Pincer ref
 */
export function findElementByRef(ref: string): Element | null {
  return document.querySelector(`[data-pincer-ref="${ref}"]`);
}

/**
 * Highlight an element visually
 */
export function highlightElement(ref: string, duration = 2000): void {
  const el = findElementByRef(ref);
  if (!el) return;

  const overlay = document.createElement('div');
  overlay.className = 'pincer-highlight';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 3px solid #ff6b00;
    background: rgba(255, 107, 0, 0.1);
    border-radius: 4px;
    z-index: 999999;
    transition: opacity 0.3s;
  `;

  const rect = el.getBoundingClientRect();
  overlay.style.left = `${rect.left - 3}px`;
  overlay.style.top = `${rect.top - 3}px`;
  overlay.style.width = `${rect.width + 6}px`;
  overlay.style.height = `${rect.height + 6}px`;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }, duration);
}
