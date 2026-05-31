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
  const selectedId = params.stad && locations.some((location) => location.id === params.stad) ? params.stad : 'reykjavik';
  const selectedLocation = locations.find((location) => location.id === selectedId)!;
  const weather = await getWeatherSnapshots(locations, mockWeatherByLocationId);
  const scoredAll = locations.map((location) => scoreBongo(location, weather.snapshots[location.id]));
  const selectedScore = scoreBongo(selectedLocation, weather.snapshots[selectedLocation.id]);
  const topFive = rankLocations(locations, weather.snapshots, 5);
  const betterNearby = nearestBetterLocations(selectedLocation, scoredAll, selectedScore.score, 3);
  const dataLabel = weather.mode === 'live'
    ? 'lifandi spágögn frá MET Norway'
    : weather.mode === 'partial-live'
      ? `lifandi spágögn með mock-varaleið fyrir ${weather.failedLocationIds.length} staði`
      : 'mock-veðurgögn sem varaleið';
  const updatedAt = selectedScore.providerUpdatedAt || selectedScore.observedAt;

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">bongo.andri.is · lifandi veðurgögn með öruggri varaleið</p>
        <h1>Bongómælir</h1>
        <p className="lead">Hversu bongó er hjá þér?</p>
        <p className="intro">
          Bongó er ekki bara sól. Það er sól + logn + hiti + þurrt teppi. Nú notar Bongómælirinn
          {` ${dataLabel}`} og heldur mock-gögnum sem öruggri varaleið ef veðurþjónustan svarar ekki.
        </p>
        <div className="hero-actions">
          <a href="#maela" className="button primary">Mæla bongó</a>
          <a href="#hvar" className="button">Hvar er bongó?</a>
          <a href="#af-hverju" className="button ghost">Af hverju?</a>
        </div>
      </section>

      <section id="maela" className="panel grid-panel">
        <div>
          <p className="eyebrow">Velja stað</p>
          <h2>Staðbundinn Bongómælir</h2>
          <div className="location-list" aria-label="Velja stað til að mæla bongó">
            {locations.map((location) => (
              <a key={location.id} className={location.id === selectedId ? 'chip active' : 'chip'} href={`/?stad=${location.id}#maela`}>
                {location.name}
              </a>
            ))}
          </div>
        </div>

        <article className="score-card" aria-label={`Bongó skor fyrir ${selectedLocation.name}`}>
          <div className="score-topline">
            <span>{selectedLocation.name}</span>
            <strong>{selectedScore.label}</strong>
          </div>
          <div className="score-number">{pct(selectedScore.score)}</div>
          <p className="source-line">Gögn: {selectedScore.source || 'mock'} · uppfært {formatDateTime(updatedAt)}</p>
          <p>{selectedScore.explanation}</p>
          <dl className="factors">
            {Object.entries(selectedScore.factors).map(([key, factor]: [string, any]) => (
              <div key={key}>
                <dt>{factor.label}</dt>
                <dd>
                  <span>{factor.value}</span>
                  <strong>{factor.score}/100</strong>
                </dd>
              </div>
            ))}
          </dl>
        </article>
      </section>

      <section className="panel split">
        <div>
          <p className="eyebrow">Næsta betra bongó</p>
          <h2>Ef staðan er ekki nógu góð</h2>
          <p className="muted">Bongómælirinn sýnir aðeins staði sem skora hærra en valinn staður. Engin staðsetning vistuð, engir notendareikningar.</p>
        </div>
        <ol className="rank-list">
          {betterNearby.length > 0 ? betterNearby.map((entry) => (
            <li key={entry.location.id}>
              <span>{entry.location.name}</span>
              <small>{entry.distanceKm} km · {entry.label}</small>
              <strong>{pct(entry.score)}</strong>
            </li>
          )) : <li><span>Þú ert þegar í besta bongóinu.</span><strong>✓</strong></li>}
        </ol>
      </section>

      <section id="hvar" className="panel split top-five">
        <div>
          <p className="eyebrow">Topplisti</p>
          <h2>Hvar er bongó?</h2>
          <p className="muted">Topp 5 staðirnir miðað við {dataLabel}. Síðan cache-ar veðurköll í 15 mínútur og notar mock-varaleið ef þjónusta dettur út.</p>
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
        <h2>v1 er viljandi lítið</h2>
        <ul>
          <li>Engir notendareikningar, engar innsentar skýrslur og engar myndir.</li>
          <li>Engin API-lyklar eða credentials: veðurgögn eru sótt server-side frá opinni MET Norway Locationforecast þjónustu.</li>
          <li>Skorun er deterministic og þakin prófum: sól 35%, vindur 30%, hiti 20%, þurrt teppi 10%, dagsbirta 5%.</li>
          <li>Mock-gögn eru áfram til sem varaleið svo síðan brotni ekki þó lifandi veðurköll mistakist.</li>
        </ul>
      </section>
    </main>
  );
}

function formatDateTime(value?: string) {
  if (!value) return 'óþekkt';
  return new Intl.DateTimeFormat('is-IS', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Atlantic/Reykjavik',
  }).format(new Date(value));
}
