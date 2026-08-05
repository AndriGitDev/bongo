'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="standalone">
      <p className="eyebrow">Úbbs</p>
      <h1>Mælirinn bilaði</h1>
      <p className="lead">Eitthvað fór úrskeiðis. Veðrið er örugglega samt einhvers staðar.</p>
      <button type="button" className="btn primary" onClick={reset}>Reyna aftur</button>
    </main>
  );
}
