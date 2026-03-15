import { z } from 'zod';
import type { Command, Response } from './types.js';

// Base schema for all commands
const baseCommandSchema = z.object({
  id: z.string(),
  action: z.string(),
});

// Individual action schemas
const launchSchema = baseCommandSchema.extend({
  action: z.literal('launch'),
  headless: z.boolean().optional(),
  viewport: z
    .object({
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  executablePath: z.string().optional(),
  args: z.array(z.string()).optional(),
  cdpUrl: z.string().optional(),
  cdpPort: z.number().positive().optional(),
  storageState: z.string().optional(),
  profile: z.string().optional(),
});

const navigateSchema = baseCommandSchema.extend({
  action: z.literal('navigate'),
  url: z.string().min(1),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
});

const clickSchema = baseCommandSchema.extend({
  action: z.literal('click'),
  selector: z.string().min(1),
  button: z.enum(['left', 'right', 'middle']).optional(),
  clickCount: z.number().positive().optional(),
  delay: z.number().nonnegative().optional(),
});

const typeSchema = baseCommandSchema.extend({
  action: z.literal('type'),
  selector: z.string().min(1),
  text: z.string(),
  delay: z.number().nonnegative().optional(),
  clear: z.boolean().optional(),
});

const fillSchema = baseCommandSchema.extend({
  action: z.literal('fill'),
  selector: z.string().min(1),
  value: z.string(),
});

const evaluateSchema = baseCommandSchema.extend({
  action: z.literal('evaluate'),
  script: z.string().min(1),
  args: z.array(z.unknown()).optional(),
});

const consoleSchema = baseCommandSchema.extend({
  action: z.literal('console'),
  clear: z.boolean().optional(),
});

const errorsSchema = baseCommandSchema.extend({
  action: z.literal('errors'),
  clear: z.boolean().optional(),
});

const closeSchema = baseCommandSchema.extend({
  action: z.literal('close'),
});

const waitSchema = baseCommandSchema.extend({
  action: z.literal('wait'),
  selector: z.string().min(1).optional(),
  timeout: z.number().positive().optional(),
  state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional(),
});

const scrollSchema = baseCommandSchema.extend({
  action: z.literal('scroll'),
  selector: z.string().min(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  amount: z.number().positive().optional(),
});

const hoverSchema = baseCommandSchema.extend({
  action: z.literal('hover'),
  selector: z.string().min(1),
});

const contentSchema = baseCommandSchema.extend({
  action: z.literal('content'),
  selector: z.string().min(1).optional(),
});

const addInitScriptSchema = baseCommandSchema.extend({
  action: z.literal('addinitscript'),
  script: z.string().min(1),
});

const backSchema = baseCommandSchema.extend({
  action: z.literal('back'),
});

const forwardSchema = baseCommandSchema.extend({
  action: z.literal('forward'),
});

const reloadSchema = baseCommandSchema.extend({
  action: z.literal('reload'),
});

const urlSchema = baseCommandSchema.extend({
  action: z.literal('url'),
});

const titleSchema = baseCommandSchema.extend({
  action: z.literal('title'),
});

const getTextSchema = baseCommandSchema.extend({
  action: z.literal('gettext'),
  selector: z.string().min(1),
});

const getAttributeSchema = baseCommandSchema.extend({
  action: z.literal('getattribute'),
  selector: z.string().min(1),
  attribute: z.string().min(1),
});

const screenshotSchema = baseCommandSchema.extend({
  action: z.literal('screenshot'),
  path: z.string().nullable().optional(),
  fullPage: z.boolean().optional(),
  selector: z.string().min(1).nullish(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
});

const snapshotSchema = baseCommandSchema.extend({
  action: z.literal('snapshot'),
});

const isVisibleSchema = baseCommandSchema.extend({
  action: z.literal('isvisible'),
  selector: z.string().min(1),
});

const countSchema = baseCommandSchema.extend({
  action: z.literal('count'),
  selector: z.string().min(1),
});

const keyboardSchema = baseCommandSchema.extend({
  action: z.literal('keyboard'),
  keys: z.string().min(1),
});

const pressSchema = baseCommandSchema.extend({
  action: z.literal('press'),
  key: z.string().min(1),
  selector: z.string().min(1).optional(),
});

const reactDetectSchema = baseCommandSchema.extend({
  action: z.literal('react-detect'),
});

const componentsSchema = baseCommandSchema.extend({
  action: z.literal('components'),
  depth: z.number().positive().optional(),
  includeHost: z.boolean().optional(),
  includeProps: z.boolean().optional(),
  includeState: z.boolean().optional(),
  propsDepth: z.number().positive().optional(),
  compact: z.boolean().optional(),
});

const hooksSchema = baseCommandSchema.extend({
  action: z.literal('hooks'),
  component: z.string().min(1),
  depth: z.number().positive().optional(),
  compact: z.boolean().optional(),
});

const setStateSchema = baseCommandSchema.extend({
  action: z.literal('set-state'),
  component: z.string().min(1),
  hookIndex: z.number().int().nonnegative(),
  value: z.unknown(),
});

const sourceSchema = baseCommandSchema.extend({
  action: z.literal('source'),
  component: z.string().min(1),
});

const inspectSchema = baseCommandSchema.extend({
  action: z.literal('inspect'),
  selector: z.string().min(1),
  includeHooks: z.boolean().optional(),
  depth: z.number().positive().optional(),
});

const cookiesGetSchema = baseCommandSchema.extend({
  action: z.literal('cookies_get'),
  urls: z.array(z.string()).optional(),
});

const cookiesSetSchema = baseCommandSchema.extend({
  action: z.literal('cookies_set'),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      url: z.string().optional(),
      domain: z.string().optional(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    })
  ),
});

const cookiesClearSchema = baseCommandSchema.extend({
  action: z.literal('cookies_clear'),
});

const storageGetSchema = baseCommandSchema.extend({
  action: z.literal('storage_get'),
  key: z.string().optional(),
  type: z.enum(['local', 'session']),
});

const storageSetSchema = baseCommandSchema.extend({
  action: z.literal('storage_set'),
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(['local', 'session']),
});

const storageClearSchema = baseCommandSchema.extend({
  action: z.literal('storage_clear'),
  type: z.enum(['local', 'session']),
});

const stateSaveSchema = baseCommandSchema.extend({
  action: z.literal('state_save'),
  path: z.string().min(1),
});

const stateLoadSchema = baseCommandSchema.extend({
  action: z.literal('state_load'),
});

// Union schema for all commands
const commandSchema = z.discriminatedUnion('action', [
  launchSchema,
  navigateSchema,
  clickSchema,
  typeSchema,
  fillSchema,
  evaluateSchema,
  consoleSchema,
  errorsSchema,
  closeSchema,
  waitSchema,
  scrollSchema,
  hoverSchema,
  contentSchema,
  addInitScriptSchema,
  backSchema,
  forwardSchema,
  reloadSchema,
  urlSchema,
  titleSchema,
  getTextSchema,
  getAttributeSchema,
  screenshotSchema,
  snapshotSchema,
  isVisibleSchema,
  countSchema,
  keyboardSchema,
  pressSchema,
  reactDetectSchema,
  componentsSchema,
  hooksSchema,
  setStateSchema,
  sourceSchema,
  inspectSchema,
  cookiesGetSchema,
  cookiesSetSchema,
  cookiesClearSchema,
  storageGetSchema,
  storageSetSchema,
  storageClearSchema,
  stateSaveSchema,
  stateLoadSchema,
]);

// Parse result type
export type ParseResult =
  | { success: true; command: Command }
  | { success: false; error: string; id?: string };

/**
 * Parse a JSON string into a validated command
 */
export function parseCommand(input: string): ParseResult {
  // First, try to parse JSON
  let json: unknown;
  try {
    json = JSON.parse(input);
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }

  // Extract id for error responses if possible
  const id =
    typeof json === 'object' && json !== null && 'id' in json
      ? String((json as { id: unknown }).id)
      : undefined;

  // Validate against schema
  const result = commandSchema.safeParse(json);

  if (!result.success) {
    const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: `Validation error: ${errors}`, id };
  }

  return { success: true, command: result.data as Command };
}

/**
 * Create a success response
 */
export function successResponse<T>(id: string, data: T): Response<T> {
  return { id, success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(id: string, error: string): Response {
  return { id, success: false, error };
}

/**
 * Serialize a response to JSON string
 */
export function serializeResponse(response: Response): string {
  return JSON.stringify(response);
}
