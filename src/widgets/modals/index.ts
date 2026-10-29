export { MODAL_KEYS, type TModalKey } from './model/modal-registry';
export {
  modalsSelectors,
  useHideModal,
  useHideModals,
  useIsModalMounted,
  useIsModalShowed,
  useHasMountedModals,
  useModalProps,
  useModalsStore,
  useShowModal,
  type IGameResultModalProps,
  type ILevelStartModalProps,
  type IOutOfMovesModalProps,
  type TModalPropsMap,
} from './model/useModalsStore';
// Предзагрузка чанка модалки нужна снаружи: главная (`pages/main`) догревает
// `victory`/`defeat` на старте партии.
export { prefetchModalChunk } from './ui/modalChunks';
export { ModalsProvider } from './ui/ModalsProvider';
