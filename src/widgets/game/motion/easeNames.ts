/**
 * Имена кривых твинов: Phaser-имена эталона -> имена GSAP.
 *
 * Темп и характер анимаций переносятся из Phaser-шаблона один в один, и в его
 * коде кривые записаны Phaser-именами (`'Back.easeOut'`, `'Quad.easeIn'`).
 * Таблица держит перевод в одном месте: модуль рантайма пишет кривую так же,
 * как эталон, и не переводит её руками - ошибка в таком переводе
 * (`Quad` -> `power2` вместо `power1`) меняла бы ощущение хода молча.
 *
 * Формулы те же (кривые Пеннера): `Quad` = `power1`, `Cubic` = `power2`,
 * `Quart` = `power3`, `Quint` = `power4`; перелёт `Back` у обоих 1.70158.
 */
const PHASER_FAMILIES: Record<string, string> = {
  Linear: 'none',
  Power0: 'none',
  Quad: 'power1',
  Power1: 'power1',
  Cubic: 'power2',
  Power2: 'power2',
  Quart: 'power3',
  Power3: 'power3',
  Quint: 'power4',
  Power4: 'power4',
  Sine: 'sine',
  Expo: 'expo',
  Circ: 'circ',
  Back: 'back',
  Bounce: 'bounce',
  Elastic: 'elastic',
};

const PHASER_DIRECTIONS: Record<string, string> = {
  easeIn: 'in',
  In: 'in',
  easeOut: 'out',
  Out: 'out',
  easeInOut: 'inOut',
  InOut: 'inOut',
};

/** Кривая по умолчанию у Phaser-твина без `ease` - `Power0`, то есть линейная. */
export const DEFAULT_EASE = 'none';

/**
 * Phaser-имя кривой -> GSAP-имя. Имя, которое уже в синтаксисе GSAP
 * (`'back.out'`, `'power2.inOut'`, `'none'`), проходит как есть: новый код
 * рантайма вправе писать сразу по-GSAP-овски.
 *
 * Phaser-семейство без направления (`'Quad'`) у Phaser значит `easeOut` -
 * так же и здесь. Незнакомое Phaser-имя - исключение, а не тихий откат на
 * линейную кривую: опечатка в имени должна падать на первом же твине, а не
 * менять характер анимации.
 */
export const toGsapEase = (ease: string | undefined): string => {
  if (ease === undefined || ease === '') {
    return DEFAULT_EASE;
  }

  const [family, direction] = ease.split('.');
  const gsapFamily = PHASER_FAMILIES[family];

  // Не Phaser-семейство (они все с заглавной) - имя GSAP.
  if (gsapFamily === undefined) {
    if (/^[A-Z]/.test(family)) {
      throw new Error(`[game] неизвестная кривая твина "${ease}"`);
    }

    return ease;
  }

  if (gsapFamily === 'none') {
    return 'none';
  }

  if (direction === undefined) {
    return `${gsapFamily}.out`;
  }

  const gsapDirection = PHASER_DIRECTIONS[direction];

  if (gsapDirection === undefined) {
    throw new Error(`[game] неизвестная кривая твина "${ease}"`);
  }

  return `${gsapFamily}.${gsapDirection}`;
};
