import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Odberatele() {
  const [seznam, setSeznam] = useState([])
  const [firmaId, setFirmaId] = useState(null)
  const [ucty, setUcty] = useState([])
  const [edit, setEdit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hledej, setHledej] = useState('')

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true)
    const { data: firma } = await supabase.from('firmy').select('id').limit(1).maybeSingle()
    if (firma) {
      setFirmaId(firma.id)
      const { data } = await supabase.from('odberatele').select('*').eq('firma_id', firma.id).order('nazev')
      setSeznam(data || [])
      const { data: u } = await supabase.from('bankovni_ucty').select('*').eq('firma_id', firma.id).order('created_at')
      setUcty(u || [])
    }
    setLoading(false)
  }

  async function uloz() {
    const payload = { ...edit, firma_id: firmaId }
    if (!payload.vychozi_bankovni_ucet_id) payload.vychozi_bankovni_ucet_id = null
    let res
    if (edit.id) res = await supabase.from('odberatele').update(payload).eq('id', edit.id)
    else res = await supabase.from('odberatele').insert(payload)
    if (res.error) alert(res.error.message)
    else { setEdit(null); nacti() }
  }
  async function smaz(id) {
    if (!confirm('Smazat odběratele?')) return
    await supabase.from('odberatele').delete().eq('id', id)
    setEdit(null); nacti()
  }

  if (!loading && !firmaId)
    return (<><div className="page-head"><h1>Odběratelé</h1></div>
      <div className="card"><div className="empty">Nejdřív ulož údaje firmy v Nastavení.</div></div></>)

  const q = hledej.trim().toLowerCase()
  const filtrovani = q
    ? seznam.filter(o =>
        (o.nazev||'').toLowerCase().includes(q) ||
        (o.ico||'').toLowerCase().includes(q) ||
        (o.mesto||'').toLowerCase().includes(q) ||
        (o.email||'').toLowerCase().includes(q))
    : seznam

  return (
    <>
      <div className="page-head">
        <h1>Odběratelé</h1>
        <button className="btn-primary" onClick={()=>setEdit({ vychozi_splatnost:14, vychozi_mena:'CZK', vychozi_jazyk:'cs' })}>+ Nový odběratel</button>
      </div>

      <div style={{marginBottom:16,position:'relative',maxWidth:420}}>
        <input value={hledej} onChange={e=>setHledej(e.target.value)}
          placeholder="🔍 Hledat podle názvu, IČO, města nebo e-mailu…" />
      </div>

      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : filtrovani.length===0 ? <div className="empty">{q ? 'Nic nenalezeno.' : 'Zatím žádní odběratelé.'}</div>
        : <table>
            <thead><tr><th>Název</th><th>IČO</th><th>Město</th><th>E-mail</th><th>Splatnost</th><th></th></tr></thead>
            <tbody>{filtrovani.map(o=>(
              <tr key={o.id}>
                <td><button className="link-nazev" onClick={()=>setEdit(o)}>{o.nazev}</button></td>
                <td>{o.ico||'—'}</td><td>{o.mesto||'—'}</td><td>{o.email||'—'}</td>
                <td>{o.vychozi_splatnost} dní</td>
                <td style={{textAlign:'right'}}>
                  <button className="btn-ghost" onClick={()=>smaz(o.id)}>Smazat</button>
                </td>
              </tr>))}
            </tbody>
          </table>}
      </div>
      {q && <p className="muted" style={{marginTop:10,fontSize:13}}>Zobrazeno {filtrovani.length} z {seznam.length} klientů</p>}

      {edit && (
        <div className="modal-overlay" onClick={()=>setEdit(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head">
              <h3 style={{margin:0}}>{edit.id?'Úprava odběratele':'Nový odběratel'}</h3>
              <button className="btn-ghost" onClick={()=>setEdit(null)}>✕</button>
            </div>
            <div className="grid2">
              <Pole label="Název / jméno" value={edit.nazev} onChange={v=>setEdit({...edit,nazev:v})} />
              <Pole label="IČO" value={edit.ico} onChange={v=>setEdit({...edit,ico:v})} />
              <Pole label="DIČ" value={edit.dic} onChange={v=>setEdit({...edit,dic:v})} />
              <Pole label="E-mail" value={edit.email} onChange={v=>setEdit({...edit,email:v})} />
              <Pole label="Ulice a č.p." value={edit.ulice} onChange={v=>setEdit({...edit,ulice:v})} />
              <Pole label="Město" value={edit.mesto} onChange={v=>setEdit({...edit,mesto:v})} />
              <Pole label="PSČ" value={edit.psc} onChange={v=>setEdit({...edit,psc:v})} />
              <Pole label="Telefon" value={edit.telefon} onChange={v=>setEdit({...edit,telefon:v})} />
              <div className="field"><label>Výchozí splatnost (dny)</label>
                <input type="number" value={edit.vychozi_splatnost||14} onChange={e=>setEdit({...edit,vychozi_splatnost:e.target.value})} /></div>
              <div className="field"><label>Výchozí měna</label>
                <select value={edit.vychozi_mena||'CZK'} onChange={e=>setEdit({...edit,vychozi_mena:e.target.value})}>
                  <option>CZK</option><option>EUR</option></select></div>
              <div className="field"><label>Výchozí bankovní účet</label>
                <select value={edit.vychozi_bankovni_ucet_id||''} onChange={e=>setEdit({...edit,vychozi_bankovni_ucet_id:e.target.value})}>
                  <option value="">— žádný —</option>
                  {ucty.map(u=><option key={u.id} value={u.id}>{u.nazev} ({u.mena})</option>)}
                </select></div>
            </div>
            <div className="field" style={{marginTop:14}}>
              <label>Výchozí text / poznámka na faktuře</label>
              <textarea value={edit.vychozi_text||''} onChange={e=>setEdit({...edit,vychozi_text:e.target.value})} rows={2}
                placeholder="Např. Děkujeme za spolupráci." />
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

function Pole({ label, value, onChange }) {
  return (<div className="field"><label>{label}</label>
    <input value={value||''} onChange={e=>onChange(e.target.value)} /></div>)
}
