import { describe, expect, it } from 'vitest';
import { createRouteWithPreservedSearch } from './createRouteWithPreservedSearch';

describe('createRouteWithPreservedSearch', () => {
  it('adds current query params to the target route', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=scalar-dev-token&webview=true',
        currentHash: '',
        to: '/tasks',
      })
    ).toBe('/tasks?token=scalar-dev-token&webview=true');
  });

  it('lets target query params override current params', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=old-token&webview=true',
        currentHash: '',
        to: '/faq?token=new-token&section=rules',
      })
    ).toBe('/faq?token=new-token&webview=true&section=rules');
  });

  it('keeps the target hash after the merged query', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=scalar-dev-token',
        currentHash: '',
        to: '/journal#events',
      })
    ).toBe('/journal?token=scalar-dev-token#events');
  });

  it('carries the current hash when the target has none', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=scalar-dev-token',
        currentHash: '#events',
        to: '/journal',
      })
    ).toBe('/journal?token=scalar-dev-token#events');
  });

  it('lets the target hash override the current one', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '',
        currentHash: '#events',
        to: '/faq#rules',
      })
    ).toBe('/faq#rules');
  });

  it('drops the listed params inherited from the current query', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=scalar-dev-token&char=krosh&code=SCV58',
        currentHash: '',
        to: '/',
        dropSearchParams: ['char', 'code'],
      })
    ).toBe('/?token=scalar-dev-token');
  });

  it('keeps dropped params that the target route sets itself', () => {
    expect(
      createRouteWithPreservedSearch({
        currentSearch: '?token=scalar-dev-token&char=nush&code=OLD11',
        currentHash: '',
        to: '/share?char=krosh',
        dropSearchParams: ['char', 'code'],
      })
    ).toBe('/share?token=scalar-dev-token&char=krosh');
  });

  it('returns the target route unchanged when there is no query', () => {
    expect(
      createRouteWithPreservedSearch({ currentSearch: '', currentHash: '', to: '/main' })
    ).toBe('/main');
  });
});
