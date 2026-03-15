import type { Page } from 'playwright-core';
import type { BrowserManager } from './browser.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  Command,
  Response,
  NavigateCommand,
  ClickCommand,
  TypeCommand,
  FillCommand,
  PressCommand,
  ScreenshotCommand,
  EvaluateCommand,
  WaitCommand,
  ScrollCommand,
  HoverCommand,
  ContentCommand,
  ConsoleCommand,
  ErrorsCommand,
  KeyboardCommand,
  GetAttributeCommand,
  GetTextCommand,
  IsVisibleCommand,
  CountCommand,
  AddInitScriptCommand,
  ReactDetectCommand,
  ComponentsCommand,
  HooksCommand,
  SetStateCommand,
  SourceCommand,
  CookiesGetCommand,
  CookiesSetCommand,
  StorageGetCommand,
  StorageSetCommand,
  StorageClearCommand,
  StateSaveCommand,
  NavigateData,
  ScreenshotData,
  EvaluateData,
  ContentData,
} from './types.js';
import { successResponse, errorResponse } from './protocol.js';

/** Cached fiber tree walker script content, loaded once at module init. */
const COMPONENT_TREE_SCRIPT = readFileSync(
  fileURLToPath(new URL('./scripts/get-component-tree.js', import.meta.url)),
  'utf-8'
);

/** Cached hook extraction script content, loaded once at module init. */
const HOOKS_SCRIPT = readFileSync(
  fileURLToPath(new URL('./scripts/get-hooks.js', import.meta.url)),
  'utf-8'
);

/** Cached set-state script content, loaded once at module init. */
const SET_STATE_SCRIPT = readFileSync(
  fileURLToPath(new URL('./scripts/set-state.js', import.meta.url)),
  'utf-8'
);

/** Cached source location script content, loaded once at module init. */
const SOURCE_SCRIPT = readFileSync(
  fileURLToPath(new URL('./scripts/get-source.js', import.meta.url)),
  'utf-8'
);

/**
 * Execute a command and return a response
 */
