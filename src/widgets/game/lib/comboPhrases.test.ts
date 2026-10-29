import { describe, expect, it } from 'vitest';

import { pickNextComboPhrase, shouldShowComboPhrase } from './comboPhrases';

describe('pickNextComboPhrase', () => {
  it('никогда не повторяет прошлую фразу, если в пуле есть другие', () => {
    const pool = ['a', 'b', 'c'];

    for (let seed = 0; seed < pool.length; seed++) {
      const random = () => seed / pool.length;

      expect(pickNextComboPhrase(pool, 'a', random)).not.toBe('a');
    }
  });

  it('на пуле из одного элемента возвращает его же', () => {
    expect(pickNextComboPhrase(['solo'], 'solo', () => 0)).toBe('solo');
  });

  it('без прошлой фразы выбирает из всего пула', () => {
    expect(pickNextComboPhrase(['a', 'b'], null, () => 0)).toBe('a');
    expect(pickNextComboPhrase(['a', 'b'], null, () => 0.9)).toBe('b');
  });
});

describe('shouldShowComboPhrase', () => {
  it('не показывает раньше порога итерации', () => {
    expect(shouldShowComboPhrase(1, 2, 1000, null, () => 0)).toBe(false);
  });

  it('без кулдауна решает вероятностным роллом', () => {
    expect(shouldShowComboPhrase(2, 2, 1000, null, () => 0)).toBe(true);
    expect(shouldShowComboPhrase(2, 2, 1000, null, () => 0.999)).toBe(false);
  });

  it('держит кулдаун от прошлого показа независимо от ролла', () => {
    expect(shouldShowComboPhrase(3, 2, 1000, 900, () => 0)).toBe(false);
  });

  it('пускает снова, когда кулдаун истёк', () => {
    expect(shouldShowComboPhrase(3, 2, 5000, 900, () => 0)).toBe(true);
  });
});
