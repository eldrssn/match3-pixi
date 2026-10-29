/**
 * Форма темпа доски - для частичного переопределения из скина
 * (`ISkinManifest.timing`).
 *
 * Значения по умолчанию и смысл каждого числа живут в рантайме
 * (`widgets/game/configs/timing.ts`, `DEFAULT_BOARD_TIMING`), а форма - здесь:
 * скин - слой ниже виджета и импортировать его не может (тот же довод, что у
 * `TSoundCue`). Расхождение формы и значений ловит компилятор: таблица
 * рантайма объявлена через `satisfies IBoardTiming`.
 */
export interface IBoardTiming {
  readonly intro: {
    readonly tileMs: number;
    readonly waveStepMs: number;
    readonly tileStartScale: number;
  };
  readonly input: {
    readonly pressMs: number;
    readonly pendingSpeedUp: number;
  };
  readonly swap: {
    readonly durationMs: number;
    readonly minDurationMs: number;
    readonly rejectMs: number;
    readonly rejectShakeMs: number;
  };
  readonly destroy: {
    readonly barrierMs: number;
    readonly anticipationMs: number;
    readonly collapseMs: number;
  };
  readonly fall: {
    readonly baseMs: number;
    readonly perRowMs: number;
    readonly staggerMs: number;
    readonly landSquashMs: number;
  };
  readonly cascade: {
    readonly iterationDelayMs: number;
    readonly iterationDelayStepMs: number;
    readonly iterationDelayMinMs: number;
    readonly settleDelayMs: number;
  };
  readonly special: {
    readonly spawnMs: number;
    readonly beamFrameMs: number;
    readonly shockwaveMs: number;
    readonly takeoffMs: number;
    readonly flightMsPerCell: number;
    readonly flightMinMs: number;
    readonly flightMaxMs: number;
    readonly raysMs: number;
    readonly transformMs: number;
  };
  readonly booster: {
    readonly beamFadeInMs: number;
    readonly beamHoldMs: number;
    readonly beamFadeOutMs: number;
    readonly ellipseFadeInMs: number;
    readonly ellipseFlightMs: number;
    readonly ellipseStaggerMs: number;
    readonly portalGrowMs: number;
    readonly portalSpinMs: number;
    readonly portalFadeOutMs: number;
  };
  readonly finale: {
    readonly speedUp: number;
  };
  readonly moves: {
    readonly pulseMs: number;
    readonly fadeOutMs: number;
    readonly fadeInMs: number;
  };
  readonly idle: {
    readonly pulseMs: number;
  };
  readonly fx: {
    readonly flashMs: number;
    readonly comboPopInMs: number;
    readonly comboPopHoldMs: number;
    readonly comboPopOutMs: number;
    readonly winBeatMs: number;
    readonly defeatDimMs: number;
  };
  readonly comboPhrase: {
    readonly chance: number;
    readonly cooldownMs: number;
    readonly inMs: number;
    readonly holdMs: number;
    readonly outMs: number;
  };
}

/** Частичное переопределение темпа: любые группы и любые числа внутри них. */
export type TBoardTimingOverride = {
  readonly [G in keyof IBoardTiming]?: Partial<IBoardTiming[G]>;
};