export async function executeCommand(command: Command, browser: BrowserManager): Promise<Response> {
  try {
    switch (command.action) {
      case 'launch':
        return await handleLaunch(command, browser);
      case 'navigate':
        return await handleNavigate(command, browser);
      case 'click':
        return await handleClick(command, browser);
      case 'type':
        return await handleType(command, browser);
      case 'fill':
        return await handleFill(command, browser);
      case 'press':
        return await handlePress(command, browser);
      case 'screenshot':
        return await handleScreenshot(command, browser);
      case 'snapshot':
        return await handleSnapshot(command, browser);
      case 'evaluate':
        return await handleEvaluate(command, browser);
      case 'wait':
        return await handleWait(command, browser);
      case 'scroll':
        return await handleScroll(command, browser);
      case 'hover':
        return await handleHover(command, browser);
      case 'content':
        return await handleContent(command, browser);
      case 'close':
        return await handleClose(command, browser);
      case 'back':
        return await handleBack(command, browser);
      case 'forward':
        return await handleForward(command, browser);
      case 'reload':
        return await handleReload(command, browser);
      case 'url':
        return await handleUrl(command, browser);
      case 'title':
        return await handleTitle(command, browser);
      case 'getattribute':
        return await handleGetAttribute(command, browser);
      case 'gettext':
        return await handleGetText(command, browser);
      case 'isvisible':
        return await handleIsVisible(command, browser);
      case 'count':
        return await handleCount(command, browser);
      case 'console':
        return await handleConsole(command, browser);
      case 'errors':
        return await handleErrors(command, browser);
      case 'keyboard':
        return await handleKeyboard(command, browser);
      case 'addinitscript':
        return await handleAddInitScript(command, browser);
      case 'react-detect':
        return await handleReactDetect(command, browser);
      case 'components':
        return await handleComponents(command, browser);
      case 'hooks':
        return await handleHooks(command, browser);
      case 'set-state':
        return await handleSetState(command, browser);
      case 'source':
        return await handleSource(command, browser);
      case 'cookies_get':
        return await handleCookiesGet(command, browser);
      case 'cookies_set':
        return await handleCookiesSet(command, browser);
      case 'cookies_clear':
        return await handleCookiesClear(command, browser);
      case 'storage_get':
        return await handleStorageGet(command, browser);
      case 'storage_set':
        return await handleStorageSet(command, browser);
      case 'storage_clear':
        return await handleStorageClear(command, browser);
      case 'state_save':
        return await handleStateSave(command, browser);
      case 'state_load':
        return handleStateLoad(command);
      default: {
        const unknownCommand = command as { id: string; action: string };
        return errorResponse(unknownCommand.id, `Unknown action: ${unknownCommand.action}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleLaunch(
  command: Command & { action: 'launch' },
  browser: BrowserManager
): Promise<Response> {
  await browser.launch(command);
  return successResponse(command.id, { launched: true });
}

async function handleNavigate(
  command: NavigateCommand,
  browser: BrowserManager
): Promise<Response<NavigateData>> {
  const page = browser.getPage();

  await page.goto(command.url, {
    waitUntil: command.waitUntil ?? 'load',
  });

  return successResponse(command.id, {
    url: page.url(),
    title: await page.title(),
  });
}

async function handleClick(command: ClickCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();

  await page.locator(command.selector).click({
    button: command.button,
    clickCount: command.clickCount,
    delay: command.delay,
  });

  return successResponse(command.id, { clicked: true });
}

async function handleType(command: TypeCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();
  const locator = page.locator(command.selector);

  if (command.clear) {
    await locator.fill('');
  }

  await locator.pressSequentially(command.text, {
    delay: command.delay,
  });

  return successResponse(command.id, { typed: true });
}

async function handleFill(command: FillCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();
  await page.locator(command.selector).fill(command.value);
  return successResponse(command.id, { filled: true });
}

async function handlePress(command: PressCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();

  if (command.selector) {
    await page.press(command.selector, command.key);
  } else {
    await page.keyboard.press(command.key);
  }

  return successResponse(command.id, { pressed: true });
}

async function handleScreenshot(
  command: ScreenshotCommand,
  browser: BrowserManager
): Promise<Response<ScreenshotData>> {
  const page = browser.getPage();

  const options: Parameters<Page['screenshot']>[0] = {
    fullPage: command.fullPage,
    type: command.format ?? 'png',
  };

  if (command.format === 'jpeg' && command.quality !== undefined) {
    options.quality = command.quality;
  }

  let target: Page | ReturnType<Page['locator']> = page;
  if (command.selector) {
    target = page.locator(command.selector);
  }

  if (command.path) {
    await target.screenshot({ ...options, path: command.path });
    return successResponse(command.id, { path: command.path });
  } else {
    const buffer = await target.screenshot(options);
    return successResponse(command.id, { base64: buffer.toString('base64') });
  }
}

async function handleSnapshot(
  command: Command & { action: 'snapshot' },
  browser: BrowserManager
): Promise<Response> {
  // Basic DOM snapshot via aria - no agent-browser RefMap system
  const page = browser.getPage();
  const snapshot = await page.evaluate(() => {
    const walk = (el: Element, depth: number): string => {
      const indent = '  '.repeat(depth);
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const name = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? (el.childNodes[0].textContent || '').trim().slice(0, 80)
        : '';
      let line = `${indent}${role}`;
      if (name) line += ` "${name}"`;
      if (text) line += ` "${text}"`;
      const children = Array.from(el.children).map(c => walk(c, depth + 1)).filter(Boolean);
      if (children.length > 0) {
        return line + '\n' + children.join('\n');
      }
      return line;
    };
    return document.body ? walk(document.body, 0) : 'Empty page';
  });
  return successResponse(command.id, { snapshot });
}

async function handleEvaluate(
  command: EvaluateCommand,
  browser: BrowserManager
): Promise<Response<EvaluateData>> {
  const page = browser.getPage();
  const result = await page.evaluate(command.script);
  return successResponse(command.id, { result });
}

async function handleWait(command: WaitCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();

  if (command.selector) {
    await page.waitForSelector(command.selector, {
      state: command.state ?? 'visible',
      timeout: command.timeout,
    });
  } else if (command.timeout) {
    await page.waitForTimeout(command.timeout);
  } else {
    await page.waitForLoadState('load');
  }

  return successResponse(command.id, { waited: true });
}

async function handleScroll(command: ScrollCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();

  if (command.selector) {
    const element = page.locator(command.selector);
    await element.scrollIntoViewIfNeeded();

    if (command.x !== undefined || command.y !== undefined) {
      await element.evaluate(
        (el, { x, y }) => {
          el.scrollBy(x ?? 0, y ?? 0);
        },
        { x: command.x, y: command.y }
      );
    }
  } else {
    let deltaX = command.x ?? 0;
    let deltaY = command.y ?? 0;

    if (command.direction) {
      const amount = command.amount ?? 100;
      switch (command.direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }
    }

    await page.evaluate(`window.scrollBy(${deltaX}, ${deltaY})`);
  }

  return successResponse(command.id, { scrolled: true });
}

async function handleHover(command: HoverCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();
  await page.locator(command.selector).hover();
  return successResponse(command.id, { hovered: true });
}

async function handleContent(
  command: ContentCommand,
  browser: BrowserManager
): Promise<Response<ContentData>> {
  const page = browser.getPage();

  let html: string;
  if (command.selector) {
    html = await page.locator(command.selector).innerHTML();
  } else {
    html = await page.content();
  }

  return successResponse(command.id, { html });
}

async function handleClose(
  command: Command & { action: 'close' },
  browser: BrowserManager
): Promise<Response> {
  await browser.close();
  return successResponse(command.id, { closed: true });
}

async function handleBack(
  command: Command & { action: 'back' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.goBack();
  return successResponse(command.id, { url: page.url() });
}

async function handleForward(
  command: Command & { action: 'forward' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.goForward();
  return successResponse(command.id, { url: page.url() });
}

async function handleReload(
  command: Command & { action: 'reload' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.reload();
  return successResponse(command.id, { url: page.url() });
}

async function handleUrl(
  command: Command & { action: 'url' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  return successResponse(command.id, { url: page.url() });
}

async function handleTitle(
  command: Command & { action: 'title' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const title = await page.title();
  return successResponse(command.id, { title });
}

async function handleGetAttribute(
  command: GetAttributeCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const value = await page.locator(command.selector).getAttribute(command.attribute);
  return successResponse(command.id, { attribute: command.attribute, value });
}

async function handleGetText(command: GetTextCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();
  const text = await page.locator(command.selector).textContent();
  return successResponse(command.id, { text });
}

async function handleIsVisible(
  command: IsVisibleCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const visible = await page.locator(command.selector).isVisible();
  return successResponse(command.id, { visible });
}

async function handleCount(command: CountCommand, browser: BrowserManager): Promise<Response> {
  const page = browser.getPage();
  const count = await page.locator(command.selector).count();
  return successResponse(command.id, { count });
}

async function handleConsole(command: ConsoleCommand, browser: BrowserManager): Promise<Response> {
  if (command.clear) {
    browser.clearConsoleMessages();
    return successResponse(command.id, { cleared: true });
  }

  const messages = browser.getConsoleMessages();
  return successResponse(command.id, { messages });
}

async function handleErrors(command: ErrorsCommand, browser: BrowserManager): Promise<Response> {
  if (command.clear) {
    browser.clearPageErrors();
    return successResponse(command.id, { cleared: true });
  }

  const errors = browser.getPageErrors();
  return successResponse(command.id, { errors });
}

async function handleKeyboard(
  command: KeyboardCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.keyboard.press(command.keys);
  return successResponse(command.id, { pressed: command.keys });
}

async function handleAddInitScript(
  command: AddInitScriptCommand,
  browser: BrowserManager
): Promise<Response> {
  await browser.addInitScript(command.script);
  return successResponse(command.id, { added: true });
}

async function handleReactDetect(
  command: ReactDetectCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const result = await page.evaluate(() => {
    const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || !hook._debugBrowser) {
      return { detected: false, version: null, rendererCount: 0 };
    }
    return {
      detected: hook._debugBrowser.detected,
      version: hook._debugBrowser.version,
      rendererCount: hook._debugBrowser.rendererCount,
    };
  });
  return successResponse(command.id, result);
}

async function handleComponents(
  command: ComponentsCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();

  const isCompact = command.compact ?? false;
  const options = {
    depth: command.depth ?? 100,
    includeHost: command.includeHost ?? false,
    includeProps: isCompact ? false : (command.includeProps ?? true),
    includeState: isCompact ? false : (command.includeState ?? true),
    propsDepth: command.propsDepth ?? 3,
  };

  // The script is an IIFE-style function expression; we call it with options
  const result = await page.evaluate(
    `(${COMPONENT_TREE_SCRIPT})(${JSON.stringify(options)})`
  );

  return successResponse(command.id, result);
}

async function handleHooks(
  command: HooksCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();

  const options = {
    component: command.component,
    depth: command.depth ?? 3,
  };

  const result = await page.evaluate(
    `(${HOOKS_SCRIPT})(${JSON.stringify(options)})`
  );

  return successResponse(command.id, result);
}

async function handleSetState(
  command: SetStateCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();

  const options = {
    component: command.component,
    hookIndex: command.hookIndex,
    value: command.value,
  };

  const result = await page.evaluate(
    `(${SET_STATE_SCRIPT})(${JSON.stringify(options)})`
  );

  return successResponse(command.id, result);
}

async function handleSource(
  command: SourceCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();

  const options = {
    component: command.component,
  };

  const result = await page.evaluate(
    `(${SOURCE_SCRIPT})(${JSON.stringify(options)})`
  );

  return successResponse(command.id, result);
}

async function handleCookiesGet(
  command: CookiesGetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  const cookies = await context.cookies(command.urls);
  return successResponse(command.id, { cookies });
}

async function handleCookiesSet(
  command: CookiesSetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  // Auto-fill URL for cookies that don't have domain/path/url set
  const pageUrl = page.url();
  const cookies = command.cookies.map((cookie) => {
    if (!cookie.url && !cookie.domain && !cookie.path) {
      return { ...cookie, url: pageUrl };
    }
    return cookie;
  });
  await context.addCookies(cookies);
  return successResponse(command.id, { set: true });
}

async function handleCookiesClear(
  command: Command & { action: 'cookies_clear' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  await context.clearCookies();
  return successResponse(command.id, { cleared: true });
}

async function handleStorageGet(
  command: StorageGetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';

  if (command.key) {
    const value = await page.evaluate(`${storageType}.getItem(${JSON.stringify(command.key)})`);
    return successResponse(command.id, { key: command.key, value });
  } else {
    const data = await page.evaluate(`
      (() => {
        const storage = ${storageType};
        const result = {};
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) result[key] = storage.getItem(key);
        }
        return result;
      })()
    `);
    return successResponse(command.id, { data });
  }
}

async function handleStorageSet(
  command: StorageSetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';

  await page.evaluate(
    `${storageType}.setItem(${JSON.stringify(command.key)}, ${JSON.stringify(command.value)})`
  );
  return successResponse(command.id, { set: true });
}

async function handleStorageClear(
  command: StorageClearCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';

  await page.evaluate(`${storageType}.clear()`);
  return successResponse(command.id, { cleared: true });
}

async function handleStateSave(
  command: StateSaveCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.context().storageState({ path: command.path });
  return successResponse(command.id, { saved: command.path });
}

function handleStateLoad(
  command: Command & { action: 'state_load' }
): Response {
  return errorResponse(
    command.id,
    'Storage state must be loaded at launch. Use: debug-browser --state <path> navigate <url>'
  );
}
