function Impressum() {
  return (
    <div className="page-container" style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card">
        <h1>Impressum</h1>

        <h2>Angaben gemäß § 5 TMG</h2>
        <p>
          Dr. Marcel Dunkel<br />
          Allinger Straße 2F<br />
          82205 Gilching
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:mdjunk7@freenet.de">mdjunk7@freenet.de</a>
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
          nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
          Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
          Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen.
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>Haftung für Links</h2>
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
          Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich.
        </p>
      </div>
    </div>
  );
}

export default Impressum;
