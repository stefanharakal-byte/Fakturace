import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka, formatDatum, dnes, pridejDny, sestavCislo } from '../lib/helpers'

const FREKVENCE = {
  mesicne: 'Měsíčně',
  ctvrtletne: 'Čtvrtletně',
  pololetne: 'Pololetně',
  rocne: 'Ročně',
}

function dalsiDatum(odDatum, frekvence, denVMesici) {
  const d = new Date(odDatum)
  const mesicu = frekvence === 'mesicne' ? 1 : frekvence === 'ctvrtletne' ? 3 : frekvence === 'pololetne' ? 6 : 12
  d.setMonth(d.getMonth() + mesicu)
  if (denVMesici) d.setDate(Math.min(denVMesici, 28))
  return d.toISOString().slice(0, 10)
}

export default function PravidelneFaktury({ onDetail }) {
  const [seznam, setSeznam] = useState([])
  const [firma, setFirma] = useState(null)
  const [odberatele, setOdberatele] = useState([])
  const [ucty, setUcty] = useState([])
  const [rady, setRady] = useState([])
  const [edit, setEdit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true)
    const { data: fi } = await supabase.from('firmy').select('*').limit(1).maybeSingle()
    setFirma(fi)
    if (fi) {
      const [{ data: pf }, { data: od }, { data: uc }, { data: ra }] = await Promise.all([
        supabase.from('pravidelne_faktury').select('*, odberatele(nazev)').eq('firma_id', fi.id).order('created_at'),
        supabase.from('odberatele').select('*').eq('firma_id', fi.id).order('nazev'),
        supabase.from('bankovni_ucty').select('*').eq('firma_id', fi.id).order('created_at'),
        supabase.from('ciselne_rady').select('*').eq('firma_id', fi.id).order('created_at'),
      ])
      setSeznam(pf || []); setOdberatele(od || []); setUcty(uc || []); setRady(ra || [])
    }
    setLoading(false)
  }

  function novy() {
    setEdit({
      frekvence: 'mesicne', den_v_mesici: 1, splatnost_dni: 14, mena: 'CZK',
      auto_odeslat: true, aktivni: true,
      bankovni_ucet_id: ucty[0]?.id || '', ciselna_rada_id: rady[0]?.id || '',
      polozky: [{ popis:'', mnozstvi:1, jednotka:'ks', cena_za_kus:0, sleva:0 }],
      dalsi_vystaveni: dnes(),
    })
  }

  function setPol(i, k, v) {
    const pol = [...edit.polozky]; pol[i] = { ...pol[i], [k]: v }; setEdit({ ...edit, polozky: pol })
  }
  function pridejPol() { setEdit({ ...edit, polozky: [...edit.polozky, { popis:'', mnozstvi:1, jednotka:'ks', cena_za_kus:0, sleva:0 }] }) }
  function smazPol(i) { setEdit({ ...edit, polozky: edit.polozky.filter((_,idx)=>idx!==i) }) }

  async function uloz() {
    const payload = { ...edit, firma_id: firma.id }
    delete payload.odberatele
    if (!payload.bankovni_ucet_id) payload.bankovni_ucet_id = null
    if (!payload.ciselna_rada_id) payload.ciselna_rada_id = null
    if (!payload.odberatel_id) payload.odberatel_id = null
    let res
    if (edit.id) res = await supabase.from('pravidelne_faktury').update(payload).eq('id', edit.id)
    else res = await supabase.from('pravidelne_faktury').insert(payload)
    if (res.error) alert(res.error.message)
    else { setEdit(null); nacti() }
  }
  async function smaz(id) {
    if (!confirm('Smazat pravidelnou fakturu?')) return
    await supabase.from('pravidelne_faktury').delete().eq('id', id); setEdit(null); nacti()
  }

  async function vystavitTed(pf) {
    setMsg(null)
    try {
      const rada = rady.find(r => r.id === pf.ciselna_rada_id)
      let cislo = null, radaPocitadlo = null
      const d = new Date()
      if (rada) {
        const poradi = (rada.pocitadlo || 0) + 1
        cislo = sestavCislo(rada.format, d.getFullYear(), d.getMonth()+1, poradi)
        radaPocitadlo = { id: rada.id, pocitadlo: poradi }
      }
      const celkem = (pf.polozky || []).reduce((s,p)=> s + Number(p.mnozstvi||0)*Number(p.cena_za_kus||0)*(1-Number(p.sleva||0)/100), 0)
      const datVyst = dnes()
      const datSpl = pridejDny(datVyst, pf.splatnost_dni || 14)

      const { data: fak, error } = await supabase.from('faktury').insert({
        firma_id: firma.id, odberatel_id: pf.odberatel_id, ciselna_rada_id: pf.ciselna_rada_id,
        bankovni_ucet_id: pf.bankovni_ucet_id, cislo,
        variabilni_symbol: cislo ? cislo.replace(/\D/g,'') : null,
        datum_vystaveni: datVyst, datum_splatnosti: datSpl, datum_plneni: datVyst,
        mena: pf.mena, kurz: 1, jazyk: 'cs', poznamka: pf.poznamka,
        barva_faktury: firma.barva_faktury || null, poznamka_nad: firma.poznamka_nad || null,
        stav: 'vystavena',
        castka_bez_dph: Math.round(celkem*100)/100, castka_dph: 0, castka_celkem: Math.round(celkem*100)/100,
      }).select().single()
      if (error) throw error

      const polPayload = (pf.polozky||[]).filter(p=>p.popis?.trim()).map((p,i)=>({
        faktura_id: fak.id, poradi: i, popis: p.popis,
        mnozstvi: Number(p.mnozstvi||0), jednotka: p.jednotka||'ks',
        cena_za_kus: Number(p.cena_za_kus||0), sazba_dph: 0, sleva: Number(p.sleva||0),
        mezisoucet: Math.round(Number(p.mnozstvi||0)*Number(p.cena_za_kus||0)*(1-Number(p.sleva||0)/100)*100)/100,
      }))
      if (polPayload.length) await supabase.from('polozky_faktury').insert(polPayload)
      if (radaPocitadlo) await supabase.from('ciselne_rady').update({ pocitadlo: radaPocitadlo.pocitadlo }).eq('id', radaPocitadlo.id)

      await supabase.from('pravidelne_faktury').update({
        posledni_vystaveni: datVyst,
        dalsi_vystaveni: dalsiDatum(datVyst, pf.frekvence, pf.den_v_mesici),
      }).eq('id', pf.id)

      setMsg({ type:'ok', text:`Faktura ${cislo||''} vystavena. ${pf.auto_odeslat ? 'Otevři ji a pošli (automatické odeslání na pozadí přijde v další etapě).' : ''}` })
      nacti()
      if (onDetail) onDetail(fak.id)
    } catch (e) {
      setMsg({ type:'err', text:'Chyba: ' + (e.message||e) })
    }
  }

  if (!loading && !firma)
    return (<><div className="page-head"><h1>Pravidelné faktury</h1></div>
      <div className="card"><div className="empty">Nejdřív ulož údaje firmy v Nastavení.</div></div></>)

  const celkemEdit = edit ? (edit.polozky||[]).reduce((s,p)=> s + Number(p.mnozstvi||0)*Number(p.cena_za_kus||0)*(1-Number(p.sleva||0)/100), 0) : 0

  return (
    <>
      <div className="page-head">
        <h1>Pravidelné faktury</h1>
        <button className="btn-primary" onClick={novy}>+ Nová pravidelná faktura</button>
      </div>

      {msg && <div className={`msg ${msg.type}`} style={{marginBottom:16}}>{msg.text}</div>}

      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : seznam.length===0 ? <div className="empty">Zatím žádné pravidelné faktury.</div>
        : <table>
            <thead><tr><th>Název</th><th>Odběratel</th><th>Frekvence</th><th>Další vystavení</th><th>Auto-odeslat</th><th></th></tr></thead>
            <tbody>{seznam.map(pf=>(
              <tr key={pf.id}>
                <td><button className="link-nazev" onClick={()=>setEdit({...pf, polozky: pf.polozky||[]})}>{pf.nazev||'(bez názvu)'}</button></td>
                <td>{pf.odberatele?.nazev||'—'}</td>
                <td>{FREKVENCE[pf.frekvence]||pf.frekvence}</td>
                <td>{formatDatum(pf.dalsi_vystaveni)}</td>
                <td>{pf.auto_odeslat ? 'Ano' : 'Ne'}{!pf.aktivni && ' · neaktivní'}</td>
                <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                  <button className="btn-ghost" onClick={()=>vystavitTed(pf)}>Vystavit teď</button>
                </td>
              </tr>))}
            </tbody>
          </table>}
      </div>

      {edit && (
        <div className="modal-overlay" onClick={()=>setEdit(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:780}}>
            <div className="modal-head">
              <h3 style={{margin:0}}>{edit.id?'Úprava pravidelné faktury':'Nová pravidelná faktura'}</h3>
              <button className="btn-ghost" onClick={()=>setEdit(null)}>✕</button>
            </div>

            <div className="grid2">
              <div className="field"><label>Název (pro tvou orientaci)</label>
                <input value={edit.nazev||''} onChange={e=>setEdit({...edit,nazev:e.target.value})} placeholder="Např. Webhosting – Havránek" /></div>
              <div className="field"><label>Odběratel</label>
                <select value={edit.odberatel_id||''} onChange={e=>setEdit({...edit,odberatel_id:e.target.value})}>
                  <option value="">— vyber —</option>
                  {odberatele.map(o=><option key={o.id} value={o.id}>{o.nazev}</option>)}
                </select></div>
              <div className="field"><label>Frekvence</label>
                <select value={edit.frekvence} onChange={e=>setEdit({...edit,frekvence:e.target.value})}>
                  {Object.entries(FREKVENCE).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="field"><label>Den vystavení v měsíci</label>
                <input type="number" min="1" max="28" value={edit.den_v_mesici||1} onChange={e=>setEdit({...edit,den_v_mesici:Number(e.target.value)})} /></div>
              <div className="field"><label>Příští vystavení</label>
                <input type="date" value={edit.dalsi_vystaveni||''} onChange={e=>setEdit({...edit,dalsi_vystaveni:e.target.value})} /></div>
              <div className="field"><label>Splatnost (dny)</label>
                <input type="number" value={edit.splatnost_dni||14} onChange={e=>setEdit({...edit,splatnost_dni:Number(e.target.value)})} /></div>
              <div className="field"><label>Bankovní účet</label>
                <select value={edit.bankovni_ucet_id||''} onChange={e=>setEdit({...edit,bankovni_ucet_id:e.target.value})}>
                  <option value="">— vyber —</option>
                  {ucty.map(u=><option key={u.id} value={u.id}>{u.nazev} ({u.mena})</option>)}
                </select></div>
              <div className="field"><label>Číselná řada</label>
                <select value={edit.ciselna_rada_id||''} onChange={e=>setEdit({...edit,ciselna_rada_id:e.target.value})}>
                  <option value="">— vyber —</option>
                  {rady.map(r=><option key={r.id} value={r.id}>{r.nazev}</option>)}
                </select></div>
              <div className="field"><label>Měna</label>
                <select value={edit.mena||'CZK'} onChange={e=>setEdit({...edit,mena:e.target.value})}>
                  <option>CZK</option><option>EUR</option></select></div>
            </div>

            <h4 style={{marginBottom:8}}>Položky</h4>
            <table className="pol-table">
              <thead><tr><th>Popis</th><th>Množ.</th><th>MJ</th><th>Cena/ks</th><th>Sleva%</th><th></th></tr></thead>
              <tbody>
                {(edit.polozky||[]).map((p,i)=>(
                  <tr key={i}>
                    <td><input value={p.popis} onChange={e=>setPol(i,'popis',e.target.value)} placeholder="Popis" /></td>
                    <td><input type="number" style={{width:60}} value={p.mnozstvi} onChange={e=>setPol(i,'mnozstvi',e.target.value)} /></td>
                    <td><input style={{width:48}} value={p.jednotka} onChange={e=>setPol(i,'jednotka',e.target.value)} /></td>
                    <td><input type="number" style={{width:90}} value={p.cena_za_kus} onChange={e=>setPol(i,'cena_za_kus',e.target.value)} /></td>
                    <td><input type="number" style={{width:56}} value={p.sleva} onChange={e=>setPol(i,'sleva',e.target.value)} /></td>
                    <td><button className="btn-ghost" onClick={()=>smazPol(i)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-ghost" onClick={pridejPol}>+ Přidat položku</button>
            <div className="celkem-box">Celkem: <strong>{formatCastka(celkemEdit, edit.mena)}</strong></div>

            <div className="field" style={{marginTop:14}}>
              <label>Poznámka na faktuře</label>
              <textarea value={edit.poznamka||''} onChange={e=>setEdit({...edit,poznamka:e.target.value})} rows={2} />
            </div>
            <div style={{display:'flex',gap:20,margin:'8px 0'}}>
              <label style={{display:'flex',gap:8,alignItems:'center',fontSize:14,cursor:'pointer'}}>
                <input type="checkbox" style={{width:'auto'}} checked={!!edit.auto_odeslat} onChange={e=>setEdit({...edit,auto_odeslat:e.target.checked})} />
                Automaticky odeslat e-mailem
              </label>
              <label style={{display:'flex',gap:8,alignItems:'center',fontSize:14,cursor:'pointer'}}>
                <input type="checkbox" style={{width:'auto'}} checked={!!edit.aktivni} onChange={e=>setEdit({...edit,aktivni:e.target.checked})} />
                Aktivní
              </label>
            </div>

            <div style={{marginTop:16,display:'flex',gap:8,justifyContent:'space-between'}}>
              <div style={{display:'flex',gap:8}}>
                <button className="btn-primary" onClick={uloz}>Uložit</button>
                <button className="btn-ghost" onClick={()=>setEdit(null)}>Zrušit</button>
              </div>
              {edit.id && <button className="btn-ghost" style={{color:'var(--red)'}} onClick={()=>smaz(edit.id)}>Smazat</button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
