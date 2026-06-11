import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dnes, pridejDny, sestavCislo, spoctiFakturu, formatCastka } from '../lib/helpers'

export default function NovaFaktura({ fakturaId, onHotovo, onZrusit }) {
  const [firma, setFirma] = useState(null)
  const [odberatele, setOdberatele] = useState([])
  const [ucty, setUcty] = useState([])
  const [rady, setRady] = useState([])
  const [f, setF] = useState(null)
  const [polozky, setPolozky] = useState([{ popis:'', mnozstvi:1, jednotka:'ks', cena_za_kus:0, sleva:0 }])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { init() }, [])
  async function init() {
    const { data: fi } = await supabase.from('firmy').select('*').limit(1).maybeSingle()
    setFirma(fi)
    if (!fi) return
    const [{ data: od }, { data: uc }, { data: ra }] = await Promise.all([
      supabase.from('odberatele').select('*').eq('firma_id', fi.id).order('nazev'),
      supabase.from('bankovni_ucty').select('*').eq('firma_id', fi.id).order('created_at'),
      supabase.from('ciselne_rady').select('*').eq('firma_id', fi.id).order('created_at'),
    ])
    setOdberatele(od||[]); setUcty(uc||[]); setRady(ra||[])

    if (fakturaId) {
      const { data: fak } = await supabase.from('faktury').select('*').eq('id', fakturaId).single()
      const { data: pol } = await supabase.from('polozky_faktury').select('*').eq('faktura_id', fakturaId).order('poradi')
      setF(fak); setPolozky(pol?.length ? pol : [{ popis:'', mnozstvi:1, jednotka:'ks', cena_za_kus:0, sleva:0 }])
    } else {
      setF({
        odberatel_id: '', bankovni_ucet_id: uc?.[0]?.id||'', ciselna_rada_id: ra?.[0]?.id||'',
        mena: 'CZK', kurz: 1, jazyk: 'cs', variabilni_symbol: '',
        datum_vystaveni: dnes(), datum_splatnosti: pridejDny(dnes(),14), datum_plneni: dnes(),
        poznamka: '', stav: 'koncept',
      })
    }
  }

  function set(k, v) {
    const next = { ...f, [k]: v }
    if (k === 'odberatel_id') {
      const od = odberatele.find(o => o.id === v)
      if (od) {
        next.mena = od.vychozi_mena || 'CZK'
        next.jazyk = od.vychozi_jazyk || 'cs'
        next.datum_splatnosti = pridejDny(next.datum_vystaveni, od.vychozi_splatnost||14)
      }
    }
    if (k === 'datum_vystaveni') {
      const od = odberatele.find(o => o.id === next.odberatel_id)
      next.datum_splatnosti = pridejDny(v, od?.vychozi_splatnost||14)
    }
    setF(next)
  }

  function setPol(i, k, v) {
    const next = [...polozky]; next[i] = { ...next[i], [k]: v }; setPolozky(next)
  }
  function pridejPol() { setPolozky([...polozky, { popis:'', mnozstvi:1, jednotka:'ks', cena_za_kus:0, sleva:0 }]) }
  function smazPol(i) { setPolozky(polozky.filter((_,idx)=>idx!==i)) }

  const celkem = spoctiFakturu(polozky)

  async function ulozFakturu(vystavit) {
    setBusy(true); setMsg(null)
    try {
      let cislo = f.cislo
      let radaPocitadlo = null
      if (vystavit && !cislo) {
        const rada = rady.find(r => r.id === f.ciselna_rada_id)
        if (!rada) throw new Error('Vyber číselnou řadu (v Nastavení ji případně vytvoř).')
        const d = new Date(f.datum_vystaveni)
        const poradi = (rada.pocitadlo || 0) + 1
        cislo = sestavCislo(rada.format, d.getFullYear(), d.getMonth()+1, poradi)
        radaPocitadlo = { id: rada.id, pocitadlo: poradi }
      }

      const payload = {
        firma_id: firma.id,
        odberatel_id: f.odberatel_id || null,
        ciselna_rada_id: f.ciselna_rada_id || null,
        bankovni_ucet_id: f.bankovni_ucet_id || null,
        cislo: cislo || null,
        variabilni_symbol: f.variabilni_symbol || (cislo ? cislo.replace(/\D/g,'') : null),
        datum_vystaveni: f.datum_vystaveni, datum_splatnosti: f.datum_splatnosti, datum_plneni: f.datum_plneni,
        mena: f.mena, kurz: f.kurz||1, jazyk: f.jazyk, poznamka: f.poznamka,
        stav: vystavit ? 'vystavena' : 'koncept',
        castka_bez_dph: celkem, castka_dph: 0, castka_celkem: celkem,
      }

      let fakId = f.id
      if (fakId) {
        const { error } = await supabase.from('faktury').update(payload).eq('id', fakId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('faktury').insert(payload).select().single()
        if (error) throw error
        fakId = data.id
      }

      await supabase.from('polozky_faktury').delete().eq('faktura_id', fakId)
      const polPayload = polozky
        .filter(p => p.popis.trim())
        .map((p, i) => ({
          faktura_id: fakId, poradi: i, popis: p.popis,
          mnozstvi: Number(p.mnozstvi||0), jednotka: p.jednotka||'ks',
          cena_za_kus: Number(p.cena_za_kus||0), sazba_dph: 0, sleva: Number(p.sleva||0),
          mezisoucet: Math.round(Number(p.mnozstvi||0)*Number(p.cena_za_kus||0)*(1-Number(p.sleva||0)/100)*100)/100,
        }))
      if (polPayload.length) await supabase.from('polozky_faktury').insert(polPayload)

      if (radaPocitadlo) await supabase.from('ciselne_rady').update({ pocitadlo: radaPocitadlo.pocitadlo }).eq('id', radaPocitadlo.id)

      onHotovo()
    } catch (e) {
      setMsg({ type:'err', text: e.message }); setBusy(false)
    }
  }

  if (!firma) return (<><div className="page-head"><h1>Nová faktura</h1></div>
    <div className="card"><div className="empty">Nejdřív ulož údaje firmy v Nastavení.</div></div></>)
  if (!f) return <div className="card"><div className="empty">Načítám…</div></div>

  return (
    <>
      <div className="page-head">
        <h1>{f.id ? `Faktura ${f.cislo||'(koncept)'}` : 'Nová faktura'}</h1>
        <button className="btn-ghost" onClick={onZrusit}>← Zpět</button>
      </div>

      <div className="card pad">
        <div className="grid2">
          <div className="field"><label>Odběratel</label>
            <select value={f.odberatel_id||''} onChange={e=>set('odberatel_id',e.target.value)}>
              <option value="">— vyber —</option>
              {odberatele.map(o=><option key={o.id} value={o.id}>{o.nazev}</option>)}
            </select></div>
          <div className="field"><label>Číselná řada</label>
            <select value={f.ciselna_rada_id||''} onChange={e=>set('ciselna_rada_id',e.target.value)}>
              <option value="">— vyber —</option>
              {rady.map(r=><option key={r.id} value={r.id}>{r.nazev}</option>)}
            </select></div>
          <div className="field"><label>Bankovní účet</label>
            <select value={f.bankovni_ucet_id||''} onChange={e=>set('bankovni_ucet_id',e.target.value)}>
              <option value="">— vyber —</option>
              {ucty.map(u=><option key={u.id} value={u.id}>{u.nazev} ({u.mena})</option>)}
            </select></div>
          <div className="field"><label>Měna</label>
            <select value={f.mena} onChange={e=>set('mena',e.target.value)}>
              <option>CZK</option><option>EUR</option></select></div>
          <div className="field"><label>Datum vystavení</label>
            <input type="date" value={f.datum_vystaveni} onChange={e=>set('datum_vystaveni',e.target.value)} /></div>
          <div className="field"><label>Splatnost</label>
            <input type="date" value={f.datum_splatnosti} onChange={e=>set('datum_splatnosti',e.target.value)} /></div>
          <div className="field"><label>Variabilní symbol</label>
            <input value={f.variabilni_symbol||''} onChange={e=>set('variabilni_symbol',e.target.value)} placeholder="vygeneruje se z čísla" /></div>
          {f.mena==='EUR' && <div className="field"><label>Kurz (1 EUR = ? CZK)</label>
            <input type="number" value={f.kurz} onChange={e=>set('kurz',e.target.value)} /></div>}
        </div>

        <h3 style={{marginTop:24}}>Položky</h3>
        <table className="pol-table">
          <thead><tr><th>Popis</th><th>Množství</th><th>MJ</th><th>Cena/ks</th><th>Sleva %</th><th>Celkem</th><th></th></tr></thead>
          <tbody>
            {polozky.map((p,i)=>{
              const radek = Number(p.mnozstvi||0)*Number(p.cena_za_kus||0)*(1-Number(p.sleva||0)/100)
              return (<tr key={i}>
                <td><input value={p.popis} onChange={e=>setPol(i,'popis',e.target.value)} placeholder="Popis položky" /></td>
                <td><input type="number" style={{width:70}} value={p.mnozstvi} onChange={e=>setPol(i,'mnozstvi',e.target.value)} /></td>
                <td><input style={{width:50}} value={p.jednotka} onChange={e=>setPol(i,'jednotka',e.target.value)} /></td>
                <td><input type="number" style={{width:100}} value={p.cena_za_kus} onChange={e=>setPol(i,'cena_za_kus',e.target.value)} /></td>
                <td><input type="number" style={{width:60}} value={p.sleva} onChange={e=>setPol(i,'sleva',e.target.value)} /></td>
                <td style={{whiteSpace:'nowrap'}}>{formatCastka(radek, f.mena)}</td>
                <td><button className="btn-ghost" onClick={()=>smazPol(i)}>✕</button></td>
              </tr>)
            })}
          </tbody>
        </table>
        <button className="btn-ghost" onClick={pridejPol}>+ Přidat položku</button>

        <div className="celkem-box">Celkem k úhradě: <strong>{formatCastka(celkem, f.mena)}</strong></div>

        <div className="field" style={{marginTop:16}}>
          <label>Poznámka na faktuře</label>
          <textarea value={f.poznamka||''} onChange={e=>set('poznamka',e.target.value)} rows={2} />
        </div>

        <div style={{marginTop:16,display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn-primary" onClick={()=>ulozFakturu(true)} disabled={busy}>{busy?'Ukládám…':'Vystavit fakturu'}</button>
          <button className="btn-ghost" onClick={()=>ulozFakturu(false)} disabled={busy}>Uložit koncept</button>
          {msg && <span className={`msg ${msg.type}`}>{msg.text}</span>}
        </div>
      </div>
    </>
  )
}
