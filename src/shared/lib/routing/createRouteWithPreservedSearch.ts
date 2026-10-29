interface ICreateRouteWithPreservedSearchOptions {
  currentSearch: string;
  currentHash: string;
  to: string;
  /**
   * Ключи текущего query, которые не переносятся дальше. Нужны параметрам,
   * осмысленным только на одном экране (`/share?char=...&code=...`): без этого
   * они залипли бы в URL всех следующих разделов.
   */
  dropSearchParams?: readonly string[];
}

const splitHash = (value: string): [string, string] => {
  const hashIndex = value.indexOf('#');

  return hashIndex === -1 ? [value, ''] : [value.slice(0, hashIndex), value.slice(hashIndex)];
};

const splitSearch = (value: string): [string, string] => {
  const searchIndex = value.indexOf('?');

  return searchIndex === -1 ? [value, ''] : [value.slice(0, searchIndex), value.slice(searchIndex)];
};

/**
 * Вход по `?token=` живёт в URL, поэтому внутренние переходы должны переносить
 * текущий query дальше. Hash переносится вместе с query: редирект на loader
 * (включая fallback redirect) сохраняет обе части URL, и обратный
 * переход обязан вести себя так же. Значения целевого route приоритетнее
 * текущих: `dropSearchParams` отбрасывает только унаследованные параметры, а
 * заново заданные тем же переходом - оставляет.
 */
export const createRouteWithPreservedSearch = ({
  currentSearch,
  currentHash,
  to,
  dropSearchParams,
}: ICreateRouteWithPreservedSearchOptions): string => {
  const [withoutHash, targetHash] = splitHash(to);
  const [pathname, targetSearch] = splitSearch(withoutHash);

  const params = new URLSearchParams(currentSearch);
  const targetParams = new URLSearchParams(targetSearch);

  dropSearchParams?.forEach((key) => {
    params.delete(key);
  });

  targetParams.forEach((value, key) => {
    params.set(key, value);
  });

  const search = params.toString();
  const hash = targetHash || currentHash;

  return `${pathname}${search ? `?${search}` : ''}${hash}`;
};
