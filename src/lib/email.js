// Sestavení e-mailu z šablony s proměnnými + mailto odkaz
import { formatCastka, formatDatum } from './helpers'
import { cisloNaIban } from './platba'
import { nazevBankyZUctu } from './banky'

// Nahradí proměnné #...# skutečnými hodnotami z faktury
export function naplnSablonu(text, { faktura, firma, odberatel, ucet }) {
  if (!text) return ''
  const iban = ucet ? (ucet.iban || cisloNaIban(ucet.cislo_uctu) || '') : ''
  const mapa = {
    '#CISLO#': faktura.cislo || '',
    '#SUMA#': formatCastka(faktura.castka_celkem, faktura.mena),
    '#VAR#': faktura.variabilni_symbol || '',
    '#SPLATNOST#': formatDatum(faktura.datum_splatnosti),
    '#UCET#': ucet ? (ucet.cislo_uctu || ucet.iban || '') : '',
    '#IBAN#': iban,
    '#BANKA#': ucet ? (nazevBankyZUctu(ucet.cislo_uctu) || '') : '',
    '#MOJE_FIRMA#': firma?.nazev || '',
    '#NAZEV_ODBERATELE#': odberatel?.nazev || '',
    '#ZPUSOB_PLATBY#': 'Bankovním převodem',
  }
  let s = text
  for (const [k, v] of Object.entries(mapa)) {
    s = s.split(k).join(v)
  }
  return s
}

// Sestaví mailto: odkaz (otevře e-mailový klient s předvyplněným mailem)
export function mailtoOdkaz({ prijemce, predmet, telo }) {
  const params = []
  if (predmet) params.push('subject=' + encodeURIComponent(predmet))
  if (telo) params.push('body=' + encodeURIComponent(telo))
  return `mailto:${prijemce || ''}${params.length ? '?' + params.join('&') : ''}`
}
