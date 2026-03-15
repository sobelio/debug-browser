import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright-core';
import type { LaunchCommand } from './types.js';

interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

interface PageError {
  message: string;
  timestamp: number;
}

/**
 * Manages the Playwright browser lifecycle.
 * Simplified from agent-browser: single page, no CDP/screencast/recording.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleMessages: ConsoleMessage[] = [];
  private pageErrors: PageError[] = [];

  /**
   * Check if browser is launched
   */
  isLaunched(): boolean {
    return this.browser !== null;
  }

  /**
   * Get the current active page, throws if not launched
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch first.');
    }
    return this.page;
  }

  /**
   * Launch the browser with the specified options.
   * If already launched, this is a no-op.
   *
   * Supports three modes:
   * 1. cdpUrl provided: connect to existing Chrome via CDP URL
   * 2. cdpPort provided: connect to existing Chrome via CDP on localhost:port
   * 3. Neither: launch a new headless Chrome instance
   */
  async launch(options: LaunchCommand): Promise<void> {
    if (this.isLaunched()) {
      return;
    }

    const viewport = options.viewport ?? { width: 1280, height: 720 };

    // Determine CDP endpoint: prefer cdpUrl over cdpPort
    const cdpEndpoint = options.cdpUrl ?? (options.cdpPort ? String(options.cdpPort) : undefined);

    if (cdpEndpoint) {
      // Connect to existing Chrome via CDP
      let cdpUrl: string;
      if (
        cdpEndpoint.startsWith('ws://') ||
        cdpEndpoint.startsWith('wss://') ||
        cdpEndpoint.startsWith('http://') ||
        cdpEndpoint.startsWith('https://')
      ) {
        cdpUrl = cdpEndpoint;
      } else {
        // Numeric port or unknown format — treat as localhost port
        cdpUrl = `http://localhost:${cdpEndpoint}`;
      }

      this.browser = await chromium.connectOverCDP(cdpUrl).catch(() => {
        throw new Error(
          `Failed to connect via CDP to ${cdpUrl}. ` +
            (cdpUrl.includes('localhost')
              ? `Make sure Chrome is running with --remote-debugging-port=${cdpEndpoint}`
              : 'Make sure the remote browser is accessible and the URL is correct.')
        );
      });

      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        this.context = contexts[0];
        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      } else {
        this.context = await this.browser.newContext({ viewport });
        this.page = await this.context.newPage();
      }
    } else {
      // Launch a new browser instance
      this.browser = await chromium.launch({
        headless: options.headless ?? true,
        executablePath: options.executablePath,
        args: options.args,
      });

      this.context = await this.browser.newContext({
        viewport,
      });

      this.page = this.context.pages()[0] ?? (await this.context.newPage());
    }

    this.context!.setDefaultTimeout(60000);
    this.setupPageTracking(this.page);
  }

  /**
   * Set up console, error, and close tracking for a page
   */
  private setupPageTracking(page: Page): void {
    page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });

    page.on('pageerror', (error) => {
      this.pageErrors.push({
        message: error.message,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Navigate the current page to a URL
   */
  async navigateTo(url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void> {
    const page = this.getPage();
    await page.goto(url, {
      waitUntil: waitUntil ?? 'load',
    });
  }

  /**
   * Evaluate a JavaScript expression on the current page
   */
  async evaluateScript(script: string): Promise<unknown> {
    const page = this.getPage();
    return await page.evaluate(script);
  }

  /**
   * Add an init script that runs on every navigation
   */
  async addInitScript(script: string): Promise<void> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch first.');
    }
    await this.context.addInitScript(script);
  }

  /**
   * Get captured console messages
   */
  getConsoleMessages(clear?: boolean): ConsoleMessage[] {
    const messages = [...this.consoleMessages];
    if (clear) {
      this.consoleMessages = [];
    }
    return messages;
  }

  /**
   * Clear console messages
   */
  clearConsoleMessages(): void {
    this.consoleMessages = [];
  }

  /**
   * Get captured page errors
   */
  getPageErrors(clear?: boolean): PageError[] {
    const errors = [...this.pageErrors];
    if (clear) {
      this.pageErrors = [];
    }
    return errors;
  }

  /**
   * Clear page errors
   */
  clearPageErrors(): void {
    this.pageErrors = [];
  }

  /**
   * Get current page URL
   */
  getCurrentUrl(): string {
    return this.getPage().url();
  }

  /**
   * Get current page title
   */
  async getTitle(): Promise<string> {
    return await this.getPage().title();
  }

  /**
   * Close the browser and clean up
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }

    this.page = null;
    this.context = null;
    this.browser = null;
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}
