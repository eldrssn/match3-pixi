import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type TAssetCacheEntryStatus = 'warming' | 'ready' | 'failed';

export interface IAssetCacheEntry {
  status: TAssetCacheEntryStatus;
  /**
   * Blob-URL загруженного ассета. `null` у двух категорий: пока ассет ещё
   * качается (`warming`) и у внешних no-CORS картинок (`ready`, но blob
   * невозможен - их прогревает `<img>`, потребителю остаётся исходный URL).
   */
  blobUrl: string | null;
}

interface IAssetCacheState {
  entries: Record<string, IAssetCacheEntry>;
  setEntry: (url: string, entry: IAssetCacheEntry) => void;
  removeEntry: (url: string) => void;
  reset: () => void;
}

/**
 * Blob живёт, пока жив его objectURL, и сборщик мусора сам его не заберёт.
 * Выбрасывая запись, отзываем ссылку в том же шаге - иначе выброшенная копия
 * осталась бы в памяти документа до перезагрузки страницы.
 */
const revokeEntry = (entry: IAssetCacheEntry | undefined): void => {
  if (entry?.blobUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(entry.blobUrl);
  }
};

/**
 * Сессионный кэш ассетов. Живёт ровно столько, сколько живёт страница:
 * nginx отдаёт статику с `Cache-Control: no-store` (конфиг менять нельзя),
 * поэтому без blob-копий каждый экран перекачивал бы картинки заново.
 *
 * Хранится через zustand, а не голую Map: UI (`useWarmedAssetUrl`) должен
 * перерисоваться, когда blob догрелся уже после первого рендера компонента.
 */
export const useAssetCacheStore = create<IAssetCacheState>()(
  devtools(
    (set) => ({
      entries: {},

      setEntry: (url, entry) =>
        set((state) => {
          // Перезапись готовой записи - тоже потеря ссылки на старый blob.
          if (state.entries[url]?.blobUrl !== entry.blobUrl) {
            revokeEntry(state.entries[url]);
          }

          return { entries: { ...state.entries, [url]: entry } };
        }),

      removeEntry: (url) =>
        set((state) => {
          const { [url]: removed, ...entries } = state.entries;
          revokeEntry(removed);

          return { entries };
        }),

      reset: () =>
        set((state) => {
          Object.values(state.entries).forEach(revokeEntry);

          return { entries: {} };
        }),
    }),
    { name: 'asset-cache-store', enabled: process.env.NODE_ENV === 'development' }
  )
);
