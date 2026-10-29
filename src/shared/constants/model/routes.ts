export const SCREENS = {
  MAIN: '/',
  EDITOR: '/editor',
} as const;

export const ROUTES = SCREENS;

export type TRoute = (typeof ROUTES)[keyof typeof ROUTES];
export type TScreenRoute = TRoute;
