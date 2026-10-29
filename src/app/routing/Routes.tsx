import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';
import { Main } from '@/pages/main';
import { RedirectToMain } from './ui/RedirectToMain';
import { RouteBootstrapSuspense } from './ui/RouteBootstrapSuspense';

// Редактор - инструмент геймдизайнера, поэтому приезжает отдельным чанком
// только при заходе на маршрут, а без флага сборки (`VITE_ENABLE_EDITOR`)
// его нет вовсе: константа `false` выкидывает ленивый импорт из бандла, и
// `/editor` уходит в fallback на главную.
const EditorPage = __EDITOR_ENABLED__ ? lazy(() => import('@/pages/editor/EditorPage')) : null;

/**
 * Маршрутов два: главная (она же хост партии) и редактор уровней (только со
 * включённым флагом). Неизвестный путь уводит на главную с сохранением query.
 */
export const AppRoutes = () => (
  <Routes>
    <Route path={ROUTES.MAIN} element={<Main />} />
    {EditorPage ? (
      <Route
        path={ROUTES.EDITOR}
        element={
          <RouteBootstrapSuspense>
            <EditorPage />
          </RouteBootstrapSuspense>
        }
      />
    ) : null}
    <Route path="*" element={<RedirectToMain />} />
  </Routes>
);
