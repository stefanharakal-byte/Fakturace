import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Nastaveni() {
  const [zalozka, setZalozka] = useState('firma')
  return (
    <>
      <div className="page-head"><h1>Nastavení</h1></div>
      <div className="tabs">
        {[['firma','Firma'],['ucty','Bankovní účty'],['rady','Číselné řady']].map(([k,v])=>(
          <button key={k} className={'tab'+(zalozka===k?' active':'')} onClick={()=>setZalozka(k)}>{v}</button>
        ))}
      </div>
      {zalozka==='firma' && <Firma />}
      {zalozka==='ucty' && <Ucty />}
      {zalozka==='rady' && <Rady />}
    </>
  )
}

// ---------- FIRMA ----------
function Firma() {
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    const { data } = await supabase.from('firmy').select('*').limit(1).maybeSingle()
    if (data) setF(data)
    else setF({
      nazev: 'Štefan Harakal', ico: '48372331', dic: '',
      ulice: 'náměstí Karla IV. 176', mesto: 'Nejdek', psc: '362 21',
      zeme: 'Česká republika', email: '', telefon: '',
      platce_dph: false, vychozi_mena: 'CZK',
      rejstrik_text: 'Fyzická osoba zapsaná v živnostenském rejstříku. Nejsem plátce DPH.',
    })
  }

  function set(k, v) { setF({ ...f, [k]: v }) }

  async function uloz() {
    setBusy(true); setMsg(null)
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...f, vlastnik: u.user.id }
    let res
    if (f.id) res = await supabase.from('firmy').update(payload).eq('id', f.id).select().single()
    else res = await supabase.from('firmy').insert(payload).select().single()
    if (res.error) setMsg({ type:'err', text: res.error.message })
    else { setF(res.data); setMsg({ type:'ok', text:'Uloženo.' }) }
    setBusy(false)
  }

  if (!f) return <div className="card"><div className="empty">Načítám…</div></div>

  return (
    <div className="card pad">
      <div className="grid2">
        <Pole label="Název / jméno" value={f.nazev} onChange={v=>set('nazev',v)} />
        <Pole label="IČO" value={f.ico} onChange={v=>set('ico',v)} />
        <Pole label="Ulice a č.p." value={f.ulice} onChange={v=>set('ulice',v)} />
        <Pole label="Město" value={f.mesto} onChange={v=>set('mesto',v)} />
        <Pole label="PSČ" value={f.psc} onChange={v=>set('psc',v)} />
        <Pole label="E-mail" value={f.email} onChange={v=>set('email',v)} />
        <Pole label="Telefon" value={f.telefon} onChange={v=>set('telefon',v)} />
      </div>
      <div className="field" style={{marginTop:14}}>
        <label>Patička / text o registraci</label>
        <textarea value={f.rejstrik_text||''} onChange={e=>set('rejstrik_text',e.target.value)} rows={2} />
      </div>
      <div style={{marginTop:16,display:'flex',gap:12,alignItems:'center'}}>
        <button className="btn-primary" onClick={uloz} disabled={busy}>{busy?'Ukládám…':'Uložit firmu'}</button>
        {msg && <span className={`msg ${msg.type}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

// ---------- BANKOVNÍ ÚČTY ----------
function Ucty() {
  const [ucty, setUcty] = useState([])
  const [firmaId, setFirmaId] = useState(null)
  const [novy, setNovy] = useState(null)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    const { data: firma } = await supabase.from('firmy').select('id').limit(1).maybeSingle()
    if (!firma) return
    setFirmaId(firma.id)
    const { data } = await supabase.from('bankovni_ucty').select('*').eq('firma_id', firma.id).order('created_at')
    setUcty(data || [])
  }

  async function uloz() {
    const payload = { ...novy, firma_id: firmaId }
    const res = await supabase.from('bankovni_ucty').insert(payload).select().single()
    if (!res.error) { setNovy(null); nacti() }
    else alert(res.error.message)
  }
  async function smaz(id) {
    if (!confirm('Smazat účet?')) return
    await supabase.from('bankovni_ucty').delete().eq('id', id); nacti()
  }

  if (!firmaId) return <div className="card pad"><div className="empty">Nejdřív ulož údaje firmy v záložce „Firma".</div></div>

  return (
    <div className="card pad">
      {ucty.length===0 && <p className="muted">Zatím žádný účet.</p>}
      {ucty.map(u=>(
        <div key={u.id} className="row-item">
          <div><strong>{u.nazev}</strong> — {u.cislo_uctu||u.iban} ({u.mena})</div>
          <button className="btn-ghost" onClick={()=>smaz(u.id)}>Smazat</button>
        </div>
      ))}
      {novy ? (
        <div className="grid2" style={{marginTop:14}}>
          <Pole label="Název účtu" value={novy.nazev||''} onChange={v=>setNovy({...novy,nazev:v})} />
          <Pole label="Číslo účtu" value={novy.cislo_uctu||''} onChange={v=>setNovy({...novy,cislo_uctu:v})} />
          <Pole label="IBAN (pro SK)" value={novy.iban||''} onChange={v=>setNovy({...novy,iban:v})} />
          <div className="field"><label>Měna</label>
            <select value={novy.mena||'CZK'} onChange={e=>setNovy({...novy,mena:e.target.value})}>
              <option>CZK</option><option>EUR</option></select></div>
          <div style={{gridColumn:'1/3',display:'flex',gap:8}}>
            <button className="btn-primary" onClick={uloz}>Uložit účet</button>
            <button className="btn-ghost" onClick={()=>setNovy(null)}>Zrušit</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" style={{marginTop:14}} onClick={()=>setNovy({mena:'CZK'})}>+ Přidat účet</button>
      )}
    </div>
  )
}

// ---------- ČÍSELNÉ ŘADY ----------
function Rady() {
  const [rady, setRady] = useState([])
  const [firmaId, setFirmaId] = useState(null)
  const [novy, setNovy] = useState(null)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    const { data: firma } = await supabase.from('firmy').select('id').limit(1).maybeSingle()
    if (!firma) return
    setFirmaId(firma.id)
    const { data } = await supabase.from('ciselne_rady').select('*').eq('firma_id', firma.id).order('created_at')
    setRady(data || [])
  }

  async function uloz() {
    const payload = { ...novy, firma_id: firmaId }
    const res = await supabase.from('ciselne_rady').insert(payload).select().single()
    if (!res.error) { setNovy(null); nacti() } else alert(res.error.message)
  }
  async function smaz(id) {
    if (!confirm('Smazat řadu?')) return
    await supabase.from('ciselne_rady').delete().eq('id', id); nacti()
  }

  if (!firmaId) return <div className="card pad"><div className="empty">Nejdřív ulož údaje firmy.</div></div>

  return (
    <div className="card pad">
      <p className="muted" style={{marginTop:0}}>Formát: <code>{'{RRRR}'}</code> rok, <code>{'{MM}'}</code> měsíc, <code>{'{NN}'}</code> pořadí. Např. <code>{'{RRRR}{MM}{NN}'}</code> → 20260101</p>
      {rady.map(r=>(
        <div key={r.id} className="row-item">
          <div><strong>{r.nazev}</strong> — formát <code>{r.format}</code>, poslední pořadí: {r.pocitadlo}</div>
          <button className="btn-ghost" onClick={()=>smaz(r.id)}>Smazat</button>
        </div>
      ))}
      {novy ? (
        <div className="grid2" style={{marginTop:14}}>
          <Pole label="Název řady" value={novy.nazev||''} onChange={v=>setNovy({...novy,nazev:v})} />
          <Pole label="Formát" value={novy.format||'{RRRR}{MM}{NN}'} onChange={v=>setNovy({...novy,format:v})} />
          <div style={{gridColumn:'1/3',display:'flex',gap:8}}>
            <button className="btn-primary" onClick={uloz}>Uložit řadu</button>
            <button className="btn-ghost" onClick={()=>setNovy(null)}>Zrušit</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" style={{marginTop:14}} onClick={()=>setNovy({format:'{RRRR}{MM}{NN}'})}>+ Přidat řadu</button>
      )}
    </div>
  )
}

// ---------- sdílené pole ----------
function Pole({ label, value, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value||''} onChange={e=>onChange(e.target.value)} />
    </div>
  )
}
