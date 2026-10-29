/**
 * Dev/QA переключатель `?level=N`: с какого уровня «Играть» начинает партию.
 *
 * Проверить уровень N без двадцати побед перед ним QA должен уметь без
 * прохождения. Флаг читает хост партии (`pages/main`) на каждом «Играть» с
 * главной; «Дальше» после победы ведёт уже к следующему уровню.
 *
 * Флаг со значением: пустой, нечисловой или неположительный `?level`
 * игнорируется - молча подменять уровень из-за опечатки нельзя. Как и у
 * остальных query-флагов (`readQueryGameDebug`), трактовка строки запроса в
 * проекте одна и живёт здесь. Границу каталога проверяет хост: `shared` про
 * уровни не знает.
 */
export const readQueryLevel = (search = window.location.search): number | null => {
  const raw = new URLSearchParams(search).get('level');

  if (raw === null) {
    return null;
  }

  const levelNumber = Number(raw.trim());

  return Number.isInteger(levelNumber) && levelNumber > 0 ? levelNumber : null;
};
