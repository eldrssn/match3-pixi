import { warmAssets } from '@/shared/lib/assetCache';
import { PARTY_RESULT_IMAGE_URLS } from '@/shared/lib/assets';

interface IWarmPartyAssetsOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Прогрев арта результата при старте партии. Ошибка файла не блокирует игру. */
export const warmPartyAssets = async ({
  signal,
  onProgress,
}: IWarmPartyAssetsOptions = {}): Promise<void> => {
  await warmAssets(PARTY_RESULT_IMAGE_URLS, { signal, onProgress }).catch(() => undefined);
};
