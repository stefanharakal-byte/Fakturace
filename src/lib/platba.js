// Generování QR platby (SPAYD) pro českou QR Platbu

// Český IBAN z čísla účtu ve formátu [predcisli-]cislo/kodbanky
export function cisloNaIban(vstup) {
  if (!vstup) return null
  const s = String(vstup).replace(/\s/g, '')
  const m = s.match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/)
  if (!m) return null
  const predcisli = (m[1] || '').padStart(6, '0')
  const cislo = m[2].padStart(10, '0')
  const banka = m[3]
  const bban = banka + predcisli + cislo
  const numeric = bban + '123500'
  let zbytek = 0
  for (const ch of numeric) zbytek = (zbytek * 10 + Number(ch)) % 97
  const kontrolni = 98 - zbytek
  return 'CZ' + String(kontrolni).padStart(2, '0') + bban
}

// Vrátí IBAN: nejdřív ruční (pokud vyplněn), jinak dopočítá z čísla účtu
export function ziskejIban(ucet) {
  if (!ucet) return null
  if (ucet.iban && ucet.iban.trim()) return ucet.iban.replace(/\s/g, '')
  return cisloNaIban(ucet.cislo_uctu)
}

// SPAYD řetězec pro QR
export function spaydString({ iban, castka, mena, vs, msg }) {
  if (!iban) return null
  let s = `SPD*1.0*ACC:${iban}*AM:${Number(castka).toFixed(2)}*CC:${mena || 'CZK'}`
  if (vs) s += `*X-VS:${String(vs).replace(/\D/g, '')}`
  if (msg) s += `*MSG:${String(msg).toUpperCase().replace(/[*]/g, '')}`
  return s
}
