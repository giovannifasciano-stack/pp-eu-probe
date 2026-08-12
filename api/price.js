// Lettore prezzi Patek con uscita europea (Francoforte).
// Legge SOLO patek.com: non e' un proxy aperto.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function cleanNum(s) {
  let x = s.replace(/[\u2019'\u00a0\s]/g, '');
  x = x.replace(/[.,](\d{2})$/, '');
  return +x.replace(/[^0-9]/g, '');
}

function parsePrice(raw) {
  const t = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&euro;/gi, '\u20AC')
    .replace(/&#8217;|&rsquo;/gi, '\u2019')
    .replace(/\s+/g, ' ');
  const tries = [
    [/(?:CHF|SFr\.?)\s?([\d][\d\u2019'.,\s]{3,})/i, 'CHF'],
    [/([\d][\d\u2019'.,\s]{3,})\s?(?:CHF|SFr\.?)/i, 'CHF'],
    [/\u20AC\s?([\d][\d.,\s]{3,})/, 'EUR'],
    [/([\d][\d.,\s]{3,})\s?\u20AC/, 'EUR'],
    [/\$\s?([\d][\d,]{3,})/, 'USD']
  ];
  for (const [re, cur] of tries) {
    const m = t.match(re);
    if (m) {
      const v = cleanNum(m[1]);
      if (v > 1000 && v < 100000000) return { cur, v };
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');

  const u = String(req.query.u || 'https://www.patek.com/en/collection/nautilus/5811-1g-001');
  if (!/^https:\/\/(www\.)?patek\.com\//i.test(u)) {
    return res.status(400).json({ ok: false, error: 'consentito solo patek.com' });
  }

  const out = { ok: false, url: u };

  // da dove esce davvero questo server
  try {
    const g = await fetch('https://ipapi.co/json/', { headers: { 'user-agent': UA } });
    const j = await g.json();
    out.uscita = { paese: j.country_name || j.country, citta: j.city, ip: j.ip };
  } catch (e) {
    out.uscita = null;
  }

  try {
    const r = await fetch(u, {
      headers: {
        'user-agent': UA,
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });
    const t = await r.text();
    out.http = r.status;
    out.pagina_finale = r.url;
    const p = parsePrice(t);
    if (p) {
      out.ok = true;
      out.valuta = p.cur;
      out.prezzo = p.v;
    } else {
      out.errore = 'nessun prezzo trovato nella pagina';
    }
  } catch (e) {
    out.errore = String(e && e.message ? e.message : e);
  }

  res.setHeader('cache-control', 'no-store');
  res.status(200).json(out);
}
