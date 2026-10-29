import { useWarmedAssetUrl } from '@/shared/lib/assetCache';
import { DecorativeLines } from './DecorativeLines';
import styles from './ModalHeroArt.module.scss';

interface IModalHeroArtProps {
  /** URL иллюстрации. Декоративная - в дерево доступности не попадает. */
  src: string;
}

/**
 * Иллюстрация в обрамлении декоративных полосок-лучей: «линии - арт - линии».
 * Общий блок `victory` (Figma `16448-14184`) и `collection-complete`
 * (Figma `16680-45568`) - в обоих макетах он совпадает один в один, поэтому
 * живёт здесь, рядом с `DecorativeLines`, а не копируется по вью вместе со
 * своим SCSS.
 *
 * URL читается прогретым: арт победы греется на старте партии
 * (`PARTY_RESULT_IMAGE_URLS`), и без blob-копии карточка качала бы его заново в
 * момент показа.
 */
export const ModalHeroArt = ({ src }: IModalHeroArtProps) => {
  const artUrl = useWarmedAssetUrl(src);

  return (
    <div className={styles.hero}>
      <DecorativeLines />

      <div className={styles.artWrap}>
        <img className={styles.art} src={artUrl} alt="" aria-hidden="true" />
      </div>

      <DecorativeLines mirrored />
    </div>
  );
};
