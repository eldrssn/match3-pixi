import { SKIN } from '@/entities/skin';
import { getTextResolution } from './renderScale';

export { DESIGN_HEIGHT, DESIGN_WIDTH } from './designSize';

/**
 * Разрешение печати текста - геттер, а не константа модуля.
 *
 * Оно считается от `worldScale`, то есть от размера канваса, а канвас меряется
 * уже после того, как чанк игры загружен: константа на верхнем уровне модуля
 * вычислилась бы раньше первого замера доски и навсегда осталась бы фолбэком по
 * DPR. Геттер срабатывает в момент создания текста рантайма, когда
 * размер известен, а сам текст всё равно растеризуется один раз.
 */
const textResolution = () => getTextResolution();

/**
 * Целевой размер обычной клетки-сущности (фишка/лёд/груз) в дизайн-px.
 *
 * Тот же множитель роста, что у `tile.size` (57/50).
 */
const CELL_DESIGN_SIZE = 48;

/**
 * Ширина исходной текстуры предмета клетки в пикселях - свойство скина
 * (`SKIN.textures.cellWidth`): арт задаёт её, а не рантайм.
 *
 * Масштаб пишется дробью «дизайн-px / ширина текстуры», а не готовым
 * десятичным множителем: числитель фиксирует, каким элемент обязан выглядеть,
 * при перевыгрузке арта правится только знаменатель - в папке скина.
 * Экспортируется, потому что от него считаются `BoardEntity.BASE_SCALE` и
 * масштабы спецфишек - иначе этот знаменатель жил бы несколькими копиями и
 * следующая перевыгрузка молча развела бы клетки по размеру.
 */
export const CELL_TEXTURE_WIDTH = SKIN.textures.cellWidth;

/** Семейство шрифта текстов сцены - из скина; сам `@font-face` подключает CSS. */
const FONT_FAMILY = SKIN.fonts.game;

export const GAME_CONFIG = {
  board: {
    width: 6,
    height: 6,
  },
  tile: {
    size: {
      width: 57,
      height: 57,
      spaceBetween: 2,
    },
  },
  /**
   * `offsetY` сдвинут на половину прироста доски от увеличенного `tile.size` (+21):
   * рост поля от увеличенного `tile.size` идёт симметрично от центра
   * контейнера, а весь этот сдвиг переносит прирост высоты целиком вверх, не
   * трогая нижний край - иначе поле наехало бы на панель бустеров.
   */
  boardContainer: {
    offsetX: 0,
    offsetY: 71,
  },
  topOffset: 40,
  /**
   * Общий множитель размеров элементов шапки партии - кнопки выхода и счётчика
   * ходов. Живёт здесь, а не в модулях: оба обязаны расти одинаково, иначе
   * шапка перестаёт читаться как одна строка.
   */
  headerControlScale: 1.15,
  boostersContainerOffsetY: -137,
  boosterCountTextConfig: {
    fontFamily: FONT_FAMILY,
    fontSize: '11px',
    color: '#ffffff',
    fontStyle: 'bold',
    get resolution() {
      return textResolution();
    },
  },
  boosterNameTextConfig: {
    fontFamily: FONT_FAMILY,
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold',
    get resolution() {
      return textResolution();
    },
  },
  comboTextConfig: {
    fontFamily: FONT_FAMILY,
    fontSize: '36px',
    color: '#ffffff',
    stroke: '#ff8a2a',
    strokeThickness: 6,
    fontStyle: 'bold',
    get resolution() {
      return textResolution();
    },
  },
  movesCounterTextConfig: {
    fontFamily: FONT_FAMILY,
    fontSize: '15px',
    color: '#ffffff',
    align: 'center',
    fontStyle: 'bold',
    get resolution() {
      return textResolution();
    },
  },
  /** Подпись "ход"/"хода"/"ходов" под числом (Figma 15602-44744) - не красится тревожным цветом, в отличие от самой цифры. */
  movesLabelTextConfig: {
    fontFamily: FONT_FAMILY,
    fontSize: '10px',
    color: '#ffffff',
    align: 'center',
    fontStyle: 'bold',
    get resolution() {
      return textResolution();
    },
  },
  cellsSize: CELL_DESIGN_SIZE,
  /**
   * Масштаб спрайта льда. Считается от тех же двух величин, что и
   * `BoardEntity.BASE_SCALE`, а не своим десятичным числом: лёд и фишка обязаны
   * занимать одну клетку, и при следующей правке `CELL_DESIGN_SIZE` разъехаться
   * они не должны.
   */
  iceScaleTiles: CELL_DESIGN_SIZE / CELL_TEXTURE_WIDTH,
  boostersScale: 0.105,
  /**
   * Порог «это свайп, а не тап» в долях клетки.
   *
   * Доля, а не пиксели: расстояние меряется в пикселях канваса, а канвас
   * рисует в физических пикселях устройства (CSS x DPR, см. `renderScale.ts`)
   * и дополнительно масштабируется под экран. Константа вроде 80px была бы
   * половиной клетки при DPR 3 и полутора клетками при DPR 1 - свайп ощущался
   * бы по-разному на разных телефонах.
   */
  swipeThresholdTiles: 0.5,
  /**
   * Насколько далеко фишка едет за пальцем, в долях клетки.
   *
   * `swappable` - целая клетка: пара меняется местами прямо под пальцем, и на
   * отпускании доезжать уже нечего. Половина (ровно порог) означала невидимую
   * стену на середине жеста: палец едет дальше, картинка стоит.
   *
   * `blocked` - соседа нет или он не умеет меняться местами (блокер, дыра,
   * край доски). Целая клетка положила бы фишку ровно поверх него - картинка
   * обмена, которого не будет; четверти хватает, чтобы жест не выглядел
   * мёртвым.
   *
   * Порог коммита (`swipeThresholdTiles`) с этими числами намеренно не связан:
   * он остаётся на половине клетки, то есть середина пути - точка невозврата,
   * а не конец движения.
   */
  dragFollowTiles: {
    swappable: 1,
    blocked: 0.25,
  },
};
