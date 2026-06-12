import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka, STAVY } from '../lib/helpers'
import { ziskejIban, spaydString } from '../lib/platba'
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
    if (fak.odberatel_id) {
      const { data: od } = await supabase.from('odberatele').select('*').eq('id', fak.odberatel_id).single()
      setOdberatel(od)
    }
    let u = null
    if (fak.bankovni_ucet_id) {
      const r = await supabase.from('bankovni_ucty').select('*').eq('id', fak.bankovni_ucet_id).single()
      u = r.data
      setUcet(u)
    }
    const { data: pol } = await supabase.from('polozky_faktury').select('*').eq('faktura_id', fakturaId).order('poradi')
    setPolozky(pol||[])

    // QR platba
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

      <div className="faktura-list">
        <div className="fak-head">
          <div>
            <div className="fak-title">FAKTURA</div>
            <div className="fak-cislo">č. {f.cislo||'(koncept)'}</div>
          </div>
        </div>

        <div className="fak-strany">
          <div>
            <div className="fak-label">Dodavatel</div>
            <strong>{firma.nazev}</strong><br/>
            {firma.ulice}<br/>{firma.psc} {firma.mesto}<br/>
            IČO: {firma.ico}{firma.dic?` · DIČ: ${firma.dic}`:''}<br/>
            {firma.email}
          </div>
          <div>
            <div className="fak-label">Odběratel</div>
            {odberatel ? (<>
              <strong>{odberatel.nazev}</strong><br/>
              {odberatel.ulice}<br/>{odberatel.psc} {odberatel.mesto}<br/>
              {odberatel.ico?`IČO: ${odberatel.ico}`:''}{odberatel.dic?` · DIČ: ${odberatel.dic}`:''}
            </>) : <span className="muted">—</span>}
          </div>
        </div>

        <div className="fak-meta">
          <div><span className="fak-label">Datum vystavení</span>{f.datum_vystaveni}</div>
          <div><span className="fak-label">Datum splatnosti</span>{f.datum_splatnosti}</div>
          <div><span className="fak-label">Variabilní symbol</span>{f.variabilni_symbol||'—'}</div>
          {ucet && <div><span className="fak-label">Bankovní účet</span>{ucet.cislo_uctu||ucet.iban}</div>}
        </div>

        <table className="fak-pol">
          <thead><tr><th>Popis</th><th>Množ.</th><th>MJ</th><th>Cena/ks</th><th>Celkem</th></tr></thead>
          <tbody>
            {polozky.map(p=>(
              <tr key={p.id}>
                <td>{p.popis}</td><td>{p.mnozstvi}</td><td>{p.jednotka}</td>
                <td>{formatCastka(p.cena_za_kus, f.mena)}</td>
                <td>{formatCastka(p.mezisoucet, f.mena)}</td>
              </tr>))}
          </tbody>
        </table>

        <div className="fak-platba">
          <div className="fak-celkem">Celkem k úhradě: <strong>{formatCastka(f.castka_celkem, f.mena)}</strong></div>
          {qrUrl && (
            <div className="fak-qr">
              <img src={qrUrl} alt="QR platba" width={130} height={130} />
              <div className="fak-qr-popis">QR platba<br/>naskenuj v bankovní aplikaci</div>
            </div>
          )}
        </div>

        {f.poznamka && <div className="fak-pozn">{f.poznamka}</div>}
        {firma.rejstrik_text && <div className="fak-paticka">{firma.rejstrik_text}</div>}
      </div>
    </>
  )
}
