// Pomocné funkce pro celou aplikaci

export function formatCastka(c, mena = 'CZK') {
  const n = Number(c || 0)
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + mena
}

export function dnes() {
  return new Date().toISOString().slice(0, 10)
}

export function pridejDny(datum, dny) {
  const d = new Date(datum)
  d.setDate(d.getDate() + Number(dny || 0))
  return d.toISOString().slice(0, 10)
}

// Sestaví číslo faktury z formátu řady.
// Proměnné: {RRRR} rok, {MM} měsíc, {NN}/{NNN}/{NNNN} pořadí s nulami
export function sestavCislo(format, rok, mesic, poradi) {
  let s = format || '{RRRR}{MM}{NN}'
  s = s.replace('{RRRR}', String(rok))
  s = s.replace('{MM}', String(mesic).padStart(2, '0'))
  s = s.replace(/\{(N+)\}/, (_m, n) => String(poradi).padStart(n.length, '0'))
  return s
}

// Součet položek (neplátce DPH = bez DPH)
export function spoctiFakturu(polozky) {
  let celkem = 0
  for (const p of polozky) {
    const mn = Number(p.mnozstvi || 0)
    const cena = Number(p.cena_za_kus || 0)
    const sleva = Number(p.sleva || 0)
    const radek = mn * cena * (1 - sleva / 100)
    celkem += radek
  }
  return Math.round(celkem * 100) / 100
}

export const STAVY = {
  koncept: 'Koncept',
  vystavena: 'Vystavená',
  odeslana: 'Odeslaná',
  zaplacena: 'Zaplacená',
  po_splatnosti: 'Po splatnosti',
  stornovana: 'Stornovaná',
}

// Datum z ISO (2026-06-11) na český formát (11.06.2026)
export function formatDatum(iso) {
  if (!iso) return '—'
  const s = String(iso).slice(0, 10)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}
