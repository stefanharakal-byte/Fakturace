import { useEffect, useState } from 'react'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="login-wrap">Načítám…</div>
  if (!session) return <Login />

  function jdiNa(p) { setPage(p); setEditId(null); setDetailId(null) }
  function otevriFakturu(id) { setDetailId(id); setPage('faktury') }

  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <div className="brand">📄 Fakturace</div>
        {[['prehled','Přehled'],['faktury','Faktury'],['pravidelne','Pravidelné'],['odberatele','Odběratelé'],['nastaveni','Nastavení']].map(([k,v])=>(
          <button key={k} className={'nav-item'+(page===k?' active':'')} onClick={()=>jdiNa(k)}>{v}</button>
        ))}
        <div className="sidebar-bottom">
          <button className="btn-ghost" style={{width:'100%'}} onClick={()=>supabase.auth.signOut()}>Odhlásit se</button>
        </div>
      </aside>
      <main className="content">
        {page==='prehled' && <Dashboard onDetail={otevriFakturu} />}

        {page==='faktury' && detailId && (
          <DetailFaktury fakturaId={detailId}
            onZpet={()=>setDetailId(null)}
            onUpravit={(id)=>{ setDetailId(null); setEditId(id); setPage('novaFaktura') }} />
        )}
        {page==='faktury' && !detailId && (
          <SeznamFaktur
            onNova={()=>{ setEditId(null); setPage('novaFaktura') }}
            onDetail={(id)=>setDetailId(id)} />
        )}
        {page==='novaFaktura' && (
          <NovaFaktura fakturaId={editId}
            onHotovo={()=>jdiNa('faktury')}
            onZrusit={()=>jdiNa('faktury')} />
        )}
        {page==='odberatele' && <Odberatele />}
        {page==='pravidelne' && <PravidelneFaktury onDetail={otevriFakturu} />}
        {page==='nastaveni' && <Nastaveni />}
      </main>
    </div>
  )
}

function SeznamFaktur({ onNova, onDetail }) {
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)
  const [chyba, setChyba] = useState(null)

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true); setChyba(null)
    const { data, error } = await supabase
      .from('faktury')
      .select('id, cislo, datum_vystaveni, datum_splatnosti, castka_celkem, mena, stav, odberatele(nazev)')
      .order('created_at', { ascending:false })
    if (error) setChyba(error.message); else setFaktury(data||[])
    setLoading(false)
  }

  return (
    <>
      <div className="page-head">
        <h1>Faktury</h1>
        <button className="btn-primary" onClick={onNova}>+ Nová faktura</button>
      </div>
      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : chyba ? <div className="empty">Chyba: {chyba}</div>
        : faktury.length===0 ? <div className="empty">Zatím tu nejsou žádné faktury.<br/>Klikni na „Nová faktura".</div>
        : <table>
            <thead><tr><th>Číslo</th><th>Odběratel</th><th>Vystaveno</th><th>Splatnost</th><th>Částka</th><th>Stav</th></tr></thead>
            <tbody>{faktury.map(f=>(
              <tr key={f.id} className="klik" onClick={()=>onDetail(f.id)}>
                <td>{f.cislo||'(koncept)'}</td><td>{f.odberatele?.nazev||'—'}</td>
                <td>{formatDatum(f.datum_vystaveni)}</td><td>{formatDatum(f.datum_splatnosti)}</td>
                <td>{formatCastka(f.castka_celkem, f.mena)}</td>
                <td><span className={`badge ${f.stav}`}>{STAVY[f.stav]||f.stav}</span></td>
              </tr>))}
            </tbody>
          </table>}
      </div>
    </>
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
