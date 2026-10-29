import { useEffect, useState } from 'react';

const BASE_Z_INDEX = 1000;
const STEP = 10;

const activeLevels = new Set<number>();

const allocateLevel = (): number => {
  let max = BASE_Z_INDEX;
  for (const level of activeLevels) {
    if (level > max) {
      max = level;
    }
  }

  const level = max + STEP;
  activeLevels.add(level);
  return level;
};

export const useModalStackZIndex = (): { overlay: number; wrap: number } => {
  const [level] = useState(allocateLevel);

  useEffect(() => {
    return () => {
      activeLevels.delete(level);
    };
  }, [level]);

  return { overlay: level, wrap: level + 2 };
};
