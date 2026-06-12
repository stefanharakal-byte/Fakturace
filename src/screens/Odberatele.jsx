import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka, formatDatum, STAVY } from '../lib/helpers'

export default function Odberatele({ autoNovy, onAutoNovyHotovo }) {
  const [seznam, setSeznam] = useState([])
  const [firmaId, setFirmaId] = useState(null)
  const [ucty, setUcty] = useState([])
  const [edit, setEdit] = useState(null)
  const [karta, setKarta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hledej, setHledej] = useState('')

  useEffect(() => { nacti() }, [])

  // Otevření formuláře nového odběratele z tlačítka „+ Vytvořit nový"
  useEffect(() => {
    if (autoNovy) {
      setKarta(null)
      setEdit({ vychozi_splatnost:14, vychozi_mena:'CZK', vychozi_jazyk:'cs' })
      onAutoNovyHotovo && onAutoNovyHotovo()
    }
  }, [autoNovy])

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
    else {
      const ulozeny = { ...edit }
      setEdit(null)
      await nacti()
      if (ulozeny.id && karta && karta.id === ulozeny.id) setKarta({ ...karta, ...ulozeny })
    }
  }
  async function smaz(id) {
    if (!confirm('Smazat odběratele?')) return
    await supabase.from('odberatele').delete().eq('id', id)
    setEdit(null); setKarta(null); nacti()
  }

  if (!loading && !firmaId)
    return (<><div className="page-head"><h1>Odběratelé</h1></div>
      <div className="card"><div className="empty">Nejdřív ulož údaje firmy v Nastavení.</div></div></>)

  // Karta klienta jako celá obrazovka
  if (karta) {
    return <KartaKlienta
      klient={karta}
      onZpet={()=>setKarta(null)}
      onUpravit={()=>setEdit(karta)}
      onSmazat={()=>smaz(karta.id)} />
  }

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
              <tr key={o.id} className="klik" onClick={()=>setKarta(o)}>
                <td><button className="link-nazev" onClick={(e)=>{ e.stopPropagation(); setKarta(o) }}>{o.nazev}</button></td>
                <td>{o.ico||'—'}</td><td>{o.mesto||'—'}</td><td>{o.email||'—'}</td>
                <td>{o.vychozi_splatnost} dní</td>
                <td style={{textAlign:'right'}}>
                  <button className="btn-ghost" onClick={(e)=>{ e.stopPropagation(); setEdit(o) }}>Upravit</button>
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
            <div className="field">
              <label>Barva faktury pro tohoto klienta (nepovinné)</label>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <input type="color" value={edit.barva_faktury||'#0f766e'} onChange={e=>setEdit({...edit,barva_faktury:e.target.value})}
                  style={{width:48,height:40,padding:2,cursor:'pointer'}} />
                <input value={edit.barva_faktury||''} onChange={e=>setEdit({...edit,barva_faktury:e.target.value})}
                  placeholder="přebírá firemní" style={{maxWidth:160}} />
                {edit.barva_faktury && <button className="btn-ghost" onClick={()=>setEdit({...edit,barva_faktury:null})}>Vymazat</button>}
              </div>
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

function KartaKlienta({ klient, onZpet, onUpravit, onSmazat }) {
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { nacti() }, [klient.id])
  async function nacti() {
    setLoading(true)
    const { data } = await supabase
      .from('faktury')
      .select('id, cislo, datum_vystaveni, datum_splatnosti, castka_celkem, mena, stav')
      .eq('odberatel_id', klient.id)
      .neq('stav', 'stornovana')
      .order('datum_vystaveni', { ascending:false })
    setFaktury(data||[]); setLoading(false)
  }

  const pocet = faktury.length
  const celkem = faktury.reduce((s,f)=>s+Number(f.castka_celkem||0),0)
  const dluh = faktury.filter(f=>f.stav!=='zaplacena').reduce((s,f)=>s+Number(f.castka_celkem||0),0)
  const iniciály = (klient.nazev||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()
  const adresa = [klient.ulice, [klient.psc, klient.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <>
      <div className="page-head">
        <button className="btn-ghost" onClick={onZpet}>← Zpět na seznam</button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn-primary" onClick={onUpravit}>Upravit</button>
          <button className="btn-ghost" style={{color:'var(--red)'}} onClick={onSmazat}>Smazat</button>
        </div>
      </div>

      <div className="card pad">
        <div className="klient-hlavicka">
          <div className="klient-avatar">{iniciály}</div>
          <div className="klient-hlavicka-text">
            <div className="jmeno" style={{fontSize:20}}>{klient.nazev}</div>
            <div className="sub">{[klient.ico && ('IČ '+klient.ico), klient.dic].filter(Boolean).join(' · ')||'—'}</div>
          </div>
        </div>

        <div className="grid2" style={{marginTop:16}}>
          <KartaPole label="E-mail" value={klient.email} />
          <KartaPole label="Telefon" value={klient.telefon} />
          <KartaPole label="Adresa" value={adresa} />
          <KartaPole label="Výchozí splatnost" value={klient.vychozi_splatnost ? klient.vychozi_splatnost+' dní' : null} />
        </div>
      </div>

      <div className="klient-staty">
        <div className="klient-stat">
          <div className="klient-stat-l">Počet faktur</div>
          <div className="klient-stat-v">{pocet}</div>
        </div>
        <div className="klient-stat">
          <div className="klient-stat-l">Fakturováno celkem</div>
          <div className="klient-stat-v">{formatCastka(celkem)}</div>
        </div>
        <div className="klient-stat">
          <div className="klient-stat-l">Nezaplaceno</div>
          <div className={'klient-stat-v'+(dluh>0?' dluh':' zaplaceno')}>{formatCastka(dluh)}</div>
        </div>
      </div>

      <div className="card">
        <div className="pad" style={{paddingBottom:0}}><h3 style={{margin:0}}>Faktury klienta</h3></div>
        {loading ? <div className="empty">Načítám…</div>
        : faktury.length===0 ? <div className="empty">Tento klient zatím nemá žádné faktury.</div>
        : <table>
            <thead><tr><th>Číslo</th><th>Vystaveno</th><th>Splatnost</th><th>Částka</th><th>Stav</th></tr></thead>
            <tbody>{faktury.map(f=>(
              <tr key={f.id}>
                <td>{f.cislo||'(koncept)'}</td>
                <td>{formatDatum(f.datum_vystaveni)}</td>
                <td>{formatDatum(f.datum_splatnosti)}</td>
                <td>{formatCastka(f.castka_celkem, f.mena)}</td>
                <td><span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span></td>
              </tr>))}
            </tbody>
          </table>}
      </div>
    </>
  )
}

function KartaPole({ label, value }) {
  return (
    <div>
      <span className="fak-label">{label}</span>
      <div style={{fontSize:14}}>{value||'—'}</div>
    </div>
  )
}

function Pole({ label, value, onChange }) {
  return (<div className="field"><label>{label}</label>
    <input value={value||''} onChange={e=>onChange(e.target.value)} /></div>)
}
