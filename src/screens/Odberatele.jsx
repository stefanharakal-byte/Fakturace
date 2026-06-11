import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Odberatele() {
  const [seznam, setSeznam] = useState([])
  const [firmaId, setFirmaId] = useState(null)
  const [edit, setEdit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true)
    const { data: firma } = await supabase.from('firmy').select('id').limit(1).maybeSingle()
    if (firma) {
      setFirmaId(firma.id)
      const { data } = await supabase.from('odberatele').select('*').eq('firma_id', firma.id).order('nazev')
      setSeznam(data || [])
    }
    setLoading(false)
  }

  async function uloz() {
    const payload = { ...edit, firma_id: firmaId }
    let res
    if (edit.id) res = await supabase.from('odberatele').update(payload).eq('id', edit.id)
    else res = await supabase.from('odberatele').insert(payload)
    if (res.error) alert(res.error.message)
    else { setEdit(null); nacti() }
  }
  async function smaz(id) {
    if (!confirm('Smazat odběratele?')) return
    await supabase.from('odberatele').delete().eq('id', id); nacti()
  }

  if (!loading && !firmaId)
    return (<><div className="page-head"><h1>Odběratelé</h1></div>
      <div className="card"><div className="empty">Nejdřív ulož údaje firmy v Nastavení.</div></div></>)

  return (
    <>
      <div className="page-head">
        <h1>Odběratelé</h1>
        <button className="btn-primary" onClick={()=>setEdit({ vychozi_splatnost:14, vychozi_mena:'CZK', vychozi_jazyk:'cs' })}>+ Nový odběratel</button>
      </div>

      {edit && (
        <div className="card pad" style={{marginBottom:16}}>
          <h3 style={{marginTop:0}}>{edit.id?'Úprava odběratele':'Nový odběratel'}</h3>
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
          </div>
          <div style={{marginTop:14,display:'flex',gap:8}}>
            <button className="btn-primary" onClick={uloz}>Uložit</button>
            <button className="btn-ghost" onClick={()=>setEdit(null)}>Zrušit</button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : seznam.length===0 ? <div className="empty">Zatím žádní odběratelé.</div>
        : <table>
            <thead><tr><th>Název</th><th>IČO</th><th>E-mail</th><th>Splatnost</th><th></th></tr></thead>
            <tbody>{seznam.map(o=>(
              <tr key={o.id}>
                <td>{o.nazev}</td><td>{o.ico||'—'}</td><td>{o.email||'—'}</td>
                <td>{o.vychozi_splatnost} dní</td>
                <td style={{textAlign:'right'}}>
                  <button className="btn-ghost" onClick={()=>setEdit(o)}>Upravit</button>
                  <button className="btn-ghost" onClick={()=>smaz(o.id)}>Smazat</button>
                </td>
              </tr>))}
            </tbody>
          </table>}
      </div>
    </>
  )
}

function Pole({ label, value, onChange }) {
  return (<div className="field"><label>{label}</label>
    <input value={value||''} onChange={e=>onChange(e.target.value)} /></div>)
}
