'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { BongoLocation, BongoFactor, BongoWindow, TimelineEntry } from '../lib/scoring.mjs';
import { isValidCoordinate } from '../lib/geo.mjs';
import type { BongoMood, BongoPayload } from '../lib/assemble.mjs';

const STORAGE_KEY = 'bongo.hnit.v2';
const TIME_ZONE = 'Atlantic/Reykjavik';

type Status = 'server' | 'locating' | 'you' | 'denied' | 'geo-error' | 'fetch-error';

const STATUS_TEXT: Partial<Record<Status, string>> = {
  locating: 'Sæki staðsetningu þína…',
  denied: 'Vafrinn fékk ekki leyfi til að sjá staðsetningu. Þú getur leyft hana í stillingum vafra — eða einfaldlega valið stað hér að neðan.',
  'geo-error': 'Gat ekki sótt staðsetningu. Prófaðu aftur eða veldu stað af listanum.',
  'fetch-error': 'Veðurþjónustan svarar ekki — sýni síðustu gildi.',
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function readSaved(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValidCoordinate(parsed?.lat, parsed?.lon)) return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    // Storage can be blocked (private mode etc.); the meter still works without it.
  }
  return null;
}

function writeSaved(point: { lat: number; lon: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...point, savedAt: new Date().toISOString() }));
  } catch {
    // Not fatal — we just cannot remember the spot next visit.
  }
}

