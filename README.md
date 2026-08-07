# Bongómælir / bongo.andri.is

Credential-free, privacy-first answer to the important Icelandic question: **Hversu bongó er hjá þér?**

Bongó er ekki bara sól. Það er sól + logn + hiti + þurrt teppi. Bongómælirinn les veðrið á
Íslandi og svarar spurningunni sem venjulegar veðurspár sleppa: er nógu gott til að fara út með teppi?

## v2

- **Þín staðsetning sjálfgefin.** Einn smellur á „Mæla bongó hjá mér“ — hnit eru námunduð að
  ~1 km nákvæmni, vistuð aðeins í þínum vafra og aldrei send áfram. Án leyfis fellur mælirinn
  blítt aftur í staðaval.
- **48 klukkustunda spá.** Klukkustundastrip úr sama MET Norway API-kallinu og augnabliksmælingin —
  engin aukaköll — með „Næsta bongó“ gluggaskynjun („Næstum bongó: í dag, kl. 19:00–22:00“).
- **Raunveruleg sólarstaða.** Dagsbirtuþátturinn notar reiknaða sólhæð (Cooper) í stað UTC-klukku:
  miðnætursól og skammdegi fá rétta meðferð.
- **Hvar er bongó?** Topp 5 af 16 stöðvum, og „næsta betra bongó“ miðað við valinn stað.
- **Öryggi og friðhelgi í fyrirrúmi.** Engir reikningar, engir API-lyklar, engin gögn á netþjóni.
  Veðurgögn server-side frá opinni MET Norway Locationforecast þjónustu með 15 mínútna millilager
  og mock-varaleið ef hún svarar ekki.
- Ljós og dökk þema, hreyfingar með `prefers-reduced-motion` virðingu, og allt prófað.

## Aðferð

Skorunin er deterministic og þakin prófum:

| Þáttur     | Vægi | Mælir                                   |
| ---------- | ---- | --------------------------------------- |
| Sól        | 35%  | Skýjahula                               |
| Vindur     | 30%  | Stöðugur vindur + hviður                |
| Hiti       | 20%  | 12–20°C er fullkomið                    |
| Teppið     | 10%  | Úrkoma (blautt teppi er ekki stemning)  |
| Dagsbirta  | 5%   | Sólhæð: bjart / lág sól / húm / dimmt   |

Íslenskur raunveruleiki: sól en hvass vindur er gluggaveður (þak ≤ 58), og rigning með skýjum
er ekki bongó (þak ≤ 35).

## Uppbygging

```
app/
  page.tsx            Server-side síða: topp 5, næsta betra, um, aðferð
  api/bongo/route.ts  GET ?lat&lon → staðfest, námunduð hnit, TTL cache, mock-varaleið
  layout.tsx          Metadata, viewport, tungumál
components/
  BongoMeter.tsx      Client island: staðsetning, mælir, spástrip, deiling
lib/
  scoring.mjs         Kjarninn: skorun, þök, topplistar, gluggaskynjun, skilaboð
  solar.mjs           Sólhæð, sólarhalli, dagsbirtuflokkar (prófað)
  metno.mjs           MET Norway adapter: snapshot + timeline úr einu kalli
  geo.mjs             Hnít: staðfesting, námundun, fjarlægð, næsti staður
  assemble.mjs        Sameiginlegt payload-form fyrir síðu og API
  mock-data.ts        16 stöðvar + mock-veður sem varaleið
tests/                node:test prófur fyrir alla kjarnann
```

## Local development

```bash
npm install
npm test        # node:test prófur
npm run lint    # tsc --noEmit
npm run build
npm run dev
```

## Vistun á Vercel

Verkefnið keyrir óbreytt á Vercel:

1. Flyttu repo-ið inn á [vercel.com](https://vercel.com) — Next.js greinist sjálfkrafa og
   `next build` er sjálfgefin byggingarskipun.
2. Node-útgáfan er fest með `engines` í `package.json` og samsvarar því sem CI keyrir.
3. Fyrir `bongo.andri.is`: bættu léninu við verkefnið í Vercel og settu CNAME-færslu á
   `cname.vercel-dns.com`. HTTPS fylgir sjálfkrafa, sem staðsetningar-API vafrans krefst.

Lítill fyrirvari fyrir serverless: minnislæga 15 mínútna skyndimennið í `/api/bongo` gildir
aðeins innan hvers keyrslutilviks. `s-maxage=900` í `Cache-Control` sér hins vegar um að
svörin eru geymd í skyndiminni á brún Vercels fyrir alla umferð, þannig að álagið á MET
Norway helst lítið þótt tilvik skalist út.

## Af hverju?

Þegar Andri var um 14 ára bjó hann til heimagerðan Bongómæli: LED-skilti í glugganum með orðinu
„bongó“, tengt við sólarpanel. Skiltið þurfti um 3W til að kvikna. 3W er lítið afl — nema á
Íslandi. Þá er það yfirlýsing. Ef skiltið kviknaði var bongó. Ef það kviknaði ekki var ekki bongó.

Þessi útgáfa er óvísindalega vísindaleg: hún mælir sól, vind, hita, úrkomu og dagsbirtu, en lofar
ekki opinberri veðurspá. Hún á að svara mannlegri spurningu sem venjulegar spár sleppa.

Veðurgögn: [MET Norway Locationforecast](https://www.met.no/) (CC BY 4.0).
