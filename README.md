# 🎾 Summerleague 2026

Tennis-Liga & Turnierverwaltung – vollständige Web-App mit Benutzerregistrierung, Turnierplanung, Ergebnisverwaltung und Admin-Panel.

## Features

### Benutzer
- **Registrierung** mit E-Mail-Verifizierung (6-stelliger Code per E-Mail)
- Login, Passwort vergessen / zurücksetzen
- Profilseite mit Foto-Upload, DTB-ID, LK (Leistungsklasse)
- Turnierübersicht & Anmeldung
- Ergebnis-Selbsteintragung mit Bestätigung per E-Mail

### Turniermodi
| Modus | Beschreibung |
|-------|-------------|
| **Liga** | Jeder-gegen-Jeden (Round Robin) mit optionalem LK-Handicap |
| **KO-Turnier** | Eliminationsformat mit Setzliste nach LK |
| **LK-Tagesturnier** | Je ein Match gegen bessere und schlechtere LK |
| **Doppelturnier** | Mehrere Runden mit festen oder zufälligen Partnern |

### Admin-Panel
- Dashboard mit Statistiken
- Benutzerverwaltung (CRUD)
- Turniererstellung mit allen Einstellungen (Regeln, Termine, Handicap, ...)
- Anmeldungen genehmigen / ablehnen, Setzplätze vergeben
- Auslosung generieren (für alle 4 Turniermodi)
- Ergebnisse eintragen, Einsprüche bearbeiten
- E-Mail-Log einsehen

### Ergebnisbestätigung
1. Spieler A meldet Ergebnis
2. Spieler B erhält E-Mail mit Bestätigungs-/Einspruch-Link
3. Bei Bestätigung → automatische Tabellen-/Bracket-Aktualisierung
4. Bei Einspruch → Admin wird benachrichtigt, entscheidet

---

## Tech-Stack

| Bereich | Technologie |
|---------|------------|
| Backend | Node.js, Express, better-sqlite3 |
| Frontend | React 18, Vite, React Router 7 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| E-Mail | Nodemailer (Gmail SMTP) |
| Upload | Multer (Profilfotos) |
| Deployment | Docker, Nginx, Let's Encrypt |

---

## Schnellstart (Entwicklung)

### Voraussetzungen
- Node.js ≥ 18h
- npm

### 1. Abhängigkeiten installieren

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Admin-Account anlegen

```bash
cd backend
npm run init-admin
```

Standard-Zugangsdaten stehen in `backend/.env`:
- **Benutzername:** `admin`
- **Passwort:** `SummerLeague2026!`

### 3. Backend starten

```bash
cd backend
npm run dev     # mit auto-reload (nodemon)
# oder
npm start       # ohne auto-reload
```

Server läuft auf `http://localhost:3001`

### 4. Frontend starten

```bash
cd frontend
npm run dev
```

Öffne `http://localhost:5173`

---

## Deployment auf NAS (Docker)

### 1. `.env`-Datei anpassen

Bearbeite `backend/.env` – setze mindestens:
- `JWT_SECRET` → eigenes langes Geheimnis
- `FRONTEND_URL` → deine Domain (z.B. `https://tennis.deine-domain.de`)
- E-Mail-Einstellungen prüfen

### 2. Nginx-Konfiguration

Bearbeite `nginx.conf`:
- Ersetze `deine-domain.de` durch deine echte Domain
- Kommentiere den HTTP-Block aus und die HTTPS-Blöcke ein, sobald SSL verfügbar ist

### 3. SSL-Zertifikat erstellen (Let's Encrypt)

Beim ersten Mal mit temporärem HTTP:

```bash
docker compose up -d nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d deine-domain.de
```

Dann in `nginx.conf` die HTTPS-Blöcke aktivieren und neu starten:

```bash
docker compose restart nginx
```

### 4. Alles starten

```bash
docker compose up -d --build
```

Die App ist dann erreichlich unter `https://deine-domain.de`

### Nur im lokalen Netzwerk (ohne SSL)

Die Standard-Konfiguration arbeitet bereits mit HTTP. Einfach:

```bash
docker compose up -d --build
```

Zugriff über `http://<NAS-IP>`

---

## Projektstruktur

```
├── backend/
│   ├── src/
│   │   ├── server.js            # Express-App + alle Routen
│   │   ├── config/
│   │   │   ├── database.js      # SQLite-Schema & Initialisierung
│   │   │   └── email.js         # Nodemailer-Konfiguration
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT-Authentifizierung
│   │   │   └── upload.js        # Multer für Foto-Upload
│   │   ├── routes/
│   │   │   ├── auth.js          # Register, Login, Verifizierung, Passwort
│   │   │   ├── admin.js         # Admin-Panel API
│   │   │   ├── tournaments.js   # Turnierübersicht & Anmeldung
│   │   │   ├── matches.js       # Ergebnismeldung & Bestätigung
│   │   │   └── users.js         # Profil, Foto, eigene Turniere/Matches
│   │   ├── services/
│   │   │   ├── emailService.js  # E-Mail-Templates
│   │   │   ├── leagueService.js # Liga-Rundenauslosung & Tabelle
│   │   │   └── bracketService.js# KO-, LK-Tag & Doppel-Auslosung
│   │   └── scripts/
│   │       └── initAdmin.js     # Admin-Account anlegen
│   ├── data/                    # SQLite-Datenbank (auto-erstellt)
│   ├── uploads/                 # Profilfotos
│   ├── package.json
│   ├── .env
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx             # React-Einstiegspunkt
│   │   ├── App.jsx              # Routing
│   │   ├── App.css              # Komplettes Design-System
│   │   ├── api.js               # Axios-Instanz mit Token-Interceptor
│   │   ├── context/AuthContext.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Login.jsx / Register.jsx / VerifyEmail.jsx
│   │       ├── ForgotPassword.jsx / ResetPassword.jsx
│   │       ├── Profile.jsx
│   │       ├── Tournaments.jsx / TournamentDetail.jsx
│   │       ├── ConfirmResult.jsx
│   │       ├── AdminLogin.jsx / AdminDashboard.jsx
│   │       ├── AdminUsers.jsx / AdminTournaments.jsx
│   │       ├── AdminTournamentEdit.jsx
│   │       └── AdminMatches.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── README.md
```

---

## API-Endpunkte (Übersicht)

### Auth (`/api/auth`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/register` | Registrierung |
| POST | `/verify-email` | E-Mail-Verifizierung |
| POST | `/resend-verification` | Code erneut senden |
| POST | `/login` | Anmeldung |
| POST | `/forgot-password` | Passwort-Reset anfordern |
| POST | `/reset-password` | Passwort zurücksetzen |
| GET | `/profile` | Eigenes Profil |
| PUT | `/profile` | Profil bearbeiten |

### Turniere (`/api/tournaments`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| GET | `/` | Alle Turniere |
| GET | `/:id` | Turnierdetails inkl. Matches, Tabelle |
| POST | `/:id/register` | Für Turnier anmelden |
| DELETE | `/:id/withdraw` | Abmelden |

### Matches (`/api/matches`)
| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/:id/report` | Ergebnis melden |
| POST | `/:id/confirm` | Ergebnis bestätigen |
| POST | `/:id/dispute` | Einspruch einlegen |

### Admin (`/api/admin`)
Vollständige CRUD-Operationen für Benutzer, Turniere, Anmeldungen, Matches, Auslosung, Einsprüche.

---

## Lizenz

Privates Projekt – nicht zur Weiterverbreitung bestimmt.
