export interface FrenchHoliday {
  date: Date;
  name: string;
}

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getFrenchHolidays(year: number): FrenchHoliday[] {
  const easter = getEasterDate(year);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);

  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  return [
    { date: new Date(year, 0, 1), name: 'Nouvel An' },
    { date: easterMonday, name: 'Lundi de Pâques' },
    { date: new Date(year, 4, 1), name: 'Fête du Travail' },
    { date: new Date(year, 4, 8), name: 'Victoire 1945' },
    { date: ascension, name: 'Ascension' },
    { date: whitMonday, name: 'Lundi de Pentecôte' },
    { date: new Date(year, 6, 14), name: 'Fête Nationale' },
    { date: new Date(year, 7, 15), name: 'Assomption' },
    { date: new Date(year, 10, 1), name: 'Toussaint' },
    { date: new Date(year, 10, 11), name: 'Armistice' },
    { date: new Date(year, 11, 25), name: 'Noël' },
  ];
}

export function getHolidayForDate(date: Date): FrenchHoliday | null {
  const holidays = getFrenchHolidays(date.getFullYear());
  return holidays.find(h =>
    h.date.getDate() === date.getDate() &&
    h.date.getMonth() === date.getMonth()
  ) ?? null;
}
