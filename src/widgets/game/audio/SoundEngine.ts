import type { RuntimeEvents } from '../core/RuntimeEvents';
import { useGameStore, type GameStore } from '../store/GameStore';
import {
  buildMusicBar,
  MUSIC_BAR_SECONDS,
  resolveMatchRecipe,
  resolveSoundRecipe,
  shouldWarnLowMoves,
  type ISoundVoice,
  type TSoundCue,
  type TSoundRecipe,
} from './soundRecipes';

/**
 * Не чаще раза в столько миллисекунд: залп по строке бьёт восемь ящиков за
 * кадр, и восемь одинаковых тресков подряд сливаются в шум.
 */
const CUE_COOLDOWN_MS: Partial<Record<TSoundCue, number>> = {
  crack: 60,
  goal: 70,
  swap: 40,
};

/** Музыка тише звуков доски: она фон, а не событие. */
const MUSIC_VOLUME = 0.6;

/** Спад музыки на остановке, с: уже запланированные такты гаснут, а не обрываются щелчком. */
const MUSIC_FADE_SECONDS = 0.25;

/** На сколько вперёд планируются такты музыки, с, и как часто проверяется план, мс. */
const MUSIC_LOOKAHEAD_SECONDS = 1.5;
const MUSIC_SCHEDULER_MS = 300;

/** Длина буфера белого шума - хватает на самый длинный голос с шумом. */
const NOISE_SECONDS = 1;

/** Плавный спад громкости, чтобы голос не щёлкал на обрыве. */
const RELEASE_FLOOR = 0.0001;

/** Жесты, которыми браузер разрешает звук (autoplay policy). */
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const;

type TAudioContextConstructor = new () => AudioContext;

/** `AudioContext` браузера; старый Safari знает только префиксный. */
const resolveAudioContext = (): TAudioContextConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const prefixed = (window as unknown as { webkitAudioContext?: TAudioContextConstructor })
    .webkitAudioContext;

  return window.AudioContext ?? prefixed ?? null;
};

/**
 * Звук партии: синтез на своём `AudioContext`.
 *
 * Своих аудиофайлов у шаблона нет, поэтому звуки - рецепты из осцилляторов и
 * шума (`soundRecipes`), собранные на лету. У Phaser-эталона контекст давал
 * звуковой менеджер игры; у Pixi его нет, и контекст свой - ровно на одну
 * партию: `destroy` его закрывает (Safari держит лишь несколько живых
 * контекстов на страницу).
 *
 * Контекст создаётся и разблокируется первым жестом игрока (браузеры не дают
 * звучать до него, а созданный раньше контекст ругается в консоль). Пока
 * звук не разрешён, звуки не копятся в очередь, а молча пропускаются - иначе
 * первый тап выстрелил бы всем накопленным разом. Без WebAudio партия идёт
 * молча, а не падает.
 *
 * Модуль сам слушает стор партии: тик и закрытие цели, предупреждение о
 * малом остатке ходов. Звуки доски ему подаёт проигрыватель шагов, финал -
 * оркестратор хода (фаза 2). Пауза партии (событие `pause` шины рантайма:
 * слой хоста или подсказка механики поверх доски) глушит и музыку: её план
 * живёт на таймере окна и сам с тикером не встаёт.
 */
export class SoundEngine {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private musicOutput: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: boolean;
  private readonly lastPlayedAt = new Map<TSoundCue, number>();
  private readonly unsubscribers: (() => void)[] = [];
  private isPaused = false;
  private isDestroyed = false;

  /** Музыку включили (`startMusic`) и не выключали: пауза партии её только приглушает. */
  private isMusicOn = false;
  private musicTimer: number | null = null;
  private nextBarAt = 0;
  private barIndex = 0;

