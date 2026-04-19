function Datenschutz() {
  return (
    <div className="page-container" style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card">
        <h1>Datenschutzerklärung</h1>

        <h2>1. Verantwortlicher</h2>
        <p>
          Dr. Marcel Dunkel<br />
          Allinger Straße 2F<br />
          82205 Gilching<br />
          E-Mail: <a href="mailto:mdjunk7@freenet.de">mdjunk7@freenet.de</a>
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>2. Erhebung und Speicherung personenbezogener Daten</h2>
        <p>
          Bei der Registrierung auf unserer Plattform erheben wir folgende Daten:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Benutzername</li>
          <li>Name</li>
          <li>E-Mail-Adresse</li>
          <li>Telefonnummer</li>
          <li>DTB-ID (optional)</li>
          <li>Leistungsklasse (LK)</li>
          <li>Profilfoto (optional)</li>
        </ul>

        <h2 style={{ marginTop: '1.5rem' }}>3. Zweck der Datenverarbeitung</h2>
        <p>
          Wir verarbeiten Ihre Daten ausschließlich zur Organisation und Durchführung von
          Tennis-Turnieren im Rahmen der Summerleague. Dies umfasst:
        </p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Benutzerkonto-Verwaltung und Authentifizierung</li>
          <li>Turnieranmeldung und -verwaltung</li>
          <li>Ergebnismeldung und -bestätigung</li>
          <li>Kommunikation per E-Mail (Verifizierung, Ergebnisbestätigung, Passwort-Reset)</li>
        </ul>

        <h2 style={{ marginTop: '1.5rem' }}>4. Rechtsgrundlage</h2>
        <p>
          Die Verarbeitung erfolgt auf Grundlage Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO),
          die Sie bei der Registrierung erteilen.
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>5. Speicherdauer</h2>
        <p>
          Ihre Daten werden so lange gespeichert, wie Ihr Benutzerkonto besteht. Bei Löschung des
          Kontos werden alle personenbezogenen Daten entfernt.
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>6. Ihre Rechte</h2>
        <p>Sie haben das Recht auf:</p>
        <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Widerruf Ihrer Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
          <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
        </ul>

        <h2 style={{ marginTop: '1.5rem' }}>7. Cookies</h2>
        <p>
          Diese Website verwendet keine Tracking-Cookies. Es wird lediglich ein
          Authentifizierungs-Token (JWT) im lokalen Speicher des Browsers abgelegt, das für die
          Anmeldung erforderlich ist.
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>8. Hosting</h2>
        <p>
          Die Website wird auf einem privaten Server (NAS) betrieben. Es werden keine Daten an
          Dritte weitergegeben.
        </p>

        <h2 style={{ marginTop: '1.5rem' }}>9. Kontakt</h2>
        <p>
          Bei Fragen zum Datenschutz wenden Sie sich bitte an:<br />
          <a href="mailto:mdjunk7@freenet.de">mdjunk7@freenet.de</a>
        </p>
      </div>
    </div>
  );
}

export default Datenschutz;
