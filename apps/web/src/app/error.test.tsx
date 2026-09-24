import { describe, expect, it, vi } from 'vitest';

import { ERROR_DIGEST_PREFIX, RETRY_LABEL } from '@/lib/error-notice';

import AppError from './error';

/** Every string in the returned element tree, concatenated. No DOM: this app has no renderer. */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join('');
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return '';
}

/** Every element in the tree, so a test can find the one carrying a handler. */
function* elements(node: unknown): Generator<{ props: Record<string, unknown> }> {
  if (Array.isArray(node)) {
    for (const child of node) {
      yield* elements(child);
    }
    return;
  }
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const element = node as { props: Record<string, unknown> };
    yield element;
    yield* elements(element.props.children);
  }
}

function errorWith(digest?: string): Error & { digest?: string } {
  return Object.assign(new Error('a server-side exception has occurred'), { digest });
}

describe('AppError', () => {
  it('renders the digest verbatim, so the reader can quote it against the logs', () => {
    const tree = AppError({ error: errorWith('3619938306'), reset: () => undefined });

    expect(textOf(tree)).toContain('3619938306');
    expect(textOf(tree)).toContain(ERROR_DIGEST_PREFIX);
  });

  it('drops the Reference line when the error carries no digest', () => {
    const tree = AppError({ error: errorWith(undefined), reset: () => undefined });

    expect(textOf(tree)).not.toContain(ERROR_DIGEST_PREFIX);
  });

  it('never leaks the thrown message, which Next.js strips in production anyway', () => {
    const tree = AppError({ error: errorWith('3619938306'), reset: () => undefined });

    expect(textOf(tree)).not.toContain('a server-side exception has occurred');
  });

  it('wires the retry control to reset, so the boundary can actually recover', () => {
    const reset = vi.fn();

    const tree = AppError({ error: errorWith('3619938306'), reset });
    const retry = [...elements(tree)].find((element) => element.props.onClick !== undefined);
    (retry?.props.onClick as (() => void) | undefined)?.();

    expect(textOf(retry)).toBe(RETRY_LABEL);
    expect(reset).toHaveBeenCalledOnce();
  });
});
