import { GuardedMap, IReadonlyGuardedMap } from '../@types';

const dict: [string, string][] = [
  ['А', 'A'], ['а', 'a'],
  ['Б', 'B'], ['б', 'b'],
  ['В', 'V'], ['в', 'v'],
  ['Г', 'H'], ['г', 'h'],
  ['Ґ', 'G'], ['ґ', 'g'],
  ['Д', 'D'], ['д', 'd'],
  ['Е', 'E'], ['е', 'e'],
  ['Э', 'E'], ['э', 'e'], // на случай если в транслитерации присутствуют русские символы
  ['Є', 'Ye'], ['є', 'ie'],
  ['Ж', 'Zh'], ['ж', 'zh'],
  ['З', 'Z'], ['з', 'z'],
  ['И', 'Y'], ['и', 'y'],
  ['Ы', 'Y'], ['ы', 'y'], // на случай если в транслитерации присутствуют русские символы
  ['І', 'I'], ['і', 'i'],
  ['Ї', 'Yi'], ['ї', 'i'],
  ['Й', 'Y'], ['й', 'i'],
  ['К', 'K'], ['к', 'k'],
  ['Л', 'L'], ['л', 'l'],
  ['М', 'M'], ['м', 'm'],
  ['Н', 'N'], ['н', 'n'],
  ['О', 'O'], ['о', 'o'],
  ['П', 'P'], ['п', 'p'],
  ['Р', 'R'], ['р', 'r'],
  ['С', 'S'], ['с', 's'],
  ['Т', 'T'], ['т', 't'],
  ['У', 'U'], ['у', 'u'],
  ['Ф', 'F'], ['ф', 'f'],
  ['Х', 'Kh'], ['х', 'kh'],
  ['Ц', 'Ts'], ['ц', 'ts'],
  ['Ч', 'Ch'], ['ч', 'ch'],
  ['Ш', 'Sh'], ['ш', 'sh'],
  ['Щ', 'Shch'], ['щ', 'shch'],
  ['Ю', 'Yu'], ['ю', 'iu'],
  ['Я', 'Ya'], ['я', 'ia'],
  ['Ь', ''], ['ь', ''],
  ['\'', ''], ['"', ''], ['`', ''],
];
const cyrillicToEnglish: IReadonlyGuardedMap<string, string> = new GuardedMap(
  dict
);

export function toTranslit(
  value: string,
  lengthLimit = Number.MAX_SAFE_INTEGER,
) {
  let newValueLength = 0;
  const newValue = [];
  for (const c of value) {
    const transliterated = cyrillicToEnglish.has(c)
      ? cyrillicToEnglish.get(c)
      : c;
    newValue.push(transliterated);
    newValueLength += transliterated.length;
    if (newValueLength > lengthLimit) {
      return newValue.join('').slice(0, lengthLimit);
    }
    if (newValueLength === lengthLimit) {
      return newValue.join('');
    }
  }
  return newValue.join('');
}
