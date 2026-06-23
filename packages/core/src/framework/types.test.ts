import { describe, it, expect } from 'vitest';
import { FRAMEWORKS } from './types';

describe('framework types', () => {
  it('lists the three v1 frameworks in a stable order', () => {
    expect(FRAMEWORKS).toEqual(['playwright', 'cypress', 'selenium']);
  });
});
