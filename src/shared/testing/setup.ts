import '@testing-library/jest-dom';
import { installMemoryStorage } from './memoryStorage';

installMemoryStorage('localStorage');
installMemoryStorage('sessionStorage');

// jsdom без пакета `canvas` не умеет `getContext` и на каждый вызов пишет
// «Not implemented» со стеком в консоль. Pixi на импорте пробует 2D-контекст
// (проверка режимов наложения) и обходится без него - тесты рантайма
// импортируют классы доски, а не рисуют. Ответ `null` - честное «контекста
// нет», тот же исход, что у jsdom, только без шума.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext'];
}
