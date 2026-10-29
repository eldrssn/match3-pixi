import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssetCacheStore } from './model/assetCacheStore';
import { warmAssets } from './model/warmAssets';
import { warmAssetUrl } from './model/warmAssetUrl';
import { warmFontFaces } from './model/warmFontFaces';

const createMockImage = () =>
  ({
    decoding: '',
    crossOrigin: '',
    src: '',
    complete: true,
    naturalWidth: 10,
    onload: null,
    onerror: null,
    removeEventListener: vi.fn(),
  }) as unknown as HTMLImageElement;

const fetchRejectingOnAbort = () =>
  vi.fn(
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
  );

describe('warmAssetUrl', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAssetCacheStore.getState().reset();
    createObjectURL = vi.fn(() => 'blob:mock-asset');
    vi.stubGlobal('URL', { ...URL, createObjectURL });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('asset-bytes', { status: 200 })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores a blob url for a fetched asset', async () => {
    await warmAssetUrl('/images/main/main-bg.webp');

    const entry = useAssetCacheStore.getState().entries['/images/main/main-bg.webp'];
    expect(entry).toEqual({ status: 'ready', blobUrl: 'blob:mock-asset' });
  });

  it('resolves immediately for an empty or data url', async () => {
    await expect(warmAssetUrl('')).resolves.toBeUndefined();
    await expect(warmAssetUrl('data:image/png;base64,AAAA')).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('dedupes parallel calls into a single fetch', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    const first = warmAssetUrl('/images/a.webp');
    const second = warmAssetUrl('/images/a.webp');

    resolveFetch(new Response('bytes', { status: 200 }));
    await Promise.all([first, second, warmAssetUrl('/images/a.webp')]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('makes a joining caller wait for the file instead of resolving on a warming entry', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    const first = warmAssetUrl('/images/a.webp');
    let isSecondSettled = false;
    const second = warmAssetUrl('/images/a.webp').then(() => {
      isSecondSettled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Запись уже `warming`, но файла ещё нет: блокирующий переход обязан ждать.
    expect(isSecondSettled).toBe(false);

    resolveFetch(new Response('bytes', { status: 200 }));
    await Promise.all([first, second]);

    expect(isSecondSettled).toBe(true);
  });

  it('does not re-warm a ready asset', async () => {
    await warmAssetUrl('/images/a.webp');
    await warmAssetUrl('/images/a.webp');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('marks an http failure as failed and keeps the original url for consumers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 })))
    );

    await warmAssetUrl('/images/missing.webp');

    const entry = useAssetCacheStore.getState().entries['/images/missing.webp'];
    expect(entry).toEqual({ status: 'failed', blobUrl: null });
  });

  it('removes the entry and rejects when the parent signal aborts', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', fetchRejectingOnAbort());

    const warmPromise = warmAssetUrl('/images/a.webp', { signal: controller.signal });
    controller.abort();

    await expect(warmPromise).rejects.toBeDefined();
    // Ожидание вызывающего обрывается сразу, а сама загрузка разматывается
    // следующим тиком - запись исчезает после неё, а не вместе с reject.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useAssetCacheStore.getState().entries['/images/a.webp']).toBeUndefined();
  });

  it('marks a timeout as failed instead of rejecting the batch', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', fetchRejectingOnAbort());

      const warmPromise = warmAssetUrl('/images/slow.webp', { timeoutMs: 1000 });
      const assertion = expect(warmPromise).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(1100);
      await assertion;

      expect(useAssetCacheStore.getState().entries['/images/slow.webp']).toEqual({
        status: 'failed',
        blobUrl: null,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('warmAssetUrl cross-origin branch', () => {
  beforeEach(() => {
    useAssetCacheStore.getState().reset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('bytes', { status: 200 })))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('warms a cross-origin url with an <img> instead of fetch', async () => {
    const imageLoader = vi.spyOn(globalThis, 'Image').mockImplementation(() => createMockImage());

    await warmAssetUrl('https://external.storage/sponsor.png');

    expect(imageLoader).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    // Blob недостижим для no-CORS хранилища: потребитель остаётся на исходном URL.
    const entry = useAssetCacheStore.getState().entries['https://external.storage/sponsor.png'];
    expect(entry).toEqual({ status: 'ready', blobUrl: null });
  });
});

describe('warmAssetUrl image strategy', () => {
  beforeEach(() => {
    useAssetCacheStore.getState().reset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('bytes', { status: 200 })))
    );
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-asset') });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('warms with an <img> instead of a second network request', async () => {
    const imageLoader = vi.spyOn(globalThis, 'Image').mockImplementation(() => createMockImage());

    await warmAssetUrl('/images/game/ball.webp', { strategy: 'image' });

    expect(imageLoader).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves no entry, so the same file can still be blob-warmed for another screen', async () => {
    vi.spyOn(globalThis, 'Image').mockImplementation(() => createMockImage());

    await warmAssetUrl('/images/game/laser.webp', { strategy: 'image' });
    expect(useAssetCacheStore.getState().entries['/images/game/laser.webp']).toBeUndefined();

    await warmAssetUrl('/images/game/laser.webp');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useAssetCacheStore.getState().entries['/images/game/laser.webp']).toEqual({
      status: 'ready',
      blobUrl: 'blob:mock-asset',
    });
  });
});

describe('warmAssetUrl shared cancellation', () => {
  beforeEach(() => {
    useAssetCacheStore.getState().reset();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-asset') });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the download alive while another caller still waits for it', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const abortSpy = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        init?.signal?.addEventListener('abort', abortSpy);

        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      })
    );

    // Клик по табу ограничен дедлайном, фоновый прогрев того же файла - нет.
    const impatient = new AbortController();
    const impatientWarm = warmAssetUrl('/images/shared.webp', { signal: impatient.signal });
    const patientWarm = warmAssetUrl('/images/shared.webp');

    impatient.abort();
    await expect(impatientWarm).rejects.toBeDefined();
    expect(abortSpy).not.toHaveBeenCalled();

    resolveFetch(new Response('bytes', { status: 200 }));
    await expect(patientWarm).resolves.toBeUndefined();
    expect(useAssetCacheStore.getState().entries['/images/shared.webp']).toEqual({
      status: 'ready',
      blobUrl: 'blob:mock-asset',
    });
  });

  it('aborts the download when the last waiter gives up', async () => {
    vi.stubGlobal('fetch', fetchRejectingOnAbort());
    const controller = new AbortController();

    const warmPromise = warmAssetUrl('/images/lonely.webp', { signal: controller.signal });
    controller.abort();

    await expect(warmPromise).rejects.toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useAssetCacheStore.getState().entries['/images/lonely.webp']).toBeUndefined();
  });
});

describe('warmAssets', () => {
  beforeEach(() => {
    useAssetCacheStore.getState().reset();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('bytes', { status: 200 })))
    );
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-asset'),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warms each unique url once and reports granular progress', async () => {
    const onProgress = vi.fn();
    const urls = ['/images/a.webp', '/images/a.webp', '/images/b.webp'];

    await warmAssets(urls, { onProgress });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });

  it('rejects when the parent signal aborts mid-batch', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', fetchRejectingOnAbort());

    const warmPromise = warmAssets(['/images/a.webp', '/images/b.webp'], {
      signal: controller.signal,
    });
    controller.abort();

    await expect(warmPromise).rejects.toBeDefined();
  });
});

describe('warmFontFaces', () => {
  it('loads each face via the CSS Font Loading API', async () => {
    const load = vi.fn(() => Promise.resolve([]));
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load },
    });

    await warmFontFaces([
      { family: 'Nunito', weight: 'normal' },
      { family: 'Nunito', weight: 'bold' },
    ]);

    expect(load).toHaveBeenCalledWith('normal 1rem Nunito');
    expect(load).toHaveBeenCalledWith('bold 1rem Nunito');
  });
});
