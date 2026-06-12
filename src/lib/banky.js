// Číselník kódů českých bank (ČNB) → název banky pro fakturu
export const KODY_BANK = {
  '0100': 'Komerční banka, a.s.',
  '0300': 'ČSOB, a.s.',
  '0600': 'MONETA Money Bank, a.s.',
  '0710': 'Česká národní banka',
  '0800': 'Česká spořitelna, a.s.',
  '2010': 'Fio banka, a.s.',
  '2060': 'Citfin, spořitelní družstvo',
  '2070': 'TRINITY BANK a.s.',
  '2100': 'Hypoteční banka, a.s.',
  '2200': 'Peněžní dům, spořitelní družstvo',
  '2250': 'Banka CREDITAS a.s.',
  '2260': 'NEY spořitelní družstvo',
  '2275': 'Podnikatelská družstevní záložna',
  '2600': 'Citibank Europe plc',
  '2700': 'UniCredit Bank Czech Republic and Slovakia, a.s.',
  '3030': 'Air Bank a.s.',
  '3050': 'BNP Paribas Personal Finance SA',
  '3060': 'PKO BP S.A.',
  '3500': 'ING Bank N.V.',
  '4000': 'Max banka a.s.',
  '4300': 'Národní rozvojová banka, a.s.',
  '5500': 'Raiffeisenbank a.s.',
  '5800': 'J&T BANKA, a.s.',
  '6000': 'PPF banka a.s.',
  '6100': 'Equa bank (Raiffeisenbank a.s.)',
  '6200': 'COMMERZBANK AG',
  '6210': 'mBank S.A.',
  '6300': 'BNP Paribas Fortis SA/NV',
  '6363': 'Partners Banka, a.s.',
  '6700': 'Všeobecná úverová banka a.s.',
  '6800': 'Sberbank CZ, a.s. v likvidaci',
  '7910': 'Deutsche Bank A.G.',
  '7950': 'Raiffeisen stavební spořitelna a.s.',
  '7960': 'ČSOB Stavební spořitelna, a.s.',
  '7970': 'MONETA Stavební Spořitelna, a.s.',
  '7990': 'Modrá pyramida stavební spořitelna, a.s.',
  '8030': 'Volksbank Raiffeisenbank Nordoberpfalz eG',
  '8040': 'Oberbank AG',
  '8060': 'Stavební spořitelna České spořitelny, a.s.',
  '8090': 'Česká exportní banka, a.s.',
  '8150': 'HSBC Continental Europe, Czech Republic',
  '8190': 'Sparkasse Oberlausitz-Niederschlesien',
  '8198': 'FAS finance company s.r.o.',
  '8199': 'MoneyPolo Europe s.r.o.',
  '8200': 'PRIVAT BANK der Raiffeisenlandesbank OÖ',
  '8255': 'Bank of China (CEE) Ltd. Prague Branch',
  '8265': 'Industrial and Commercial Bank of China',
  '8270': 'Fairplay Pay s.r.o.',
  '8280': 'B-Efficient a.s.',
}

// Vytáhne kód banky z čísla účtu (část za lomítkem)
export function kodZUctu(cisloUctu) {
  if (!cisloUctu) return null
  const m = String(cisloUctu).match(/\/(\d{4})\s*$/)
  return m ? m[1] : null
}

// Vrátí název banky podle čísla účtu (nebo null)
export function nazevBankyZUctu(cisloUctu) {
  const kod = kodZUctu(cisloUctu)
  return kod ? (KODY_BANK[kod] || null) : null
}
