export const MODALS_CONTAINER_ID = 'modals';

/**
 * Корень React-приложения. Пока открыта модалка, он помечается `inert`, чтобы
 * фон не был доступен ни с клавиатуры, ни скринридеру: сам слой модалок висит
 * отдельным узлом в `body` и под `inert` не попадает.
 */
export const APP_ROOT_ID = 'root';
