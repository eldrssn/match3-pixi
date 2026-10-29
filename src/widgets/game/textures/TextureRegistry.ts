import type { Texture } from 'pixi.js';

/**
 * Текстуры партии по ключу скина - единственное место, где модули рантайма
 * их берут (замена менеджера текстур Phaser-эталона).
 *
 * Два источника под общими ключами, и потребителю всё равно, какой: файлы
 * скина (`loadSkinTextures`, кэш `Assets`) и процедурные холсты
 * (`registerProceduralTextures`). Обе стороны живут на всё приложение - набор
 * статичен, - поэтому реестр партии текстуры не гасит, а только забывает:
 * следующая партия получит те же без загрузки и рисования.
 */
export class TextureRegistry {
  private readonly textures = new Map<string, Texture>();
  /** Кадры спрайт-листов по ключу листа (`ISkinTextureFile.frameHeight`). */
  private readonly frameLists = new Map<string, readonly Texture[]>();

  has(key: string): boolean {
    return this.textures.has(key);
  }

  /**
   * Текстура по ключу. Неизвестный ключ - исключение, а не пустая текстура:
   * у Phaser-эталона на его месте рисовался зелёный квадрат `__MISSING`, и
   * опечатка в ключе доживала до глаз игрока.
   */
  get(key: string): Texture {
    const texture = this.textures.get(key);

    if (!texture) {
      throw new Error(`[game] нет текстуры "${key}"`);
    }

    return texture;
  }

  set(key: string, texture: Texture): void {
    this.textures.set(key, texture);
  }

  /**
   * Кадры спрайт-листа. Лист под своим ключом - его первый кадр (как картинка
   * листа без кадра у эталона), кадры целиком - здесь. Не лист - один кадр:
   * клип по обычной текстуре просто стоит на ней.
   */
  frames(key: string): readonly Texture[] {
    return this.frameLists.get(key) ?? [this.get(key)];
  }

  setFrames(key: string, frames: readonly Texture[]): void {
    this.frameLists.set(key, frames);
  }

  destroy(): void {
    this.textures.clear();
    this.frameLists.clear();
  }
}
