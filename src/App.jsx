import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import { formatCastka, STAVY, formatDatum } from './lib/helpers'
import Dashboard from './screens/Dashboard'
import Nastaveni from './screens/Nastaveni'
import Odberatele from './screens/Odberatele'
import NovaFaktura from './screens/NovaFaktura'
import DetailFaktury from './screens/DetailFaktury'
import PravidelneFaktury from './screens/PravidelneFaktury'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('prehled')
  const [editId, setEditId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [zalozkaFaktur, setZalozkaFaktur] = useState('vystavene') // 'vystavene' | 'pravidelne'
  const [novyOpen, setNovyOpen] = useState(false)
  const [novyOdberatel, setNovyOdberatel] = useState(false)
  const novyRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Zavreni "+ Vytvořit nový ▾" pri kliknuti mimo
  useEffect(() => {
    function klikMimo(e) { if (novyRef.current && !novyRef.current.contains(e.target)) setNovyOpen(false) }
    document.addEventListener('mousedown', klikMimo)
    return () => document.removeEventListener('mousedown', klikMimo)
  }, [])

  if (loading) return <div className="login-wrap">Načítám…</div>
  if (!session) return <Login />

  function jdiNa(p) { setPage(p); setEditId(null); setDetailId(null) }
  function otevriFakturu(id) { setDetailId(id); setPage('faktury'); setZalozkaFaktur('vystavene') }

  function novaFaktura() { setNovyOpen(false); setEditId(null); setPage('novaFaktura') }
  function novyOdber() { setNovyOpen(false); setNovyOdberatel(true); setPage('odberatele') }
  function novaPravidelna() {
    setNovyOpen(false); setDetailId(null); setEditId(null)
    setPage('faktury'); setZalozkaFaktur('pravidelne')
  }

  const menu = [['prehled','Přehled'],['faktury','Faktury'],['odberatele','Odběratelé'],['nastaveni','Nastavení']]

  return (
    <div className="layout-top">
      <header className="topbar no-print">
        <div className="topbar-in">
          <div className="topbar-left">
            <div className="brand">📄 Fakturace</div>
            <nav className="topnav">
              {menu.map(([k,v])=>(
                <button key={k} className={'topnav-item'+(page===k?' active':'')} onClick={()=>jdiNa(k)}>{v}</button>
              ))}
            </nav>
          </div>
          <div className="topbar-right" ref={novyRef}>
            <div className="novy-wrap">
              <button className="btn-primary" onClick={()=>setNovyOpen(o=>!o)}>+ Vytvořit nový ▾</button>
              {novyOpen && (
                <div className="novy-menu">
                  <button onClick={novaFaktura}>📄 Nová faktura</button>
                  <button onClick={novyOdber}>👤 Nový odběratel</button>
                  <button onClick={novaPravidelna}>🔁 Pravidelná faktura</button>
                </div>
              )}
            </div>
            <button className="btn-ghost" onClick={()=>supabase.auth.signOut()}>Odhlásit se</button>
          </div>
        </div>
      </header>

      <main className="content-top">
        {page==='prehled' && <Dashboard onDetail={otevriFakturu} />}

        {page==='faktury' && detailId && (
          <DetailFaktury fakturaId={detailId}
            onZpet={()=>setDetailId(null)}
            onUpravit={(id)=>{ setDetailId(null); setEditId(id); setPage('novaFaktura') }} />
        )}
        {page==='faktury' && !detailId && (
          <>
            <div className="page-head">
              <h1>Faktury</h1>
            </div>
            <div className="subtabs no-print">
              <button className={'subtab'+(zalozkaFaktur==='vystavene'?' active':'')} onClick={()=>setZalozkaFaktur('vystavene')}>Vystavené</button>
              <button className={'subtab'+(zalozkaFaktur==='pravidelne'?' active':'')} onClick={()=>setZalozkaFaktur('pravidelne')}>Pravidelné</button>
            </div>
            {zalozkaFaktur==='vystavene'
              ? <SeznamFaktur
                  onNova={()=>{ setEditId(null); setPage('novaFaktura') }}
                  onDetail={(id)=>setDetailId(id)}
                  onUpravit={(id)=>{ setEditId(id); setPage('novaFaktura') }} />
              : <PravidelneFaktury onDetail={otevriFakturu} skrytNadpis />}
          </>
        )}
        {page==='novaFaktura' && (
          <NovaFaktura fakturaId={editId}
            onHotovo={()=>jdiNa('faktury')}
            onZrusit={()=>jdiNa('faktury')} />
        )}
        {page==='odberatele' && <Odberatele autoNovy={novyOdberatel} onAutoNovyHotovo={()=>setNovyOdberatel(false)} />}
        {page==='nastaveni' && <Nastaveni />}
      </main>
    </div>
  )
}