  constructor(events: RuntimeEvents, { muted }: { muted: boolean }) {
    this.muted = muted;
    this.unsubscribers.push(
      useGameStore.subscribe(this.handleStoreChange),
      events.on('pause', this.handlePause),
      events.on('resume', this.handleResume)
    );

    if (resolveAudioContext()) {
      UNLOCK_EVENTS.forEach((event) => {
        window.addEventListener(event, this.unlock, { capture: true, passive: true });
      });
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMute();
  }

  play(cue: TSoundCue): void {
    const cooldown = CUE_COOLDOWN_MS[cue];
    const now = performance.now();

    if (cooldown !== undefined && now - (this.lastPlayedAt.get(cue) ?? -Infinity) < cooldown) {
      return;
    }

    this.lastPlayedAt.set(cue, now);
    this.playRecipe(resolveSoundRecipe(cue));
  }

  /** «Плинк» звена каскада: чем глубже цепочка, тем выше звон. */
  playMatch(iteration: number): void {
    this.playRecipe(resolveMatchRecipe(iteration));
  }

  /** Фоновая музыка по кругу - до `stopMusic` или выключения сцены. */
  startMusic(): void {
    if (this.isMusicOn || !resolveAudioContext()) {
      return;
    }

    this.isMusicOn = true;
    this.nextBarAt = 0;

    // Партия могла уже стоять на паузе (подсказка механики встаёт ровно на
    // конце интро): тогда музыка начнётся с её снятием.
    if (!this.isPaused) {
      this.runMusic();
    }
  }

  /**
   * Останавливает музыку: снимает таймер плана и гасит выход музыки. Такты
   * планируются на полторы секунды вперёд (`MUSIC_LOOKAHEAD_SECONDS`), и без
   * спада громкости уже запланированные доиграли бы поверх фанфары финала.
   */
  stopMusic(): void {
    this.isMusicOn = false;
    this.haltMusic();
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.stopMusic();
    this.isDestroyed = true;
    this.removeUnlockListeners();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.output?.disconnect();
    this.musicOutput?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }

  /**
   * Первый жест игрока: создать контекст (если ещё нет) и разрешить звук.
   * `resume()` обязан прозвучать внутри обработчика жеста - иначе Safari
   * его не примет. Когда контекст звучит, слушать жесты больше незачем.
   */
  private unlock = (): void => {
    if (this.isDestroyed) {
      return;
    }

    const context = this.ensureContext();

    if (!context) {
      this.removeUnlockListeners();

      return;
    }

    if (context.state === 'running') {
      this.removeUnlockListeners();

      return;
    }

    void context
      .resume()
      .then(() => {
        if (context.state === 'running') {
          this.removeUnlockListeners();
        }
      })
      .catch(() => undefined);
  };

  private removeUnlockListeners(): void {
    UNLOCK_EVENTS.forEach((event) => {
      window.removeEventListener(event, this.unlock, { capture: true });
    });
  }

  /** Контекст и выходы - на первом жесте; без WebAudio - `null`. */
  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    const AudioContextConstructor = resolveAudioContext();

    if (!AudioContextConstructor) {
      return null;
    }

    try {
      this.context = new AudioContextConstructor();
    } catch {
      return null;
    }

    this.output = this.context.createGain();
    this.output.connect(this.context.destination);
    this.musicOutput = this.context.createGain();
    // Музыка, включённая до разблокировки, звучит сразу; на паузе - молчит.
    this.musicOutput.gain.value = this.isMusicOn && !this.isPaused ? MUSIC_VOLUME : 0;
    this.musicOutput.connect(this.output);
    this.applyMute();

    return this.context;
  }

