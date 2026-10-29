import { useAssetCacheStore } from './model/assetCacheStore';

/**
 * Реактивное чтение прогретого URL. Нужна там, где компонент может появиться
 * раньше завершения прогрева: пока blob не готов, отдаётся исходный URL, а
 * догрев перерисовывает компонент с blob-копией (без повторной сетевой загрузки
 * - blob уже в памяти страницы).
 *
 * `null` на входе (несостоявшийся `iconRef`) проходит насквозь - вызывающий
 * сам решает, что рисовать вместо пустой ссылки.
 */
export function useWarmedAssetUrl(url: string): string;
export function useWarmedAssetUrl(url: string | null | undefined): string | null;
export function useWarmedAssetUrl(url: string | null | undefined): string | null {
  const entry = useAssetCacheStore((state) => (url ? state.entries[url] : undefined));

  if (!url) {
    return null;
  }

  return entry?.blobUrl ?? url;
}
