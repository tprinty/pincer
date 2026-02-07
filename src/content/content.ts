/**
 * Pincer Content Script
 * Runs in page context, extracts info and executes commands
 */

import { extractPageContext, generateDomSnapshot, highlightElement, findElementByRef } from '../lib/context';
import type { ClawCommand } from '../lib/protocol';

/**
 * Handle messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'get_context':
      sendResponse(extractPageContext());
      break;

    case 'get_snapshot':
      sendResponse(generateDomSnapshot());
      break;

    case 'pincer_command':
      handleCommand(message.command).then(sendResponse);
      return true; // Async response

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Handle commands from OpenClaw
 */
async function handleCommand(command: ClawCommand): Promise<unknown> {
  console.log('[Pincer] Executing command:', command.type);

  switch (command.type) {
    case 'get_context':
      return extractPageContext();

    case 'get_snapshot':
      return generateDomSnapshot();

    case 'screenshot':
      // Screenshots are handled by background script via chrome.tabs API
      return { error: 'Use background script for screenshots' };

    case 'highlight':
      if (command.ref) {
        highlightElement(command.ref);
        return { ok: true };
      }
      if (command.selector) {
        const el = document.querySelector(command.selector);
        if (el) {
          el.setAttribute('data-pincer-ref', 'temp-highlight');
          highlightElement('temp-highlight');
          return { ok: true };
        }
      }
      return { error: 'No element found' };

    case 'click':
      return executeClick(command);

    case 'type':
      return executeType(command);

    case 'scroll':
      return executeScroll(command);

    case 'navigate':
      if (command.url) {
        window.location.href = command.url;
        return { ok: true };
      }
      return { error: 'No URL provided' };

    case 'execute':
      // Security: Only allow if explicitly enabled
      return { error: 'Script execution disabled' };

    default:
      return { error: `Unknown command: ${command.type}` };
  }
}

/**
 * Execute a click command
 */
async function executeClick(command: ClawCommand): Promise<unknown> {
  let element: Element | null = null;

  if (command.ref) {
    element = findElementByRef(command.ref);
  } else if (command.selector) {
    element = document.querySelector(command.selector);
  } else if (command.coordinates) {
    element = document.elementFromPoint(command.coordinates.x, command.coordinates.y);
  }

  if (!element) {
    return { error: 'Element not found' };
  }

  // Highlight before clicking
  if (command.ref) {
    highlightElement(command.ref, 500);
  }

  // Small delay for visual feedback
  await new Promise((r) => setTimeout(r, 200));

  if (element instanceof HTMLElement) {
    element.click();
    return { ok: true, clicked: describeElement(element) };
  }

  return { error: 'Element is not clickable' };
}

/**
 * Execute a type command
 */
function executeType(command: ClawCommand): unknown {
  let element: Element | null = null;

  if (command.ref) {
    element = findElementByRef(command.ref);
  } else if (command.selector) {
    element = document.querySelector(command.selector);
  }

  if (!element) {
    return { error: 'Element not found' };
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.value = command.text || '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus();
    element.textContent = command.text || '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  }

  return { error: 'Element is not editable' };
}

/**
 * Execute a scroll command
 */
function executeScroll(command: ClawCommand): unknown {
  if (command.ref) {
    const element = findElementByRef(command.ref);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { ok: true };
    }
    return { error: 'Element not found' };
  }

  if (command.coordinates) {
    window.scrollTo({
      left: command.coordinates.x,
      top: command.coordinates.y,
      behavior: 'smooth',
    });
    return { ok: true };
  }

  // Default: scroll by viewport
  const direction = (command.options?.direction as string) || 'down';
  const amount = window.innerHeight * 0.8;

  window.scrollBy({
    top: direction === 'up' ? -amount : amount,
    behavior: 'smooth',
  });

  return { ok: true };
}

/**
 * Describe an element briefly
 */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const text = el.textContent?.trim().slice(0, 30) || '';
  return `${tag}${id}${text ? `: "${text}"` : ''}`;
}

/**
 * Track text selection and notify background
 */
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (text && text.length > 0) {
    chrome.runtime.sendMessage({
      type: 'selection',
      text,
    });
  }
});

console.log('[Pincer] Content script loaded');