function SeznamFaktur({ onNova, onDetail, onUpravit }) {
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)
  const [chyba, setChyba] = useState(null)
  const [klientId, setKlientId] = useState(null)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true); setChyba(null)
    const { data, error } = await supabase
      .from('faktury')
      .select('id, cislo, datum_vystaveni, datum_splatnosti, castka_celkem, mena, stav, odberatel_id, odberatele(nazev)')
      .order('created_at', { ascending:false })
    if (error) setChyba(error.message); else setFaktury(data||[])
    setLoading(false)
  }

  async function smazat(id, cislo) {
    if (!window.confirm(`Opravdu smazat fakturu ${cislo||'(koncept)'}? Tato akce je nevratná.`)) return
    const { error } = await supabase.from('faktury').delete().eq('id', id)
    if (error) { alert('Chyba při mazání: ' + error.message); return }
    setFaktury(faktury.filter(f => f.id !== id))
  }

  return (
    <>
      <div className="page-head" style={{marginTop:4}}>
        <span className="muted">{loading?'':`${faktury.length} faktur`}</span>
        <button className="btn-primary" onClick={onNova}>+ Nová faktura</button>
      </div>
      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : chyba ? <div className="empty">Chyba: {chyba}</div>
        : faktury.length===0 ? <div className="empty">Zatím tu nejsou žádné faktury.<br/>Klikni na „Nová faktura".</div>
        : <table>
            <thead><tr><th>Číslo</th><th>Odběratel</th><th>Vystaveno</th><th>Splatnost</th><th>Částka</th><th>Stav</th></tr></thead>
            <tbody>{faktury.map(f=>(
              <tr key={f.id} className="klik fak-row" onClick={()=>onDetail(f.id)}>
                <td>{f.cislo||'(koncept)'}</td>
                <td>
                  {f.odberatel_id
                    ? <button className="link-nazev" onClick={(e)=>{ e.stopPropagation(); setKlientId(f.odberatel_id) }}>
                        {f.odberatele?.nazev||'—'}
                      </button>
                    : (f.odberatele?.nazev||'—')}
                </td>
                <td>{formatDatum(f.datum_vystaveni)}</td>
                <td>{formatDatum(f.datum_splatnosti)}</td>
                <td className="castka-skryt">{formatCastka(f.castka_celkem, f.mena)}</td>
                <td style={{position:'relative'}}>
                  <span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span>
                  <span className="fak-akce">
                    <button className="akce-btn" data-tip="Detail"
                      onClick={(e)=>{ e.stopPropagation(); onDetail(f.id) }}>👁</button>
                    <button className="akce-btn" data-tip="Upravit"
                      onClick={(e)=>{ e.stopPropagation(); onUpravit(f.id) }}>✎</button>
                    <button className="akce-btn dng" data-tip="Smazat"
                      onClick={(e)=>{ e.stopPropagation(); smazat(f.id, f.cislo) }}>🗑</button>
                  </span>
                </td>
              </tr>))}
            </tbody>
          </table>}
      </div>

      {klientId && <KartaKlientaModal odberatelId={klientId}
        onZavrit={()=>setKlientId(null)}
        onDetailFaktury={(id)=>{ setKlientId(null); onDetail(id) }} />}
    </>
  )
}

