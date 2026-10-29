import { gsap } from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeMotion } from './RuntimeMotion';
import { TWEEN_TIMEOUT_SAFETY_MS } from './tweenLifetime';

/** Промисы резолвятся микротасками: дать им отработать. */
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const track = (promise: Promise<void>) => {
  const state = { done: false };

  void promise.then(() => {
    state.done = true;
  });

  return state;
};

describe('RuntimeMotion', () => {
  let motion: RuntimeMotion;

  afterEach(() => {
    motion.destroy();
  });

  it('двигает твин только по своим часам', async () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };
    const done = track(motion.tween(target, { x: 10 }, { duration: 100, ease: 'Linear' }));

    motion.update(50);
    expect(target.x).toBeCloseTo(5);

    await flush();
    expect(done.done).toBe(false);

    motion.update(60);
    await flush();
    expect(target.x).toBe(10);
    expect(done.done).toBe(true);
  });

  it('ставит твин на текущее время часов, а не в начало таймлайна', async () => {
    motion = new RuntimeMotion();
    motion.update(5000);

    const target = { x: 0 };

    void motion.tween(target, { x: 10 }, { duration: 100, ease: 'Linear', delay: 100 });
    motion.update(150);

    expect(target.x).toBeCloseTo(5);
  });

  it('timeScale ускоряет твины и задержки вместе', async () => {
    motion = new RuntimeMotion();
    motion.setTimeScale(2);

    const target = { x: 0 };
    const tween = track(motion.tween(target, { x: 10 }, { duration: 100, ease: 'Linear' }));
    const delay = track(motion.delay(100));

    motion.update(55);
    await flush();

    expect(target.x).toBe(10);
    expect(tween.done).toBe(true);
    expect(delay.done).toBe(true);
  });

  it('на паузе часы стоят', async () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };

    void motion.tween(target, { x: 10 }, { duration: 100, ease: 'Linear' });
    motion.pause();
    motion.update(500);
    expect(target.x).toBe(0);

    motion.resume();
    motion.update(50);
    expect(target.x).toBeCloseTo(5);
  });

  it('остановленный твин резолвит промис', async () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };
    const done = track(motion.tween(target, { x: 10 }, { duration: 1000 }));

    motion.update(10);
    motion.killTweensOf(target);
    await flush();

    expect(done.done).toBe(true);
  });

  it('страховочный таймер резолвит промис, если конец не пришёл', async () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };
    const done = track(motion.tween(target, { x: 10 }, { duration: 100 }));

    // Конец твина потерян: твин вынут из таймлайна без единого события, как
    // при сносе менеджера твинов целиком.
    const [lost] = gsap.getTweensOf(target);

    lost.parent?.remove(lost);

    motion.update(100 + TWEEN_TIMEOUT_SAFETY_MS - 10);
    await flush();
    expect(done.done).toBe(false);

    motion.update(20);
    await flush();
    expect(done.done).toBe(true);
    expect(target.x).toBe(0);
  });

  it('без живых целей твин не запускается и резолвится сразу', async () => {
    motion = new RuntimeMotion();
    const done = track(motion.tween(null, { x: 1 }));
    const doneList = track(motion.tween([null, undefined], { x: 1 }));

    await flush();
    expect(done.done).toBe(true);
    expect(doneList.done).toBe(true);
  });

  it('yoyo с повтором - туда-обратно на каждый повтор, как у эталона', () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };

    void motion.tween(target, { x: 10 }, { duration: 100, ease: 'Linear', yoyo: true, repeat: 1 });

    motion.update(100);
    expect(target.x).toBeCloseTo(10);
    motion.update(100);
    expect(target.x).toBeCloseTo(0);
    motion.update(100);
    expect(target.x).toBeCloseTo(10);
    motion.update(100);
    expect(target.x).toBeCloseTo(0);
  });

  it('на уничтожении промисы не резолвятся, а новые твины не стартуют', async () => {
    motion = new RuntimeMotion();
    const target = { x: 0 };
    const tween = track(motion.tween(target, { x: 10 }, { duration: 100 }));
    const delay = track(motion.delay(50));

    motion.destroy();
    motion.update(1000);
    await flush();

    expect(tween.done).toBe(false);
    expect(delay.done).toBe(false);
    expect(target.x).toBe(0);
  });
  it('onFrame получает время кадра с темпом, стоит на паузе и снимается', () => {
    motion = new RuntimeMotion();
    const frames: number[] = [];
    const off = motion.onFrame((deltaMs) => frames.push(deltaMs));

    motion.update(16);
    motion.setTimeScale(2);
    motion.update(10);
    motion.pause();
    motion.update(10);
    motion.resume();
    off();
    motion.update(10);

    expect(frames).toEqual([16, 20]);
  });

  it('onFrame без темпа получает реальное время кадра, но стоит на паузе', () => {
    motion = new RuntimeMotion();
    const frames: number[] = [];

    motion.onFrame((deltaMs) => frames.push(deltaMs), { timeScale: 'ignore' });
    motion.setTimeScale(1.7);
    motion.update(10);
    motion.pause();
    motion.update(10);
    motion.resume();
    motion.update(16);

    expect(frames).toEqual([10, 16]);
  });

  it('onFrame молчит после уничтожения часов', () => {
    motion = new RuntimeMotion();
    const frames: number[] = [];

    motion.onFrame((deltaMs) => frames.push(deltaMs));
    motion.destroy();
    motion.update(16);
    motion.onFrame((deltaMs) => frames.push(deltaMs));
    motion.update(16);

    expect(frames).toEqual([]);
  });
});
