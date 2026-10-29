import clsx from 'clsx';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  readQueryGameDebug,
  readQueryInsets,
  readQueryPerf,
  readQueryRenderer,
  readQuerySeed,
} from '@/shared/lib/routing';
import { GAME_RUNTIME_FAILURE_TEXT, GameScreenLazy } from '@/widgets/game';
import { MODAL_KEYS, prefetchModalChunk, useHasMountedModals } from '@/widgets/modals';
import { isPartyScreen, useMainFlowStore } from './model/useMainFlowStore';
import { MAIN_TEXTS } from './texts';
import { LevelMap } from './ui/LevelMap';
import { MainActions } from './ui/MainActions';
import { ShowcaseList } from './ui/ShowcaseList';
import styles from './Main.module.scss';

/**
 * Главная - пример хоста Match-3 виджета: кнопки «Играть», «Уровни»,
 * «Витрина» и «Редактор», карта уровней, витрина механик, сама партия и
 * карточки уровня и результата. Партия - режим главной, а не отдельный
 * маршрут: экран партии монтируется вместо её содержимого.
 *
 * Сценарий целиком живёт в `useMainFlowStore`; страница только раскладывает
 * его состояние по экрану и отдаёт виджету колбэки.
 */
export const Main = () => {
  const screen = useMainFlowStore((state) => state.screen);
  const party = useMainFlowStore((state) => state.party);
  const partyId = useMainFlowStore((state) => state.partyId);
  const failure = useMainFlowStore((state) => state.failure);
  const finish = useMainFlowStore((state) => state.finish);
  const outOfMoves = useMainFlowStore((state) => state.outOfMoves);
  const tutorialSeen = useMainFlowStore((state) => state.tutorialSeen);
  const goHome = useMainFlowStore((state) => state.goHome);
  const fail = useMainFlowStore((state) => state.fail);
  // «Дальше»/«Ещё раз» поднимают новую партию, пока над ней ещё доигрывает
  // exit-анимацию карточка результата: доска стоит на паузе, пока карточка не
  // уйдёт из DOM, иначе тап по уходящей кнопке доходил бы до новой доски.
  const hasMountedModals = useHasMountedModals();
  // Query читается через `useLocation`, а не `window.location`: снятый на лету
  // флаг должен убрать отладочные кнопки без перезагрузки.
  const { search } = useLocation();
  // Обычная страница своих отступов не знает - браузер сам держит её вне выреза.
  // `?insets=` (QA) имитирует хост с вырезом и home-индикатором.
  const insets = readQueryInsets(search) ?? undefined;
  // `?seed=` (QA) повторяет раскладку добора и перемешки, на которой поймали баг.
  const seed = readQuerySeed(search) ?? undefined;
  // `?perf=low|high` (QA) фиксирует качество отрисовки вместо перф-гейта.
  const quality = readQueryPerf(search) ?? 'auto';
  // `?renderer=webgl|webgpu` (QA) - какой рендерер просить у рантайма.
  const renderer = readQueryRenderer(search) ?? 'auto';

  // Партия - режим главной: уход со страницы (переход в редактор, «назад»
  // браузера) её обрывает, и возврат начинается с главной, а не с перезапуска
  // той же партии. Сброс - на размонтировании, а не на маунте: на маунте
  // первый рендер успел бы смонтировать экран партии по старому стору, и
  // рантайм поднялся бы только затем, чтобы тут же умереть. Лишний cleanup
  // StrictMode на старте безвреден - там уже `home`.
  useEffect(
    () => () => {
      useMainFlowStore.getState().goHome();
    },
    []
  );

  // «Играть» открывает карточку уровня - её чанк греется заранее, чтобы первый
  // тап не ждал сети.
  useEffect(() => {
    prefetchModalChunk(MODAL_KEYS.LEVEL_START);
  }, []);

  return (
    <main className={clsx(styles.page, isPartyScreen(screen) && styles.pageParty)}>
      <div className={styles.frame}>
        {party ? (
          <GameScreenLazy
            key={partyId}
            level={party.level}
            boosters={party.boosters}
            preBoosters={party.preBoosters}
            tutorial={party.tutorial}
            paused={hasMountedModals}
            debug={readQueryGameDebug(search)}
            insets={insets}
            seed={seed}
            quality={quality}
            renderer={renderer}
            title={party.title}
            onFinish={finish}
            onOutOfMoves={outOfMoves}
            onTutorialSeen={tutorialSeen}
            onExitRequest={goHome}
            onError={fail}
          />
        ) : null}

        {screen === 'home' ? (
          <div className={styles.home}>
            <h1 className={styles.title}>{MAIN_TEXTS.title}</h1>
            {failure ? (
              <p className={styles.notice} role="alert">
                <strong>{GAME_RUNTIME_FAILURE_TEXT[failure].title}</strong>
                <br />
                {GAME_RUNTIME_FAILURE_TEXT[failure].description}
              </p>
            ) : null}
            <MainActions />
          </div>
        ) : null}

        {screen === 'map' ? <LevelMap /> : null}

        {screen === 'showcase' ? <ShowcaseList /> : null}
      </div>
    </main>
  );
};

export default Main;
