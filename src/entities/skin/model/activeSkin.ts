import { DEFAULT_SKIN } from '../skins/default';
import type { ISkinManifest } from './types';

/**
 * Активный скин проекта - единственное место, где выбирается папка скина.
 * Скин один на сборку: переключения в рантайме нет, поэтому масштабы и
 * цвета модулей могут считаться при импорте.
 */
export const SKIN: ISkinManifest = DEFAULT_SKIN;
