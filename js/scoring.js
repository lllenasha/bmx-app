// ===== js/scoring.js =====
// Движок подсчёта очков и мест для BMX

/**
 * Стандартные стартовые позиции для классики (8 участников, 3 мото)
 * [мото1, мото2, мото3] — стартовая дорожка в каждом заезде
 */
export const STANDARD_POSITIONS_8 = [
  [8, 2, 3],
  [7, 6, 3],
  [6, 3, 1],
  [5, 1, 8],
  [4, 8, 5],
  [3, 5, 7],
  [2, 7, 4],
  [1, 4, 6],
];

export const STANDARD_POSITIONS_4 = [
  [4, 2, 3],
  [3, 4, 1],
  [2, 1, 4],
  [1, 3, 2],
];

/**
 * Для пустого мото-заезда (участник не стартовал) — штрафные очки
 */
export const DNS_SCORE = 8;

/**
 * Подсчитать очки одного участника за все мото.
 *
 * Правило:
 *  - Каждая позиция на финише — очки (1-е место = 1 очко, 2-е = 2, ..., 8-е = 8).
 *  - Если участник не стартовал/не финишировал (0 или '') в мото, где он есть в других мото → штраф DNS_SCORE.
 *  - Итоговая сумма = сумма трёх мото.
 *
 * @param {string|number} m1 — результат мото 1 (позиция 1..8 или '' / 0)
 * @param {string|number} m2 — результат мото 2
 * @param {string|number} m3 — результат мото 3
 * @returns {{ moto: number[], total: number, hasData: boolean }}
 */
export function calcParticipantScore(m1, m2, m3) {
  const parse = v => {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  };

  const raw = [parse(m1), parse(m2), parse(m3)];
  const hasData = raw.some(v => v > 0);

  if (!hasData) {
    return { moto: [0, 0, 0], total: 0, hasData: false };
  }

  // Применяем штраф DNS за пустые мото, если есть хоть один результат
  const moto = raw.map(v => (v === 0 ? DNS_SCORE : v));
  const total = moto.reduce((a, b) => a + b, 0);

  return { moto, total, hasData: true };
}

/**
 * Рассчитать места для массива участников заезда.
 *
 * @param {Array<{slot, number, moto1, moto2, moto3, name, organization}>} participants
 * @returns {Array} тот же массив, обогащённый полями: score, total, place
 */
export function calcPlaces(participants) {
  // 1) Считаем очки
  const scored = participants.map(p => {
    const { moto, total, hasData } = calcParticipantScore(p.moto1, p.moto2, p.moto3);
    return {
      ...p,
      scoredMoto: moto,
      total,
      hasData
    };
  });

  // 2) Разделяем участников с данными и без
  const active  = scored.filter(p => p.hasData && p.number);
  const passive = scored.filter(p => !p.hasData || !p.number);

  // 3) Сортировка: меньше очков → лучше место
  //    При ничьей: лучший результат в мото 3 (меньше)
  //    При повторной ничьей: лучший результат в мото 2
  active.sort((a, b) => {
    if (a.total !== b.total) return a.total - b.total;
    const a3 = a.scoredMoto[2]; const b3 = b.scoredMoto[2];
    if (a3 !== b3) return a3 - b3;
    const a2 = a.scoredMoto[1]; const b2 = b.scoredMoto[1];
    return a2 - b2;
  });

  // 4) Присваиваем места с учётом ничьих
  let currentPlace = 1;
  for (let i = 0; i < active.length; i++) {
    if (i > 0) {
      const prev = active[i - 1];
      const curr = active[i];
      const sameTotal = prev.total === curr.total;
      const sameMoto3 = prev.scoredMoto[2] === curr.scoredMoto[2];
      const sameMoto2 = prev.scoredMoto[1] === curr.scoredMoto[1];
      if (!(sameTotal && sameMoto3 && sameMoto2)) {
        currentPlace = i + 1;
      }
    }
    active[i].place = currentPlace;
  }

  // 5) Пассивным участникам — нет места
  passive.forEach(p => { p.place = null; });

  // 6) Возвращаем в исходном порядке (по slot)
  const result = [...active, ...passive];
  result.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

  return result;
}

/**
 * Форматировать очки для отображения
 */
export function formatScore(score, hasData) {
  if (!hasData) return '—';
  return String(score);
}

/**
 * Метка места для отображения
 */
export function placeLabel(place) {
  if (place === null || place === undefined) return '—';
  if (place === 1) return '🥇 1';
  if (place === 2) return '🥈 2';
  if (place === 3) return '🥉 3';
  return String(place);
}

/**
 * CSS-класс для значка места
 */
export function placeBadgeClass(place) {
  if (!place) return 'place-other';
  if (place === 1) return 'place-1';
  if (place === 2) return 'place-2';
  if (place === 3) return 'place-3';
  return 'place-other';
}
