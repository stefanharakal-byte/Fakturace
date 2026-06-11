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

      await supabase.fro
