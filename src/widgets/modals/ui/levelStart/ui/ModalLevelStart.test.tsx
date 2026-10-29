import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalHostContext } from '@/shared/modals/ui/ModalHostContext';
import { MODAL_KEYS } from '../../../model/modal-registry';
import { useModalsStore, type ILevelStartModalProps } from '../../../model/useModalsStore';
import { ModalLevelStart } from './ModalLevelStart';

const buildProps = (levelNumber: number): ILevelStartModalProps => ({
  levelNumber,
  moves: 20,
  goals: [],
  preBoosterOptions: ['laser', 'bomb', 'rainbow'],
  onStart: vi.fn(),
  onClose: vi.fn(),
});

describe('ModalLevelStart', () => {
  let host: HTMLDivElement;

  const withHost = ({ children }: { children: ReactNode }) => (
    <ModalHostContext.Provider value={host}>{children}</ModalHostContext.Provider>
  );

  beforeEach(() => {
    // Примитив `Modal` анимирует высоту карточки по `ResizeObserver`, которого
    // в jsdom нет; самой высоте здесь проверять нечего.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    host = document.createElement('div');
    document.body.appendChild(host);
    useModalsStore.setState({ modals: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    host.remove();
  });

  it('не переносит выбор бустеров на следующий показ карточки', () => {
    const first = buildProps(3);

    act(() => useModalsStore.getState().show(MODAL_KEYS.LEVEL_START, first));
    const { rerender } = render(<ModalLevelStart isOpened />, { wrapper: withHost });

    fireEvent.click(screen.getByRole('button', { name: /Бомба/ }));
    expect(screen.getByRole('button', { name: /Бомба/ }).getAttribute('aria-pressed')).toBe('true');

    // Карточку закрыли и сразу открыли для другого уровня: экземпляр вью тот
    // же (exit-анимация не доиграла), пропсы - новые.
    const second = buildProps(5);

    act(() => {
      useModalsStore.getState().hide(MODAL_KEYS.LEVEL_START);
      useModalsStore.getState().show(MODAL_KEYS.LEVEL_START, second);
    });
    rerender(<ModalLevelStart isOpened />);

    expect(screen.getByRole('button', { name: /Бомба/ }).getAttribute('aria-pressed')).toBe(
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Играть' }));
    expect(second.onStart).toHaveBeenCalledWith([]);
  });
});
