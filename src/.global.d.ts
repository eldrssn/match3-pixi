declare module '*.module.scss' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.svg?react' {
  import type { FC, SVGProps } from 'react';
  const ReactComponent: FC<SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

interface Window {
  webkit?: {
    messageHandlers?: {
      events?: {
        postMessage?: (message: string) => void;
      };
    };
  };
  Android?: {
    postMessage?: (message: string) => void;
  };
  handleMobileMessage?: (message: unknown) => void;
}
