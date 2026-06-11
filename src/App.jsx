import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// ===== NASTAVENÍ SUPABASE — vyplň anon klíč =====
const SUPABASE_URL = 'https://bnkkimycxuqjzgdwgxll.supabase.co'
const SUPABASE_ANON_KEY = 'https://bnkkimycxuqjzgdwgxll.supabase.co/rest/v1/'
// =================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('faktury')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session); setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="login-wrap">Načítám…</div>
  if (!session) return <Login />

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">📄 Fakturace</div>
        {[['faktury','Faktury'],['odberatele','Odběratelé'],['cenik','Ceník'],['nastaveni','Nastavení']].map(([k,v]) => (
          <button key={k} className={'nav-item' + (page===k?' active':'')} onClick={() => setPage(k)}>{v}</button>
        ))}
        <div className="sidebar-bottom">
          <button className="btn-ghost" style={{width:'100%'}} onClick={() => supabase.auth.signOut()}>Odhlásit se</button>
        </div>
      </aside>
      <main className="content">
        {page==='faktury' && <Faktury />}
        {page==='odberatele' && <Prazdna nadpis="Odběratelé" text="Správa odběratelů přijde ve Fázi 3." />}
        {page==='cenik' && <Prazdna nadpis="Ceník" text="Ceník položek přijde ve Fázi 2." />}
        {page==='nastaveni' && <Prazdna nadpis="Nastavení" text="Firmy, bankovní účty a číselné řady přijdou ve Fázi 2." />}
      </main>
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
      if (rezim === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: heslo })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password: heslo })
        if (error) throw error
        setMsg({ type:'ok', text:'Účet vytvořen. Pokud je zapnuté ověření e-mailem, potvrď ho ve schránce.' })
      }
    } catch (e) { setMsg({ type:'err', text:e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Fakturace</h1>
        <p>{rezim==='login' ? 'Přihlas se ke svému účtu' : 'Vytvoř si nový účet'}</p>
        <div className="field"><label>E-mail</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tvuj@email.cz" /></div>
        <div className="field"><label>Heslo</label>
          <input type="password" value={heslo} onChange={e=>setHeslo(e.target.value)} placeholder="••••••••" /></div>
        <button className="btn-primary" style={{width:'100%'}} onClick={odeslat} disabled={busy}>
          {busy ? 'Pracuji…' : rezim==='login' ? 'Přihlásit se' : 'Zaregistrovat se'}</button>
        <button className="btn-ghost" style={{width:'100%',marginTop:8}}
          onClick={()=>{setRezim(rezim==='login'?'registrace':'login'); setMsg(null)}}>
          {rezim==='login' ? 'Nemám účet — registrovat' : 'Už mám účet — přihlásit'}</button>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      </div>
    </div>
  )
}

function Faktury() {
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
        <button className="btn-primary" onClick={()=>alert('Tvorba faktury přijde ve Fázi 2')}>+ Nová faktura</button>
      </div>
      <div className="card">
        {loading ? <div className="empty">Načítám…</div>
        : chyba ? <div className="empty">Chyba: {chyba}</div>
        : faktury.length===0 ? <div className="empty">Zatím tu nejsou žádné faktury.<br/>Po dokončení Fáze 2 tu vystavíš první.</div>
        : <table>
            <thead><tr><th>Číslo</th><th>Odběratel</th><th>Vystaveno</th><th>Splatnost</th><th>Částka</th><th>Stav</th></tr></thead>
            <tbody>{faktury.map(f=>(
              <tr key={f.id}>
                <td>{f.cislo||'—'}</td><td>{f.odberatele?.nazev||'—'}</td>
                <td>{f.datum_vystaveni||'—'}</td><td>{f.datum_splatnosti||'—'}</td>
                <td>{Number(f.castka_celkem).toLocaleString('cs-CZ')} {f.mena}</td>
                <td><span className={`badge ${f.stav}`}>{f.stav}</span></td>
              </tr>))}
            </tbody>
          </table>}
      </div>
    </>
  )
}

function Prazdna({ nadpis, text }) {
  return (<>
    <div className="page-head"><h1>{nadpis}</h1></div>
    <div className="card"><div className="empty">{text}</div></div>
  </>)
}