function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'óþekkt';
  return new Intl.DateTimeFormat('is-IS', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

function formatHour(iso: string) {
  return new Intl.DateTimeFormat('is-IS', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

function zonedDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function weekdayShort(iso: string) {
  // Iceland is UTC year-round, so the UTC weekday is the local one. A fixed
  // table also keeps labels Icelandic on browsers without is-IS locale data.
  const WEEKDAYS = ['sun.', 'mán.', 'þri.', 'mið.', 'fim.', 'fös.', 'lau.'];
  return WEEKDAYS[new Date(iso).getUTCDay()];
}

function tierOf(score: number) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

// --- Gauge geometry ----------------------------------------------------------

const GAUGE_BOUNDS = [0, 20, 40, 60, 75, 90, 100];

function gaugePoint(score: number, radius: number) {
  const theta = ((180 - score * 1.8) * Math.PI) / 180;
  return { x: 100 + radius * Math.cos(theta), y: 100 - radius * Math.sin(theta) };
}

function arcPath(fromScore: number, toScore: number, radius: number) {
  const start = gaugePoint(fromScore, radius);
  const end = gaugePoint(toScore, radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function Gauge({ score, label, placeName }: { score: number; label: string; placeName: string }) {
  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 200 118" className="gauge" role="img" aria-label={`Bongó skor fyrir ${placeName}: ${score} af 100 — ${label}`}>
        {GAUGE_BOUNDS.slice(0, -1).map((bound, index) => (
          <path key={bound} d={arcPath(bound + 0.4, GAUGE_BOUNDS[index + 1] - 0.4, 80)} className={`gauge-seg seg-${index}`} />
        ))}
        {[0, 25, 50, 75, 100].map((tick) => {
          const outer = gaugePoint(tick, 94);
          const inner = gaugePoint(tick, 89);
          return <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="gauge-tick" />;
        })}
        <g className="gauge-needle" style={{ transform: `rotate(${score * 1.8}deg)` }}>
          <line x1="100" y1="100" x2="28" y2="100" />
        </g>
        <circle cx="100" cy="100" r="7" className="gauge-hub" />
      </svg>
      <div className="gauge-number" aria-hidden="true">{score}</div>
    </div>
  );
}

// --- Main island -------------------------------------------------------------

export default function BongoMeter({
  initial,
  canAutoLocate,
  stations,
}: {
  initial: BongoPayload;
  canAutoLocate: boolean;
  stations: BongoLocation[];
}) {
  const [payload, setPayload] = useState<BongoPayload>(initial);
  const [status, setStatus] = useState<Status>('server');
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayScore, setDisplayScore] = useState(initial.score);
  const prevScoreRef = useRef(initial.score);

  useEffect(() => {
    const target = payload.score;
    const from = prevScoreRef.current;
    prevScoreRef.current = target;
    if (from === target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayScore(target);
      return;
    }
    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayScore(Math.round(from + (target - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [payload.score]);

  async function loadCoords(point: { lat: number; lon: number }) {
    setPending(true);
    try {
      const response = await fetch(`/api/bongo?lat=${point.lat}&lon=${point.lon}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as BongoPayload;
      setPayload(data);
      setStatus('you');
    } catch {
      setStatus('fetch-error');
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (!canAutoLocate) return;
    const saved = readSaved();
    if (saved) void loadCoords(saved);
    // Only on mount: the parent remounts the island (via key) when ?stad changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatus('geo-error');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: round2(position.coords.latitude), lon: round2(position.coords.longitude) };
        writeSaved(point);
        void loadCoords(point);
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'geo-error'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  }

  function reset() {
    clearSaved();
    setPayload(initial);
    setStatus('server');
  }

  async function share() {
    const text = `${payload.place.name}: ${payload.score}% ${payload.label} á Bongómælinum. ${payload.windowMessage} bongo.andri.is`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; silently skip rather than error the UI.
    }
  }

  const windowRange = useMemo(() => {
    if (!payload.window) return null;
    return { start: Date.parse(payload.window.startTime), end: Date.parse(payload.window.endTime) };
  }, [payload.window]);

  const cells = useMemo(() => {
    let previousDay = '';
    return payload.timeline.slice(0, 40).map((cell) => {
      const day = zonedDay(cell.time);
      const showDay = day !== previousDay;
      previousDay = day;
      return { ...cell, showDay, dayLabel: weekdayShort(cell.time) };
    });
  }, [payload.timeline]);

  const statusText = STATUS_TEXT[status];
  const updatedAt = payload.providerUpdatedAt ?? payload.observedAt;

  return (
    <section id="maela" className="panel meter" data-mood={payload.mood}>
      <div className="meter-side">
        <p className="eyebrow">Staðsetning þín sjálfgefin</p>
        <h2>Mælirinn</h2>
        <p className="muted">
          Bongómælirinn notar staðsetningu þína þegar þú opnar síðuna. Hnitin eru námunduð að
          um það bil einnar kílómetra nákvæmni, vistuð aðeins í þínum vafra og aldrei send áfram.
        </p>
        <div className="meter-actions">
          <button
            type="button"
            className="btn primary"
            onClick={locate}
            disabled={pending || status === 'locating'}
          >
            {status === 'locating' ? 'Sæki staðsetningu…' : 'Mæla bongó hjá mér'}
          </button>
          {status === 'you' && (
            <button type="button" className="btn ghost" onClick={reset}>
              Tæma vistaða staðsetningu
            </button>
          )}
        </div>
        {statusText && <p className="status" role="status">{statusText}</p>}
        {(payload as BongoPayload & { degraded?: boolean }).degraded && (
          <p className="status status-warn" role="status">
            Athugið: veðurþjónustan svarar ekki — mælirinn sýnir varaleið frá næstu stöð.
          </p>
        )}

        <p className="eyebrow small">Eða veldu stað</p>
        <div className="chips">
          {stations.map((station) => (
            <a
              key={station.id}
              className={payload.place.id === station.id ? 'chip active' : 'chip'}
              href={`/?stad=${station.id}#maela`}
            >
              {station.name}
            </a>
          ))}
        </div>
      </div>

      <div className="meter-main">
        <article className="scorecard">
          <div className="score-topline">
            <span>{payload.place.name}</span>
            <strong className={`label-pill tier-${tierOf(payload.score)}`}>{payload.label}</strong>
          </div>

          <Gauge score={displayScore} label={payload.label} placeName={payload.place.name} />

          <p className="explanation">{payload.explanation}</p>
          <p className="source-line">
            Gögn: {payload.source} · uppfært {formatDateTime(updatedAt)}
          </p>

          <dl className="factors">
            {Object.entries(payload.factors).map(([key, factor]) => (
              <div key={key} className="factor">
                <dt>{(factor as BongoFactor).label}</dt>
                <dd>
                  <span className="factor-value">{(factor as BongoFactor).value}</span>
                  <span className="factor-bar" aria-hidden="true">
                    <span style={{ width: `${(factor as BongoFactor).score}%` }} />
                  </span>
                  <strong>{(factor as BongoFactor).score}/100</strong>
                </dd>
              </div>
            ))}
          </dl>

          <div className="score-actions">
            <button type="button" className="btn small" onClick={share}>
              {copied ? 'Afritað ✓' : 'Afrita niðurstöðu'}
            </button>
            <button type="button" className="btn small ghost" onClick={locate} disabled={pending || status === 'locating'}>
              Endurmæla
            </button>
          </div>
        </article>

        {cells.length > 0 && (
          <div className="forecast">
            <div className="forecast-head">
              <p className="eyebrow">Næstu 48 klukkustundir</p>
              <p className="window-msg">{payload.windowMessage}</p>
            </div>
            <div className="cells" tabIndex={0} aria-label="Klukkustundaspá fyrir næstu 48 klukkustundir">
              {cells.map((cell) => {
                const cellMs = Date.parse(cell.time);
                const inWindow = windowRange !== null && cellMs >= windowRange.start && cellMs < windowRange.end;
                return (
                  <div
                    key={cell.time}
                    className={`cell tier-${tierOf(cell.score)}${inWindow ? ' in-window' : ''}`}
                    title={`${cell.label} · ${cell.temperatureC}°C · ${cell.windMs} m/s · ${cell.daylight}`}
                  >
                    {cell.showDay && <span className="cell-day">{cell.dayLabel}</span>}
                    <span className="cell-time">kl. {formatHour(cell.time)}</span>
                    <strong className="cell-score">{cell.score}</strong>
                    <span className="cell-meta">{Math.round(cell.temperatureC)}° · {Math.round(cell.windMs)} m/s</span>
                  </div>
                );
              })}
            </div>
            <p className="forecast-foot">
              Frá sama MET Norway API-kallinu — engin aukaköll, engin aukagögn. Lituð reitur: grænt = bongó, gult = gluggaveður, rautt = farðu inn.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export type { BongoPayload, BongoMood, TimelineEntry, BongoWindow };
