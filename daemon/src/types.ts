// Base command structure
export interface BaseCommand {
  id: string;
  action: string;
}

// Action-specific command types
export interface LaunchCommand extends BaseCommand {
  action: 'launch';
  headless?: boolean;
  viewport?: { width: number; height: number };
  executablePath?: string;
  args?: string[];
  cdpUrl?: string;
  cdpPort?: number;
}

export interface NavigateCommand extends BaseCommand {
  action: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ClickCommand extends BaseCommand {
  action: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface TypeCommand extends BaseCommand {
  action: 'type';
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface FillCommand extends BaseCommand {
  action: 'fill';
  selector: string;
  value: string;
}

export interface EvaluateCommand extends BaseCommand {
  action: 'evaluate';
  script: string;
  args?: unknown[];
}

export interface ConsoleCommand extends BaseCommand {
  action: 'console';
  clear?: boolean;
}

export interface ErrorsCommand extends BaseCommand {
  action: 'errors';
  clear?: boolean;
}

export interface CloseCommand extends BaseCommand {
  action: 'close';
}

export interface WaitCommand extends BaseCommand {
  action: 'wait';
  selector?: string;
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface ScrollCommand extends BaseCommand {
  action: 'scroll';
  selector?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface HoverCommand extends BaseCommand {
  action: 'hover';
  selector: string;
}

export interface ContentCommand extends BaseCommand {
  action: 'content';
  selector?: string;
}

export interface AddInitScriptCommand extends BaseCommand {
  action: 'addinitscript';
  script: string;
}

export interface BackCommand extends BaseCommand {
  action: 'back';
}

export interface ForwardCommand extends BaseCommand {
  action: 'forward';
}

export interface ReloadCommand extends BaseCommand {
  action: 'reload';
}

export interface UrlCommand extends BaseCommand {
  action: 'url';
}

export interface TitleCommand extends BaseCommand {
  action: 'title';
}

export interface GetTextCommand extends BaseCommand {
  action: 'gettext';
  selector: string;
}

export interface GetAttributeCommand extends BaseCommand {
  action: 'getattribute';
  selector: string;
  attribute: string;
}

export interface ScreenshotCommand extends BaseCommand {
  action: 'screenshot';
  path?: string;
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface SnapshotCommand extends BaseCommand {
  action: 'snapshot';
}

export interface IsVisibleCommand extends BaseCommand {
  action: 'isvisible';
  selector: string;
}

export interface CountCommand extends BaseCommand {
  action: 'count';
  selector: string;
}

export interface KeyboardCommand extends BaseCommand {
  action: 'keyboard';
  keys: string;
}

export interface PressCommand extends BaseCommand {
  action: 'press';
  key: string;
  selector?: string;
}

export interface ReactDetectCommand extends BaseCommand {
  action: 'react-detect';
}

export interface ComponentsCommand extends BaseCommand {
  action: 'components';
  depth?: number;
  includeHost?: boolean;
  includeProps?: boolean;
  includeState?: boolean;
  propsDepth?: number;
}

export interface HooksCommand extends BaseCommand {
  action: 'hooks';
  component: string;
  depth?: number;
}

export interface CookiesGetCommand extends BaseCommand {
  action: 'cookies_get';
  urls?: string[];
}

export interface CookiesSetCommand extends BaseCommand {
  action: 'cookies_set';
  cookies: Array<{
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
}

export interface CookiesClearCommand extends BaseCommand {
  action: 'cookies_clear';
}

export interface StorageGetCommand extends BaseCommand {
  action: 'storage_get';
  type: 'local' | 'session';
  key?: string;
}

export interface StorageSetCommand extends BaseCommand {
  action: 'storage_set';
  type: 'local' | 'session';
  key: string;
  value: string;
}

export interface StorageClearCommand extends BaseCommand {
  action: 'storage_clear';
  type: 'local' | 'session';
}

// Union of all command types
export type Command =
  | LaunchCommand
  | NavigateCommand
  | ClickCommand
  | TypeCommand
  | FillCommand
  | EvaluateCommand
  | ConsoleCommand
  | ErrorsCommand
  | CloseCommand
  | WaitCommand
  | ScrollCommand
  | HoverCommand
  | ContentCommand
  | AddInitScriptCommand
  | BackCommand
  | ForwardCommand
  | ReloadCommand
  | UrlCommand
  | TitleCommand
  | GetTextCommand
  | GetAttributeCommand
  | ScreenshotCommand
  | SnapshotCommand
  | IsVisibleCommand
  | CountCommand
  | KeyboardCommand
  | PressCommand
  | ReactDetectCommand
  | ComponentsCommand
  | HooksCommand
  | CookiesGetCommand
  | CookiesSetCommand
  | CookiesClearCommand
  | StorageGetCommand
  | StorageSetCommand
  | StorageClearCommand;

// Response types
export interface SuccessResponse<T = unknown> {
  id: string;
  success: true;
  data: T;
}

export interface ErrorResponse {
  id: string;
  success: false;
  error: string;
}

export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Data types for specific responses
export interface NavigateData {
  url: string;
  title: string;
}

export interface ScreenshotData {
  path?: string;
  base64?: string;
}

export interface SnapshotData {
  snapshot: string;
}

export interface EvaluateData {
  result: unknown;
}

export interface ContentData {
  html: string;
}
