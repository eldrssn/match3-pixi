# State Management

## Механизмы

| Механизм          | Где                                                              | Назначение                             |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Zustand           | `pages/main/model`, `widgets/game/store`, `widgets/modals/model` | Сценарий партии, рантайм игры, модалки |
| React local state | pages/widgets/hooks                                              | Краткоживущие состояния интерфейса     |

Redux, RTK Query и TanStack Query не используются. Звукового стора нет (звук -
модуль рантайма `SoundEngine` на своём `AudioContext`, выключение помнит `localStorage`). Прогресс
уровней - забота хоста: копия в `useMainFlowStore`, источник - `localStorage`
(`features/match3Host/model/levelProgress`).

## Владельцы состояния

- `pages/main/model/useMainFlowStore.ts` - хост партии: экран главной
  (`home`/`map`/`showcase`/`game`/`result`), `partyId` (ключ экрана партии),
  `party` (источник - номер пака или ключ витрины, уровень, подпись, бустеры,
  предбустеры и обучение текущей партии), счётчик
  near-miss продолжений, причина прошлого отказа и `progress` - копия
  прогресса из `localStorage` (открытый уровень, звёзды, рекорды, знакомые
  механики; правила - чистые `features/match3Host` `levelProgress`). Текущий уровень - не поле, а
  селектор `selectCurrentLevel` от `progress`: отдельная копия расходилась с
  прогрессом. Правила выбора - чистые `features/match3Host` `partyRules`.
- `widgets/game/store` - состояние одного рантайма: `GameStore` (цели, ходы,
  очки, бустеры, флаги исхода/выхода/отказа, `outOfMoves` - ожидание решения
  хоста на исходе ходов, `isIntroFinished`, FPS и качество отрисовки
  перф-гейта, фактический рендерер `rendererKind`), `levelConfigStore` (уровень, бустеры, зерно случайности партии -
  `seed` - и `partyOptions`: слушает ли хост near-miss, предбустеры, режим
  качества, подпись партии, запрошенный рендерер), `comboPhraseStore` (баннер хайп-фразы). Сбрасываются вместе с
  рантаймом.
- Модульные значения рантайма вне React-сторов: `widgets/game/configs/renderScale.ts`
  (размер канваса), `widgets/game/configs/renderQuality.ts` (качество
  отрисовки - стартовое выставляет `setRuntimeLevelConfig` из режима партии,
  понижает `PerfMonitor`; запись всегда через `lib/applyRenderQuality`, вместе
  с зеркалом `GameStore.renderQuality`, которое `resetStore` повторяет, а не
  перетирает) и `widgets/game/configs/sceneInsets.ts` (отступы сцены) - их
  пишет владелец канваса, а сбрасывает `bootGameRuntime`.
- Подсказки механик (`ui/MechanicTip`) - React local state хука
  `widgets/game/model/useMechanicTips`: очередь из пропа `tutorial` и индекс
  текущей подсказки; `GameScreen` только раскладывает его результат.
- `widgets/modals/model/useModalsStore.ts` держит ключи, параметры и порядок
  модалок; видимый слой выбирает `useActiveLayer`.
- Краткоживущие формы и состояния компонентов живут в React local state.

## Ключи localStorage

Все ключи - `STORAGE_KEYS` в `src/shared/constants/model/storageKeys.ts` под
префиксом `STORAGE_PREFIX` (`match3-pixi`); литералов ключей по месту нет.
Переноса старых ключей нет: проект новый. Список ключей - в
[extending.md](./extending.md#ключи-localstorage).
