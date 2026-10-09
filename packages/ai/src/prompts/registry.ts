import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../hashing.js';
import type { RenderedPrompt } from '../types.js';

/** `packages/ai/prompts`, from both `src/prompts` and `dist/prompts`. */
export const DEFAULT_PROMPTS_DIR = fileURLToPath(new URL('../../prompts/', import.meta.url));

interface PromptFile {
  key: string;
  version: string;
  modelTier: 'default' | 'fast';
  maxTokens: number;
  system: string;
  user: string;
  hash: string;
}

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('Prompt file is missing front matter');
  const meta: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const index = line.indexOf(':');
    if (index > 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { meta, body: match[2] ?? '' };
}

function section(body: string, name: string): string {
  const pattern = new RegExp(`^# ${name}\\n([\\s\\S]*?)(?=^# |$(?![\\s\\S]))`, 'm');
  const value = pattern.exec(body)?.[1]?.trim();
  if (!value) throw new Error(`Prompt file is missing the "# ${name}" section`);
  return value;
}

/**
 * Versioned prompts live in `prompts/<KEY>/vN.md`; `prompts/registry.json`
 * pins the active version of each key. Prompts are reviewed like code: a
 * change is a new file, and its hash is logged with every AI interaction.
 */
export class PromptRegistry {
  private readonly cache = new Map<string, PromptFile>();
  private readonly active: Record<string, string>;

  constructor(private readonly directory: string = DEFAULT_PROMPTS_DIR) {
    this.active = JSON.parse(readFileSync(`${directory}/registry.json`, 'utf8')) as Record<
      string,
      string
    >;
  }

  activeVersion(key: string): string {
    const version = this.active[key];
    if (!version) throw new Error(`No active prompt version for ${key}`);
    return version;
  }

  load(key: string, version = this.activeVersion(key)): PromptFile {
    const cacheKey = `${key}@${version}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const raw = readFileSync(`${this.directory}/${key}/${version}.md`, 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    if (meta.key !== key || meta.version !== version) {
      throw new Error(`Prompt ${cacheKey} front matter does not match its path`);
    }
    const prompt: PromptFile = {
      key,
      version,
      modelTier: meta.modelTier === 'fast' ? 'fast' : 'default',
      maxTokens: Number(meta.maxTokens ?? 2000),
      system: section(body, 'System'),
      user: section(body, 'User'),
      hash: sha256Hex(raw),
    };
    this.cache.set(cacheKey, prompt);
    return prompt;
  }

  /** Fills `{{name}}` slots in the user template. Unknown slots are an error. */
  render(key: string, variables: Record<string, string>): RenderedPrompt {
    const prompt = this.load(key);
    const user = prompt.user.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
      const value = variables[name];
      if (value === undefined) throw new Error(`Prompt ${key} needs a value for {{${name}}}`);
      return value;
    });
    return {
      key,
      version: prompt.version,
      hash: prompt.hash,
      system: prompt.system,
      user,
      maxTokens: prompt.maxTokens,
      modelTier: prompt.modelTier,
    };
  }
}
