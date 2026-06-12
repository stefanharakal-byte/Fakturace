import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCastka } from '../lib/helpers'

export default function Dashboard({ onDetail }) {
  const [faktury, setFaktury] = useState([])
  const [loading, setLoading] = useState(true)
  const [obdobi, setObdobi] = useState('rok')

  useEffect(() => { nacti() }, [])
  async function nacti() {
    setLoading(true)
    const { data } = await supabase
      .from('faktury')
      .select('id, cislo, datum_vystaveni, datum_splatnosti, castka_celkem, mena, stav, odberatele(nazev)')
      .neq('stav', 'stornovana')
      .order('datum_vystaveni', { ascending: false })
    setFaktury(data || [])
    setLoading(false)
  }

  if (loading) return (<><div className="page-head"><h1>Přehled</h1></div>
    <div className="card"><div className="empty">Načítám…</div></div></>)

  const ted = new Date()
  const rok = ted.getFullYear()
  const vRoce = (f, r) => f.datum_vystaveni && new Date(f.datum_vystaveni).getFullYear() === r

  let vyber = faktury
  if (obdobi === 'rok') vyber = faktury.filter(f => vRoce(f, rok))
  else if (obdobi === 'minuly') vyber = faktury.filter(f => vRoce(f, rok - 1))

  const jeZaplacena = f => f.stav === 'zaplacena'
  const jePoSplatnosti = f => !jeZaplacena(f) && f.datum_splatnosti && new Date(f.datum_splatnosti) < ted

  const obrat = vyber.filter(jeZaplacena).reduce((s, f) => s + Number(f.castka_celkem || 0), 0)
  const vystaveno = vyber.reduce((s, f) => s + Number(f.castka_celkem || 0), 0)
  const neuhrazeno = vyber.filter(f => !jeZaplacena(f)).reduce((s, f) => s + Number(f.castka_celkem || 0), 0)
  const poSplatnosti = vyber.filter(jePoSplatnosti).reduce((s, f) => s + Number(f.castka_celkem || 0), 0)
  const neuhrazeneFaktury = vyber.filter(f => !jeZaplacena(f))
    .sort((a, b) => (a.datum_splatnosti || '').localeCompare(b.datum_splatnosti || ''))

  let mesice = null
  if (obdobi !== 'vse') {
    const r = obdobi === 'rok' ? rok : rok - 1
    const sumy = Array(12).fill(0)
    vyber.filter(jeZaplacena).forEach(f => {
      const d = new Date(f.datum_vystaveni)
      if (d.getFullYear() === r) sumy[d.getMonth()] += Number(f.castka_celkem || 0)
    })
    const max = Math.max(...sumy, 1)
    mesice = { sumy, max, r }
  }

  const nazvyMesicu = ['Led','Úno','Bře','Dub','Kvě','Čen','Čec','Srp','Zář','Říj','Lis','Pro']

  return (
    <>
      <div className="page-head">
        <h1>Přehled</h1>
        <div className="seg">
          {[['rok','Tento rok'],['minuly','Minulý rok'],['vse','Vše']].map(([k,v])=>(
            <button key={k} className={'seg-btn'+(obdobi===k?' active':'')} onClick={()=>setObdobi(k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        <Dlazka label="Obrat (zaplaceno)" value={formatCastka(obrat)} barva="green" />
        <Dlazka label="Vystaveno celkem" value={formatCastka(vystaveno)} />
        <Dlazka label="Neuhrazeno" value={formatCastka(neuhrazeno)} barva="amber" />
        <Dlazka label="Po splatnosti" value={formatCastka(poSplatnosti)} barva="red" />
      </div>

      {mesice && (
        <div className="card pad" style={{marginTop:20}}>
          <h3 style={{marginTop:0}}>Obrat po měsících ({mesice.r})</h3>
          <div className="graf">
            {mesice.sumy.map((s,i)=>(
              <div key={i} className="graf-sloupec">
                <div className="graf-bar-wrap">
                  <div className="graf-bar" style={{height: (s/mesice.max*100)+'%'}} title={formatCastka(s)}></div>
                </div>
                <div className="graf-popis">{nazvyMesicu[i]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{marginTop:20}}>
        <div className="pad" style={{paddingBottom:0}}><h3 style={{margin:0}}>Neuhrazené faktury ({neuhrazeneFaktury.length})</h3></div>
        {neuhrazeneFaktury.length===0
          ? <div className="empty">Žádné neuhrazené faktury. 🎉</div>
          : <table>
              <thead><tr><th>Číslo</th><th>Odběratel</th><th>Splatnost</th><th>Částka</th><th>Stav</th></tr></thead>
              <tbody>{neuhrazeneFaktury.map(f=>{
                const po = jePoSplatnosti(f)
                return (
                  <tr key={f.id} className="klik" onClick={()=>onDetail && onDetail(f.id)}>
                    <td>{f.cislo||'(koncept)'}</td>
                    <td>{f.odberatele?.nazev||'—'}</td>
                    <td>{f.datum_splatnosti||'—'}</td>
                    <td>{formatCastka(f.castka_celkem, f.mena)}</td>
                    <td><span className={'badge '+(po?'po_splatnosti':'vystavena')}>{po?'Po splatnosti':'Čeká na úhradu'}</span></td>
                  </tr>)
              })}</tbody>
            </table>}
      </div>
    </>
  )
}

function Dlazka({ label, value, barva }) {
  return (
    <div className={'dlazka'+(barva?(' d-'+barva):'')}>
      <div className="dlazka-label">{label}</div>
      <div className="dlazka-value">{value}</div>
    </div>
  )
}
