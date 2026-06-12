import { describe, it, expect } from 'vitest';
import * as core from '../index';

describe('@argus/core behavior exports', () => {
  it('exposes generate + specPathForUrl + triage', () => {
    expect('generate' in core).toBe(true);
    expect('specPathForUrl' in core).toBe(true);
    expect('triage' in core).toBe(true);
    expect('extractFailures' in core).toBe(true);
  });
});
