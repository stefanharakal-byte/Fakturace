import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka, STAVY, formatDatum } from '../lib/helpers'
import { ziskejIban, spaydString } from '../lib/platba'
import { nazevBankyZUctu } from '../lib/banky'
import { naplnSablonu, mailtoOdkaz } from '../lib/email'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function DetailFaktury({ fakturaId, onZpet, onUpravit }) {
  const [f, setF] = useState(null)
  const [firma, setFirma] = useState(null)
  const [odberatel, setOdberatel] = useState(null)
  const [ucet, setUcet] = useState(null)
  const [polozky, setPolozky] = useState([])
  const [qrUrl, setQrUrl] = useState(null)
  const [odesilam, setOdesilam] = useState(false)
  const [odeslMsg, setOdeslMsg] = useState(null)

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

  // Záložní možnost: otevřít e-mail v klientu (mailto, bez PDF)
  function otevritVKlientu() {
    const predmet = naplnSablonu(firma.email_predmet || 'Faktura #CISLO#', { faktura: f, firma, odberatel, ucet })
    const telo = naplnSablonu(firma.email_text || '', { faktura: f, firma, odberatel, ucet })
    window.location.href = mailtoOdkaz({ prijemce: odberatel?.email || '', predmet, telo })
  }

  // Hlavní odeslání: vyrobí PDF z náhledu a odešle přes Edge Function (Resend)
  async function odeslatEmail() {
    setOdeslMsg(null)
    if (!odberatel?.email) { setOdeslMsg({ type:'err', text:'Odběratel nemá vyplněný e-mail (doplň ho v Odběratelích).' }); return }
    const odesilatel = firma.email_odesilatel
    if (!odesilatel) { setOdeslMsg({ type:'err', text:'Není nastavena odesílací adresa (Nastavení → E-maily).' }); return }

    setOdesilam(true)
    try {
      const el = document.getElementById('faktura-pdf')
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const sirka = 210
      const vyska = (canvas.height * sirka) / canvas.width
      pdf.addImage(img, 'PNG', 0, 0, sirka, Math.min(vyska, 297))
      const pdfBase64 = pdf.output('datauristring').split(',')[1]

      const predmet = naplnSablonu(firma.email_predmet || 'Faktura #CISLO#', { faktura: f, firma, odberatel, ucet })
      const telo = naplnSablonu(firma.email_text || '', { faktura: f, firma, odberatel, ucet })
      const nazevSouboru = `Faktura_${f.cislo || ''}.pdf`
      const qrBase64 = qrUrl ? qrUrl.split(',')[1] : null

      const { data, error } = await supabase.functions.invoke('odeslat-fakturu', {
        body: { prijemce: odberatel.email, predmet, telo, pdfBase64, nazevSouboru, odesilatel, qrBase64 },
      })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || 'Odeslání selhalo.')

      setOdeslMsg({ type:'ok', text:`E-mail odeslán na ${odberatel.email}.` })
      if (f.stav !== 'zaplacena') zmenStav('odeslana')
    } catch (e) {
      setOdeslMsg({ type:'err', text: 'Chyba odeslání: ' + (e.message || e) })
    } finally {
      setOdesilam(false)
    }
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
          <button className="btn-primary" onClick={odeslatEmail} disabled={odesilam}>{odesilam?'Odesílám…':'✉ Odeslat e-mailem'}</button>
          <button className="btn-ghost" onClick={()=>window.print()}>Tisk PDF</button>
        </div>
      </div>

      <div className="no-print" style={{marginBottom:16,display:'flex',gap:8,alignItems:'center'}}>
        <span className="muted">Stav:</span>
        <span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span>
        {f.stav!=='zaplacena' && <button className="btn-ghost" onClick={()=>zmenStav('zaplacena')}>Označit jako zaplacenou</button>}
        {f.stav==='koncept' && <button className="btn-ghost" onClick={()=>zmenStav('vystavena')}>Označit jako vystavenou</button>}
      </div>

      {odeslMsg && <div className={`msg ${odeslMsg.type} no-print`} style={{marginBottom:16}}>{odeslMsg.text}
        {odeslMsg.type==='err' && <> <button className="btn-ghost" style={{padding:'2px 8px'}} onClick={otevritVKlientu}>Otevřít v poště ručně</button></>}
      </div>}

      <div className="fkt" id="faktura-pdf">
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
          <div className="fkt-nazev">Faktura&nbsp;{f.cislo||'(koncept)'}</div>
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
            </>) : <span className="muted">—</span>}
            <div style={{marginTop:8,color:'#666'}}>Datum vystavení: {formatDatum(f.datum_vystaveni)}</div>
            <div style={{color:'#666'}}>Datum splatnosti: {formatDatum(f.datum_splatnosti)}</div>
          </div>
        </div>

        {poznamkaNad && <div className="fkt-pozn-nad">{poznamkaNad}</div>}

        <table className="fkt-tab">
          <thead><tr style={{borderBottomColor: barva}}>
            <th>Název položky a popis</th><th className="r">Množství</th><th className="r">Cena</th><th className="r">Celkem</th>
          </tr></thead>
          <tbody>
            {polozky.map(p=>(
              <tr key={p.id}>
                <td>{p.popis}</td>
                <td className="r">{p.mnozstvi} {p.jednotka}</td>
                <td className="r">{formatCastka(p.cena_za_kus, f.mena)}</td>
                <td className="r">{formatCastka(p.mezisoucet, f.mena)}</td>
              </tr>))}
          </tbody>
        </table>

        <div className="fkt-celkem-radek">
          <div className="fkt-pozn">{f.poznamka ? `Poznámka: ${f.poznamka}` : ''}</div>
          <div className="fkt-celkem"><span>Celkem: </span><strong>{formatCastka(f.castka_celkem, f.mena)}</strong></div>
        </div>

        <div className="fkt-platba-radek">
          {qrUrl && (
            <div className="fkt-qr">
              <div className="fkt-qr-popis">QR Platba</div>
              <img src={qrUrl} alt="QR platba" width={100} height={100} />
            </div>
          )}
          <div className="fkt-pruh" style={{background: barva, color: textNaPruhu}}>
            <div><div className="fkt-pruh-l">IBAN</div><div className="fkt-pruh-v">{ibanZobr||'—'}</div></div>
            <div><div className="fkt-pruh-l">Variabilní symbol</div><div className="fkt-pruh-v">{f.variabilni_symbol||'—'}</div></div>
            <div><div className="fkt-pruh-l">Splatnost</div><div className="fkt-pruh-v">{formatDatum(f.datum_splatnosti)}</div></div>
            <div><div className="fkt-pruh-l">K úhradě</div><div className="fkt-pruh-v">{formatCastka(f.castka_celkem, f.mena)}</div></div>
          </div>
        </div>

        {firma.podpis_data && (
          <div className="fkt-podpis">
            <div className="fkt-mini">Podpis a razítko:</div>
            <img src={firma.podpis_data} alt="podpis" />
          </div>
        )}

        {firma.rejstrik_text && <div className="fkt-paticka">{firma.rejstrik_text}</div>}
      </div>
    </>
  )
}
