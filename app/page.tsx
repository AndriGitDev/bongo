import BongoMeter from '../components/BongoMeter';
import { assembleBongoPayload } from '../lib/assemble.mjs';
import { locations, mockWeatherByLocationId } from '../lib/mock-data';
import { getWeatherSnapshots } from '../lib/metno.mjs';
import { nearestBetterLocations, rankLocations, scoreBongo } from '../lib/scoring.mjs';

type SearchParams = Promise<{ stad?: string }>;

export const revalidate = 900;

function pct(score: number) {
  return `${score}%`;
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedId =
    params.stad && locations.some((location) => location.id === params.stad) ? params.stad : 'reykjavik';
  const selectedLocation = locations.find((location) => location.id === selectedId)!;

  const weather = await getWeatherSnapshots(locations, mockWeatherByLocationId);
  const scoredAll = locations.map((location) => scoreBongo(location, weather.snapshots[location.id]));
  const selectedScore = scoredAll.find((entry) => entry.location.id === selectedId)!;
  const topFive = rankLocations(locations, weather.snapshots, 5);
  const betterNearby = nearestBetterLocations(selectedLocation, scoredAll, selectedScore.score, 3);

  const initial = assembleBongoPayload(
    selectedLocation,
    { snapshot: weather.snapshots[selectedId], timeline: weather.timelines[selectedId] ?? [] },
  );

  const dataLabel =
    weather.mode === 'live'
      ? 'lifandi spágögn frá MET Norway'
      : weather.mode === 'partial-live'
        ? `lifandi spágögn með varaleið fyrir ${weather.failedLocationIds.length} staði`
        : 'varaleið með mock-veðurgögnum';

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">bongo.andri.is · óvísindalega vísindalegur mælikvarði</p>
        <h1>Bongómælir</h1>
        <p className="lead">Hversu bongó er hjá þér?</p>
        <p className="intro">
          Bongó er ekki bara sól. Það er sól, logn, hiti og þurrt teppi. Bongómælirinn les
          íslenska veðrið — með þína staðsetningu sjálfgefinna — og svarar spurningunni sem
          venjulegar veðurspár sleppa: er nógu gott til að fara út með teppi?
        </p>
        <div className="hero-actions">
          <a href="#maela" className="btn primary">Mæla bongó</a>
          <a href="#hvar" className="btn">Hvar er bongó?</a>
          <a href="#af-hverju" className="btn ghost">Af hverju?</a>
        </div>
      </header>

      <BongoMeter key={selectedId} initial={initial} canAutoLocate={!params.stad} stations={locations} />

      <section id="hvar" className="panel split top-five">
        <div>
          <p className="eyebrow">Topplisti</p>
          <h2>Hvar er bongó?</h2>
          <p className="muted">
            Topp 5 staðirnir af {locations.length} miðað við {dataLabel}. Síðan endurnýtir sama
            API-kallið í 48 klukkustunda spá og notar mock-varaleið ef þjónustan dettur út.
          </p>
        </div>
        <ol className="rank-list">
          {topFive.map((entry, index) => (
            <li key={entry.location.id}>
              <span>{index + 1}. {entry.location.name}</span>
              <small>{entry.label}</small>
              <strong>{pct(entry.score)}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel split">
        <div>
          <p className="eyebrow">Næsta betra bongó</p>
          <h2>Ef staðan er ekki nógu góð</h2>
          <p className="muted">
            Miðað við {selectedLocation.name}: aðeins staðir sem skora hærra, raðað eftir fjarlægð.
            Engin staðsetning vistuð á netþjóni, engir notendareikningar.
          </p>
        </div>
        <ol className="rank-list">
          {betterNearby.length > 0 ? (
            betterNearby.map((entry) => (
              <li key={entry.location.id}>
                <span>{entry.location.name}</span>
                <small>{entry.distanceKm} km · {entry.label}</small>
                <strong>{pct(entry.score)}</strong>
              </li>
            ))
          ) : (
            <li>
              <span>Þú ert þegar í besta bongóinu.</span>
              <strong aria-hidden="true">✓</strong>
            </li>
          )}
        </ol>
      </section>

      <section id="af-hverju" className="about">
        <p className="eyebrow">Af hverju?</p>
        <h2>Frá 3W LED-skilti í glugga yfir í Bongómæli fyrir allt Ísland.</h2>
        <p>
          Þegar Andri var um 14 ára bjó hann til heimagerðan Bongómæli: LED-skilti í glugganum
          með orðinu „bongó“, tengt við sólarpanel. Skiltið þurfti um 3W til að kvikna.
        </p>
        <p>
          3W er lítið afl. Nema á Íslandi. Þá er það yfirlýsing. Sólin í gegnum íslenskan glugga
          var það veik að hann notaði um það bil 80 × 40 cm fjögurra panela sólarsellu-array bara til
          að fá nóg afl. Ef skiltið kviknaði var bongó. Ef það kviknaði ekki var ekki bongó.
        </p>
        <p>
          Þessi útgáfa er óvísindalega vísindaleg: hún mælir sól, vind, hita, úrkomu og dagsbirtu,
          en lofar ekki opinberri veðurspá. Hún á að svara mannlegri spurningu sem venjulegar spár sleppa:
          er nógu gott til að fara út?
        </p>
      </section>

      <section className="method panel">
        <p className="eyebrow">Aðferð og friðhelgi</p>
        <h2>v2 byggir á sömu reglum — bara stærri</h2>
        <ul>
          <li>
            Engir notendareikningar og engar persónuupplýsingar á netþjóni. Staðsetning þín er
            námunduð að ~1 km, vistuð aðeins í þínum vafra og notuð einvörðungu til að sækja veður.
          </li>
          <li>
            Engir API-lyklar: veðurgögn eru sótt server-side frá opnu MET Norway Locationforecast
            þjónustunni, með 15 mínútna millilager og mock-varaleið ef hún svarar ekki.
          </li>
          <li>
            Skorun er deterministic og þakin prófum: sól 35%, vindur 30%, hiti 20%, þurrt teppi 10%,
            dagsbirta 5%. Dagsbirtan kemur nú frá raunverulegri sólarstöðu — miðnætursól og skammdegi
            fá réttu meðferðina.
          </li>
          <li>
            48 klukkustunda klukkustundaspáin kemur úr nákvæmlega sama API-kalli og augnabliksmælingin —
            engin aukaköll, engin auka gögn.
          </li>
        </ul>
      </section>

      <footer className="site-footer">
        <p>
          Veðurgögn: <a href="https://www.met.no/" rel="noopener">MET Norway Locationforecast</a> (CC BY 4.0)
          {' · '}síðast uppfært samkvæmt veðurþjónustu {formatDateTime(initial.providerUpdatedAt ?? initial.observedAt)}.
        </p>
        <p>
          Bongómælir er ekki veðurstofa — hann er stemningarmælir. Tektu spána með fyrirvara og teppið eftir tilfinningu.
        </p>
      </footer>
    </main>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return 'óþekkt';
  return new Intl.DateTimeFormat('is-IS', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Atlantic/Reykjavik',
  }).format(new Date(value));
}
