import { describe, expect, it } from 'vitest';
import {
  describeLevelColors,
  parseGridSizeInput,
  settleGridSizeInput,
  toggleLevelColor,
} from './levelConfigBasics';

describe('parseGridSizeInput', () => {
  it('applies an integer within the limits right away', () => {
    expect(parseGridSizeInput('3')).toBe(3);
    expect(parseGridSizeInput(' 9 ')).toBe(9);
  });

  it('leaves the size alone on intermediate input', () => {
    // Стёртое поле и первая цифра числа вне границ не должны обрезать поле.
    expect(parseGridSizeInput('')).toBeNull();
    expect(parseGridSizeInput('1')).toBeNull();
    expect(parseGridSizeInput('12')).toBeNull();
    expect(parseGridSizeInput('6.5')).toBeNull();
    expect(parseGridSizeInput('abc')).toBeNull();
  });
});

describe('settleGridSizeInput', () => {
  it('clamps a number to the limits when the field is left', () => {
    expect(settleGridSizeInput('1')).toBe(3);
    expect(settleGridSizeInput('12')).toBe(9);
    expect(settleGridSizeInput('7.8')).toBe(7);
  });

  it('keeps the current size for an empty or non-numeric field', () => {
    expect(settleGridSizeInput('')).toBeNull();
    expect(settleGridSizeInput('  ')).toBeNull();
    expect(settleGridSizeInput('abc')).toBeNull();
  });
});

describe('toggleLevelColor', () => {
  it('turns a color off and on keeping the canonical order', () => {
    expect(toggleLevelColor(['yellow', 'red', 'blue'], 'red')).toEqual(['yellow', 'blue']);
    expect(toggleLevelColor(['blue', 'yellow'], 'red')).toEqual(['yellow', 'red', 'blue']);
  });
});

describe('describeLevelColors', () => {
  it('asks for missing colors and warns about the two-color edge case', () => {
    expect(describeLevelColors(1).missingColors).toBe(1);
    expect(describeLevelColors(1).hint).toMatch(/^Включите ещё 1 цвет:/);
    expect(describeLevelColors(2)).toMatchObject({
      missingColors: 0,
      hint: expect.stringMatching(/крайний случай/),
    });
    expect(describeLevelColors(4).hint).toMatch(/^Какие фишки есть на уровне/);
  });
});
