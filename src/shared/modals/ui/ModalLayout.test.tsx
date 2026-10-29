import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import styles from './styles.module.scss';
import { ModalLayout } from './ModalLayout';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('ModalLayout', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders the dialog with a single interactive wrap', () => {
    act(() => {
      root.render(
        <ModalLayout isOpened animateHeight={false}>
          <button type="button">Действие карточки</button>
        </ModalLayout>
      );
    });

    const wrap = container.querySelector(`.${styles.wrap}`);

    expect(wrap).not.toBeNull();
  });
});
