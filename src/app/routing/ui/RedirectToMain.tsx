import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/shared/constants';

export const RedirectToMain = () => {
  const { search, hash } = useLocation();

  return <Navigate to={{ pathname: ROUTES.MAIN, search, hash }} replace />;
};
