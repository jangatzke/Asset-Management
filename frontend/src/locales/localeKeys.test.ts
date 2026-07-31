/// <reference types="vitest" />
import en from './en.json';
import de from './de.json';

declare const test: typeof import('vitest').test;
declare const expect: typeof import('vitest').expect;

const resolveKey = (source: Record<string, any>, key: string) => key.split('.').reduce<any>((value, part) => value?.[part], source);

test('risk list locale keys resolve to translated strings', () => {
  for (const locale of [en, de]) {
    expect(resolveKey(locale, 'risks.title')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.title')).not.toBe('risks.title');
    expect(resolveKey(locale, 'risks.searchPlaceholder')).toEqual(expect.any(String));
    expect(resolveKey(locale, 'risks.searchPlaceholder')).not.toBe('risks.searchPlaceholder');
  }
});
