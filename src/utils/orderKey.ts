/**
 * Утилиты для генерации orderKey (фракционное упорядочивание)
 * Использует Base36 для генерации лексикографически упорядоченных строк
 * между двумя позициями без необходимости переиндексации
 */

const BASE = 36;
const INITIAL_ORDER_KEY = 'n'; // Середина алфавита base36

/**
 * Генерирует orderKey между двумя существующими ключами
 * @param before - OrderKey предыдущего элемента (или undefined для начала)
 * @param after - OrderKey следующего элемента (или undefined для конца)
 * @returns Новый orderKey между before и after
 */
export function generateOrderKey(before?: string, after?: string): string {
  // Если нет ни before, ни after - возвращаем начальный ключ
  if (!before && !after) {
    return INITIAL_ORDER_KEY;
  }

  // Если нет before - генерируем ключ перед after
  if (!before) {
    return getKeyBefore(after!);
  }

  // Если нет after - генерируем ключ после before
  if (!after) {
    return getKeyAfter(before);
  }

  // Генерируем ключ между before и after
  return getKeyBetween(before, after);
}

/**
 * Генерирует orderKey перед указанным ключом
 */
function getKeyBefore(key: string): string {
  // Берем первый символ и уменьшаем его
  const firstChar = key.charCodeAt(0);
  
  if (firstChar > 'a'.charCodeAt(0)) {
    // Если не первый символ алфавита, просто уменьшаем
    const midChar = String.fromCharCode(Math.floor((('a'.charCodeAt(0) - 1) + firstChar) / 2));
    return midChar + (midChar === String.fromCharCode(firstChar - 1) ? 'n' : '');
  }
  
  // Если первый символ 'a', добавляем символы в конец
  return 'a' + getKeyBefore('n');
}

/**
 * Генерирует orderKey после указанного ключа
 */
function getKeyAfter(key: string): string {
  // Берем последний символ и увеличиваем его
  const lastChar = key.charCodeAt(key.length - 1);
  
  if (lastChar < 'z'.charCodeAt(0)) {
    // Если не последний символ алфавита, просто увеличиваем
    const midChar = String.fromCharCode(Math.floor((lastChar + ('z'.charCodeAt(0) + 1)) / 2));
    return key.slice(0, -1) + midChar + (midChar === String.fromCharCode(lastChar + 1) ? 'n' : '');
  }
  
  // Если последний символ 'z', добавляем новый символ
  return key + 'n';
}

/**
 * Генерирует orderKey между двумя ключами
 */
function getKeyBetween(before: string, after: string): string {
  // Нормализуем длины строк
  const maxLen = Math.max(before.length, after.length);
  const beforePadded = before.padEnd(maxLen, '0');
  const afterPadded = after.padEnd(maxLen, '0');
  
  // Ищем первую позицию, где символы различаются
  let pos = 0;
  while (pos < maxLen && beforePadded[pos] === afterPadded[pos]) {
    pos++;
  }
  
  // Если строки идентичны, добавляем символ в конец
  if (pos === maxLen) {
    return before + 'n';
  }
  
  const beforeChar = beforePadded.charCodeAt(pos);
  const afterChar = afterPadded.charCodeAt(pos);
  
  // Если разница больше 1, можем вставить символ между ними
  if (afterChar - beforeChar > 1) {
    const midChar = String.fromCharCode(Math.floor((beforeChar + afterChar) / 2));
    return beforePadded.slice(0, pos) + midChar;
  }
  
  // Если разница равна 1, нужно продолжить дальше
  const result = beforePadded.slice(0, pos + 1);
  const remainingBefore = pos + 1 < beforePadded.length ? beforePadded.slice(pos + 1) : '';
  const remainingAfter = pos + 1 < afterPadded.length ? afterPadded.slice(pos + 1) : 'z'.repeat(beforePadded.length - pos - 1);
  
  if (remainingAfter) {
    return result + getKeyBetween(remainingBefore || '0', remainingAfter);
  }
  
  return result + 'n';
}

/**
 * Сравнивает два orderKey для сортировки
 * @returns -1 если a < b, 0 если a === b, 1 если a > b
 */
export function compareOrderKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Генерирует начальные orderKey для массива элементов
 * Используется при первой миграции или создании новых колонок
 */
export function generateInitialOrderKeys(count: number): string[] {
  if (count === 0) return [];
  if (count === 1) return [INITIAL_ORDER_KEY];
  
  const keys: string[] = [];
  let currentKey = INITIAL_ORDER_KEY;
  
  // Генерируем первый ключ
  keys.push(getKeyBefore(currentKey));
  
  // Генерируем средний ключ
  if (count > 2) {
    keys.push(currentKey);
  }
  
  // Генерируем остальные ключи
  for (let i = keys.length; i < count; i++) {
    currentKey = getKeyAfter(currentKey);
    keys.push(currentKey);
  }
  
  return keys;
}

/**
 * Валидация orderKey
 */
export function isValidOrderKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  // Проверяем, что строка содержит только допустимые символы base36
  return /^[0-9a-z]+$/.test(key);
}