  /**
   * План музыки на таймере окна, а не на часах рантайма: темп рантайма
   * ускоряется под буферизованный ход (`RuntimeMotion.setTimeScale`), а музыка от этого
   * ускоряться не должна. Снять таймер обязан `haltMusic`, иначе он пережил
   * бы игру.
   */
  private runMusic(): void {
    if (this.musicTimer !== null) {
      return;
    }

    this.setMusicVolume(MUSIC_VOLUME, 0);
    this.scheduleMusic();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), MUSIC_SCHEDULER_MS);
  }

  /** Таймер плана снят, выход музыки гаснет спадом. */
  private haltMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }

    this.setMusicVolume(0, MUSIC_FADE_SECONDS);
  }

  /**
   * Доска встала под слоем хоста или подсказкой: музыка гаснет вместе с ней.
   * План тактов не сбрасывается - короткая пауза продолжит уже
   * запланированный такт, а после долгой `scheduleMusic` начнёт с текущего
   * момента.
   */
  private handlePause = (): void => {
    this.isPaused = true;

    if (this.isMusicOn) {
      this.haltMusic();
    }
  };

  private handleResume = (): void => {
    this.isPaused = false;

    if (this.isMusicOn) {
      this.runMusic();
    }
  };

  /** Громкость выхода музыки: сразу (`seconds` = 0) или линейным спадом. */
  private setMusicVolume(volume: number, seconds: number): void {
    if (!this.context || !this.musicOutput) {
      return;
    }

    const gain = this.musicOutput.gain;
    const now = this.context.currentTime;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);

    if (seconds > 0) {
      gain.linearRampToValueAtTime(volume, now + seconds);
    } else {
      gain.setValueAtTime(volume, now);
    }
  }

  private handleStoreChange = (state: GameStore, previous: GameStore): void => {
    // На законченной партии ходы уходят в финальный бонус - это праздник, а не
    // тревога «ходы кончаются».
    if (state.movesCount !== previous.movesCount && !state.isGameEnded) {
      if (shouldWarnLowMoves(previous.movesCount, state.movesCount)) {
        this.play('lowMoves');
      }
    }

    if (state.goals === previous.goals) {
      return;
    }

    for (const goal of state.goals) {
      const before = previous.goals.find((item) => item.id === goal.id);

      if (!before || goal.current <= before.current) {
        continue;
      }

      this.play(goal.isCompleted && !before.isCompleted ? 'goalComplete' : 'goal');
    }
  };

  private applyMute(): void {
    if (!this.context || !this.output) {
      return;
    }

    this.output.gain.setValueAtTime(this.muted ? 0 : 1, this.context.currentTime);
  }

  /** Контекст звучит: разблокирован жестом и не закрыт вместе с партией. */
  private isRunning(): boolean {
    return this.context?.state === 'running';
  }

  private playRecipe(recipe: TSoundRecipe): void {
    if (!this.context || !this.output || this.muted || !this.isRunning()) {
      return;
    }

    const startAt = this.context.currentTime;

    for (const voice of recipe) {
      this.playVoice(voice, startAt + (voice.delay ?? 0), this.output);
    }
  }

  private playVoice(voice: ISoundVoice, startAt: number, destination: AudioNode): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const envelope = context.createGain();
    const endAt = startAt + voice.duration;

    envelope.gain.setValueAtTime(RELEASE_FLOOR, startAt);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, startAt + voice.attack);
    envelope.gain.exponentialRampToValueAtTime(RELEASE_FLOOR, endAt);
    envelope.connect(destination);

    const source =
      voice.wave === 'noise' ? this.createNoise(context, voice) : this.createTone(context, voice);

    source.node.connect(source.input ?? envelope);

    if (source.input) {
      source.input.connect(envelope);
    }

    source.node.start(startAt);
    source.node.stop(endAt + 0.02);
    source.node.onended = () => envelope.disconnect();

    if (voice.frequencyEnd !== undefined && source.frequency) {
      source.frequency.setValueAtTime(voice.frequency, startAt);
      source.frequency.exponentialRampToValueAtTime(voice.frequencyEnd, endAt);
    }
  }

  private createTone(
    context: AudioContext,
    voice: ISoundVoice
  ): {
    node: AudioScheduledSourceNode;
    input: AudioNode | null;
    frequency: AudioParam | null;
  } {
    const oscillator = context.createOscillator();

    oscillator.type = voice.wave === 'noise' ? 'sine' : voice.wave;
    oscillator.frequency.value = voice.frequency;

    return { node: oscillator, input: null, frequency: oscillator.frequency };
  }

  /** Шум через фильтр: частота голоса - частота фильтра, глиссандо двигает её. */
  private createNoise(
    context: AudioContext,
    voice: ISoundVoice
  ): {
    node: AudioScheduledSourceNode;
    input: AudioNode | null;
    frequency: AudioParam | null;
  } {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();

    source.buffer = this.getNoiseBuffer(context);
    filter.type = voice.filter ?? 'lowpass';
    filter.frequency.value = voice.frequency;

    return { node: source, input: filter, frequency: filter.frequency };
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise) {
      return this.noise;
    }

    const length = Math.floor(context.sampleRate * NOISE_SECONDS);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);

    // Косметика, а не правило доски: `Math.random` здесь не трогает зерно партии.
    for (let index = 0; index < length; index++) {
      data[index] = Math.random() * 2 - 1;
    }

    this.noise = buffer;

    return buffer;
  }

  /**
   * Планирует такты музыки на `MUSIC_LOOKAHEAD_SECONDS` вперёд по часам
   * аудиоконтекста - они точнее любого таймера. Заблокированный контекст
   * ждёт: план начинается с момента, когда звук разрешили.
   */
  private scheduleMusic(): void {
    const context = this.context;

    // Выключенный звук музыку не планирует вовсе: такты в немой выход - работа
    // впустую. Включили обратно - план продолжится со следующей проверки.
    if (!context || !this.musicOutput || this.muted || !this.isRunning()) {
      return;
    }

    if (this.nextBarAt < context.currentTime) {
      this.nextBarAt = context.currentTime + 0.05;
    }

    while (this.nextBarAt < context.currentTime + MUSIC_LOOKAHEAD_SECONDS) {
      for (const note of buildMusicBar(this.barIndex)) {
        this.playVoice(
          {
            wave: note.wave,
            frequency: note.frequency,
            attack: 0.02,
            duration: note.duration,
            gain: note.gain,
          },
          this.nextBarAt + note.offset,
          this.musicOutput
        );
      }

      this.barIndex++;
      this.nextBarAt += MUSIC_BAR_SECONDS;
    }
  }
}