function KartaKlientaModal({ odberatelId, onZavrit, onDetailFaktury }) {
  const [klient, setKlient] = useState(null)
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { nacti() }, [odberatelId])
  async function nacti() {
    setLoading(true)
    const { data: k } = await supabase.from('odberatele').select('*').eq('id', odberatelId).single()
    const { data: f } = await supabase
      .from('faktury')
      .select('id, cislo, datum_vystaveni, datum_splatnosti, castka_celkem, mena, stav')
      .eq('odberatel_id', odberatelId)
      .neq('stav', 'stornovana')
      .order('datum_vystaveni', { ascending:false })
    setKlient(k); setFaktury(f||[]); setLoading(false)
  }

  const pocet = faktury.length
  const celkem = faktury.reduce((s,f)=>s+Number(f.castka_celkem||0),0)
  const dluh = faktury.filter(f=>f.stav!=='zaplacena').reduce((s,f)=>s+Number(f.castka_celkem||0),0)
  const inicialy = (klient?.nazev||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()

  return (
    <div className="modal-overlay" onClick={onZavrit}>
      <div className="modal" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-head">
          <div className="klient-hlavicka">
            <div className="klient-avatar">{inicialy}</div>
            <div className="klient-hlavicka-text">
              <div className="jmeno">{klient?.nazev||'Načítám…'}</div>
              {klient && <div className="sub">
                {[klient.ico && ('IČ '+klient.ico), klient.mesto].filter(Boolean).join(' · ')||'—'}
              </div>}
            </div>
          </div>
          <button className="btn-ghost" onClick={onZavrit}>🗑</button>
        </div>

        {loading ? <div className="empty">Načítám…</div> : <>
          <div className="klient-staty">
            <div className="klient-stat">
              <div className="klient-stat-l">Faktur</div>
              <div className="klient-stat-v">{pocet}</div>
            </div>
            <div className="klient-stat">
              <div className="klient-stat-l">Celkem</div>
              <div className="klient-stat-v">{formatCastka(celkem)}</div>
            </div>
            <div className="klient-stat">
              <div className="klient-stat-l">Nezaplaceno</div>
              <div className={'klient-stat-v'+(dluh>0?' dluh':' zaplaceno')}>{formatCastka(dluh)}</div>
            </div>
          </div>

          {faktury.length===0
            ? <div className="empty">Tento klient zatím nemá žádné faktury.</div>
            : <div className="card" style={{marginTop:4}}>
                <table>
                  <thead><tr><th>Číslo</th><th>Vystaveno</th><th>Částka</th><th>Stav</th></tr></thead>
                  <tbody>{faktury.map(f=>(
                    <tr key={f.id} className="klik" onClick={()=>onDetailFaktury(f.id)}>
                      <td>{f.cislo||'(koncept)'}</td>
                      <td>{formatDatum(f.datum_vystaveni)}</td>
                      <td>{formatCastka(f.castka_celkem, f.mena)}</td>
                      <td><span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span></td>
                    </tr>))}
                  </tbody>
                </table>
              </div>}
        </>}
      </div>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [heslo, setHeslo] = useState('')
  const [rezim, setRezim] = useState('login')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function odeslat() {
    setBusy(true); setMsg(null)
    try {
      if (rezim==='login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: heslo })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password: heslo })
        if (error) throw error
        setMsg({ type:'ok', text:'Účet vytvořen.' })
      }
    } catch (e) { setMsg({ type:'err', text:e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Fakturace</h1>
        <p>{rezim==='login'?'Přihlas se ke svému účtu':'Vytvoř si nový účet'}</p>
        <div className="field"><label>E-mail</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tvuj@email.cz" /></div>
        <div className="field"><label>Heslo</label>
          <input type="password" value={heslo} onChange={e=>setHeslo(e.target.value)} placeholder="••••••••" /></div>
        <button className="btn-primary" style={{width:'100%'}} onClick={odeslat} disabled={busy}>
          {busy?'Pracuji…':rezim==='login'?'Přihlásit se':'Zaregistrovat se'}</button>
        <button className="btn-ghost" style={{width:'100%',marginTop:8}}
          onClick={()=>{setRezim(rezim==='login'?'registrace':'login'); setMsg(null)}}>
          {rezim==='login'?'Nemám účet — registrovat':'Už mám účet — přihlásit'}</button>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      </div>
    </div>
  )
}
