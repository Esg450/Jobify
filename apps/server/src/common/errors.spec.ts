import { describe, expect, it } from 'vitest';
import { describeFetchError } from './errors.js';

describe('describeFetchError', () => {
  it('includes the underlying network error code', () => {
    const error = new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
    expect(describeFetchError(error)).toBe('fetch failed (ENOTFOUND)');
  });

  it('explains timeouts', () => {
    expect(describeFetchError(new DOMException('aborted', 'TimeoutError'))).toBe(
      'the request timed out',
    );
  });
});
