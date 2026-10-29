import { Container, Sprite } from 'pixi.js';
import { GAME_CONFIG } from '../configs/GAME_CONFIG';
import { getLevelConfig } from '../configs/levelConfig';
import { BOARD_TIMING } from '../configs/timing';
import type { GameRuntimeCore } from '../core/GameRuntimeCore';
import type { IRuntimeViewport } from '../core/RuntimeEvents';
import { resolveBoardDesignSize, resolveBoardFitScale } from '../lib/boardFit';
import { resolveBoardIntroDelayMs } from '../lib/boardTempo';
import { tweenDisplay } from '../motion/displayMotion';

/**
 * Подложка поля: клетки `tile`/`tileBright` шахматкой, без дыр уровня.
 *
 * Раскладка: центр поля - центр контейнера, контейнер в центре безопасной
 * зоны минус `offsetY`, масштаб - сцена плюс ужатие поля крупнее 6×6
 * (`lib/boardFit`) - тот же множитель, что у фишек в `GameLogic`, иначе
 * фишки разъехались бы с клетками фона.
 *
 * Модуль создаётся пустым, а собирается по команде (`initGameBoard`): поле
 * появляется под летящей целью интро, а не до неё (`GameLogic.initAnimation`).
 */
export class GameBoardBackground {
  private readonly core: GameRuntimeCore;
  private readonly container = new Container({ label: 'GameBoardBackground' });
  /** Число колонок поля (ось X). Контракт `level_data` - `grid[col][row]`. */
  private readonly colCount: number;
  /** Число строк поля (ось Y). */
  private readonly rowCount: number;
  /** Ужатие поля крупнее 6×6 под область сцены (`lib/boardFit`). */
  private readonly fitScale: number;
  private readonly offResize: () => void;
  private isDestroyed = false;

  constructor(core: GameRuntimeCore) {
    this.core = core;
    core.layers.get('Background').addChild(this.container);

    // Размер поля - из самого уровня, а не из `GAME_CONFIG.board`: хардкод 6x6
    // рисовал бы фон обрезанным под любой другой сеткой. Конфиг - фолбэк.
    const grid = getLevelConfig()?.grid;

    this.colCount = grid?.length || GAME_CONFIG.board.width;
    this.rowCount = grid?.[0]?.length || GAME_CONFIG.board.height;
    this.fitScale = resolveBoardFitScale(this.colCount, this.rowCount);
    this.offResize = core.events.on('resize', this.layout);
    this.layout(core.viewport);
  }

  /**
   * Поле собирается волной от центра наружу: клетки материализуются вокруг
   * точки, куда смотрит игрок.
   *
   * Направление волны задаёт не порядок обхода, а `delay` каждого твина
   * (`resolveBoardIntroDelayMs`): `await` внутри цикла проявлял бы клетки по
   * одной за кадр. Твины ждутся все разом.
   */
  async initGameBoard(): Promise<void> {
    const { width: tileSize, spaceBetween } = GAME_CONFIG.tile.size;
    const board = resolveBoardDesignSize(this.colCount, this.rowCount);
    const grid = getLevelConfig()?.grid;
    const { motion, textures } = this.core;
    const intros: Promise<void>[] = [];

    for (let row = 0; row < this.rowCount; row++) {
      for (let col = 0; col < this.colCount; col++) {
        if (grid?.[col]?.[row]?.id === 'HOLE') {
          continue;
        }

        // Начало координат клетки - её центр: масштабирование от угла растило
        // бы клетку вправо-вниз, а не из себя.
        const tile = new Sprite(textures.get((row + col) % 2 === 0 ? 'tile' : 'tileBright'));

        tile.anchor.set(0.5);
        tile.position.set(
          col * (tileSize + spaceBetween) - board.width / 2 + tileSize / 2,
          row * (tileSize + spaceBetween) - board.height / 2 + tileSize / 2
        );
        tile.setSize(tileSize, tileSize);

        // `setSize` пишет в масштаб, поэтому прилёт считается от него.
        const baseScaleX = tile.scale.x;
        const baseScaleY = tile.scale.y;

        tile.alpha = 0;
        tile.scale.set(
          baseScaleX * BOARD_TIMING.intro.tileStartScale,
          baseScaleY * BOARD_TIMING.intro.tileStartScale
        );
        this.container.addChild(tile);

        intros.push(
          tweenDisplay(
            motion,
            tile,
            { alpha: 1, scaleX: baseScaleX, scaleY: baseScaleY },
            {
              duration: BOARD_TIMING.intro.tileMs,
              delay: resolveBoardIntroDelayMs(col, row, this.colCount, this.rowCount),
              ease: 'Back.easeOut',
            }
          )
        );
      }
    }

    await Promise.all(intros);
  }

  private layout = ({ width, layout }: IRuntimeViewport): void => {
    if (this.isDestroyed) {
      return;
    }

    // `offsetY` в дизайн-px, как и остальные офсеты сцены: без `* scale`
    // сдвиг вёл бы себя по-разному на разных экранах.
    this.container.scale.set(layout.scale * this.fitScale);
    this.container.position.set(
      width / 2,
      layout.centerY - GAME_CONFIG.boardContainer.offsetY * layout.scale
    );
  };

  destroy(): void {
    this.isDestroyed = true;
    this.offResize();
    this.container.destroy({ children: true });
  }
}
