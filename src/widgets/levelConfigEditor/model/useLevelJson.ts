import { useRef, useState } from 'react';
import { normalizeMinigameLevelConfig, type IMinigameLevelConfig } from '@/entities/game';
import { downloadJsonFile } from './jsonFile';
import { EDITOR_TEXTS } from './texts';
import type { TEditorNotify } from './useEditorToast';

export const toJsonText = (config: IMinigameLevelConfig) => JSON.stringify(config, null, 2);

/** Правка уровня из поля JSON: `merge` - продолжение непрерывного набора. */
export interface ILevelJsonEdit {
  config: IMinigameLevelConfig;
  merge: boolean;
}

/**
 * Поле JSON открытого уровня: текст, ошибка разбора, копирование и выгрузка.
 *
 * Текст поля - не производная уровня: пока автор набирает, в нём бывает и
 * неразбираемый JSON, поэтому он живёт своим состоянием, а уровень в поле
 * показывает `showJson` (отмена, переход к другому уровню).
 */
export const useLevelJson = (editConfig: IMinigameLevelConfig, notify: TEditorNotify) => {
  const [jsonText, setJsonText] = useState(() => toJsonText(editConfig));
  const [jsonError, setJsonError] = useState<string | null>(null);
  /**
   * Последняя правка черновика - набор текста в поле JSON. Непрерывный набор -
   * один шаг истории, а не по шагу на каждый символ, после которого текст
   * разобрался: иначе правка JSON вытеснила бы из истории правки поля.
   */
  const isTypingJsonRef = useRef(false);

  /** Показать уровень в поле; следующий набор - уже новый шаг истории. */
  const showJson = (config: IMinigameLevelConfig) => {
    isTypingJsonRef.current = false;
    setJsonText(toJsonText(config));
    setJsonError(null);
  };

  /**
   * Набранный текст - в поле как есть. Разобрался - правка уровня для
   * черновика, нет - ошибка под полем и `null`.
   */
  const importJson = (text: string): ILevelJsonEdit | null => {
    setJsonText(text);

    try {
      const config = normalizeMinigameLevelConfig(
        JSON.parse(text) as Partial<IMinigameLevelConfig>
      );
      const merge = isTypingJsonRef.current;

      isTypingJsonRef.current = true;
      setJsonError(null);

      return { config, merge };
    } catch (error) {
      setJsonError((error as Error).message);

      return null;
    }
  };

  const copyJson = () => {
    navigator.clipboard
      .writeText(toJsonText(editConfig))
      .then(() => notify('success', EDITOR_TEXTS.toasts.jsonCopied))
      .catch(() => notify('error', EDITOR_TEXTS.toasts.jsonCopyFailed));
  };

  const downloadJson = () => {
    downloadJsonFile(`level_${editConfig.id}_config.json`, editConfig);
  };

  return { jsonText, jsonError, showJson, importJson, copyJson, downloadJson };
};
