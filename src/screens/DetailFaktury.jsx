import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka, STAVY, formatDatum } from '../lib/helpers'
import { ziskejIban, spaydString } from '../lib/platba'
import { nazevBankyZUctu } from '../lib/banky'
import QRCode from 'qrcode'

export default function DetailFaktury({ fakturaId, onZpet, onUpravit }) {
  const [f, setF] = useState(null)
  const [firma, setFirma] = useState(null)
  const [odberatel, setOdberatel] = useState(null)
  const [ucet, setUcet] = useState(null)
  const [polozky, setPolozky] = useState([])
  const [qrUrl, setQrUrl] = useState(null)

  useEffect(() => { nacti() }, [fakturaId])
  async function nacti() {
    const { data: fak } = await supabase.from('faktury').select('*').eq('id', fakturaId).single()
    setF(fak)
    const { data: fi } = await supabase.from('firmy').select('*').eq('id', fak.firma_id).single()
    setFirma(fi)
    let od = null
    if (fak.odberatel_id) {
      const r = await supabase.from('odberatele').select('*').eq('id', fak.odberatel_id).single()
      od = r.data; setOdberatel(od)
    }
    let u = null
    if (fak.bankovni_ucet_id) {
      const r = await supabase.from('bankovni_ucty').select('*').eq('id', fak.bankovni_ucet_id).single()
      u = r.data; setUcet(u)
    }
    const { data: pol } = await supabase.from('polozky_faktury').select('*').eq('faktura_id', fakturaId).order('poradi')
    setPolozky(pol||[])

    try {
      const iban = ziskejIban(u)
      if (iban && fak.castka_celkem > 0) {
        const spayd = spaydString({
          iban, castka: fak.castka_celkem, mena: fak.mena,
          vs: fak.variabilni_symbol, msg: 'Faktura ' + (fak.cislo || '')
        })
        const url = await QRCode.toDataURL(spayd, { width: 220, margin: 1 })
        setQrUrl(url)
      } else { setQrUrl(null) }
    } catch (e) { setQrUrl(null) }
  }

  async function zmenStav(stav) {
    await supabase.from('faktury').update({ stav }).eq('id', fakturaId); nacti()
  }

  if (!f || !firma) return <div className="card"><div className="empty">Načítám…</div></div>

  // barva: faktura > klient > firma > výchozí
  const barva = f.barva_faktury || odberatel?.barva_faktury || firma.barva_faktury || '#0f766e'
  const textNaPruhu = (() => {
    const h = (barva || '').replace('#','')
    if (h.length < 6) return '#ffffff'
    const r = parseInt(h.substring(0,2),16)/255
    const g = parseInt(h.substring(2,4),16)/255
    const b = parseInt(h.substring(4,6),16)/255
    const lin = c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
    const L = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)
    return L > 0.55 ? '#1c2530' : '#ffffff'
  })()
  const ibanZobr = ucet ? (ucet.iban || ziskejIban(ucet) || ucet.cislo_uctu) : null
  const poznamkaNad = f.poznamka_nad || firma.poznamka_nad || 'Fakturuji částku, dle níže uvedeného rozpisu:'

  return (
    <>
      <div className="page-head no-print">
        <h1>Faktura {f.cislo||'(koncept)'}</h1>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-ghost" onClick={onZpet}>← Zpět</button>
          <button className="btn-ghost" onClick={()=>onUpravit(fakturaId)}>Upravit</button>
          <button className="btn-primary" onClick={()=>window.print()}>Stáhnout / Tisk PDF</button>
        </div>
      </div>

      <div className="no-print" style={{marginBottom:16,display:'flex',gap:8,alignItems:'center'}}>
        <span className="muted">Stav:</span>
        <span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span>
        {f.stav!=='zaplacena' && <button className="btn-ghost" onClick={()=>zmenStav('zaplacena')}>Označit jako zaplacenou</button>}
        {f.stav==='koncept' && <button className="btn-ghost" onClick={()=>zmenStav('vystavena')}>Označit jako vystavenou</button>}
      </div>

      <div className="fkt">
        <div className="fkt-top">
          <div className="fkt-dod">
            {firma.logo_data && <img src={firma.logo_data} alt="logo" className="fkt-logo" />}
            <div className="fkt-mini">DODAVATEL:</div>
            <div className="fkt-strong">{firma.nazev}</div>
            <div>{firma.ulice}</div>
            <div>{firma.psc} {firma.mesto}</div>
            <div>{firma.zeme}</div>
            <div style={{marginTop:8}}>IČ: {firma.ico}{firma.dic?` · DIČ: ${firma.dic}`:''}</div>
          </div>
          <div className="fkt-nazev">Faktura {f.cislo||'(koncept)'}</div>
        </div>

        <div className="fkt-mid">
          <div>
            {ucet && <>
              <div className="fkt-strong">{nazevBankyZUctu(ucet.cislo_uctu) ? `${nazevBankyZUctu(ucet.cislo_uctu)}: ${ucet.cislo_uctu}` : `${ucet.nazev||''}: ${ucet.cislo_uctu||ucet.iban}`}</div>
              {ibanZobr && <div className="fkt-small">IBAN: {ibanZobr}</div>}
            </>}
            <div style={{marginTop:8}}>Variabilní symbol: {f.variabilni_symbol||'—'}</div>
            <div>Způsob platby: Bankovním převodem</div>
          </div>
          <div>
            <div className="fkt-mini">ODBĚRATEL:</div>
            {odberatel ? (<>
              <div className="fkt-strong">{odberatel.nazev}</div>
              <div>{odberatel.ulice}</div>
              <div>{odberatel.psc} {odberatel.mesto}</div>
              {(odberatel.ico||odberatel.dic) && <div style={{marginTop:6}}>{odberatel.ico?`IČ: ${odberatel.ico}`:''}{odberatel.dic?` · DIČ: ${odberatel.dic}`:''}</div>}
            </>) : <span className="mu
