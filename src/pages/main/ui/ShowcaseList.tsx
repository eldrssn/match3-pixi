import { useId } from 'react';
import { SHOWCASE_GROUP_TITLES, SHOWCASE_GROUPS, SHOWCASE_LEVELS } from '@/entities/level';
import { prefetchGameScreenChunk } from '@/widgets/game';
import { useMainFlowStore } from '../model/useMainFlowStore';
import { MAIN_TEXTS } from '../texts';
import styles from './ShowcaseList.module.scss';

/**
 * Витрина механик: по уровню на каждый блокер, спецфишку и комбинацию,
 * сгруппированные списком. Тап - сразу партия (`playShowcase`), без карточки
 * уровня: что показывает уровень, написано в строке списка.
 */
export const ShowcaseList = () => {
  const playShowcase = useMainFlowStore((state) => state.playShowcase);
  const closeShowcase = useMainFlowStore((state) => state.closeShowcase);
  const titleId = useId();

  return (
    <section className={styles.showcase} aria-labelledby={titleId}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={closeShowcase}>
          {MAIN_TEXTS.back}
        </button>
        <h2 id={titleId} className={styles.title}>
          {MAIN_TEXTS.showcase.title}
        </h2>
      </header>

      <div className={styles.groups}>
        {SHOWCASE_GROUPS.map((group) => (
          <section key={group} className={styles.group} aria-label={SHOWCASE_GROUP_TITLES[group]}>
            <h3 className={styles.groupTitle}>{SHOWCASE_GROUP_TITLES[group]}</h3>
            <ul className={styles.list}>
              {SHOWCASE_LEVELS.filter((entry) => entry.group === group).map((entry) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    className={styles.item}
                    onPointerDown={() => {
                      prefetchGameScreenChunk();
                    }}
                    onClick={() => playShowcase(entry.key)}
                  >
                    <span className={styles.itemTitle}>{entry.title}</span>
                    <span className={styles.itemHint}>{entry.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
};
