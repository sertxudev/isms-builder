// © 2026 Claude Hecker — ISMS Builder V 1.29 — AGPL-3.0
'use strict'

const fs   = require('fs')
const path = require('path')

const _BASE = process.env.DATA_DIR || path.join(__dirname, '../../data')
const DATA_FILE = path.join(_BASE, 'guidance.json')
const FILES_DIR = path.join(_BASE, 'guidance/files')

function ensureDir() {
  if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })
}

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return [] }
}

function save(docs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2))
}

function nowISO() { return new Date().toISOString() }

function makeId() {
  return 'guid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

const VALID_CATEGORIES = ['systemhandbuch', 'rollen', 'policy-prozesse', 'soa-audit', 'admin-intern']

const ROLE_RANK = { reader: 1, revision: 1, editor: 2, dept_head: 2, qmb: 2, contentowner: 3, auditor: 3, admin: 4 }

function _roleRank(role) { return ROLE_RANK[(role || '').toLowerCase()] || 1 }

function _visibleFor(doc, userRank) {
  if (!doc.minRole) return true
  return userRank >= (_roleRank(doc.minRole))
}

function getAll(userRank) {
  const rank = userRank != null ? userRank : 1
  return load().filter(d => !d.deletedAt && _visibleFor(d, rank)).map(d => publicDoc(d))
}

function getByCategory(cat, userRank) {
  const rank = userRank != null ? userRank : 1
  return load()
    .filter(d => d.category === cat && !d.deletedAt && _visibleFor(d, rank))
    .sort((a, b) => {
      const ap = a.pinOrder != null ? a.pinOrder : Infinity
      const bp = b.pinOrder != null ? b.pinOrder : Infinity
      if (ap !== bp) return ap - bp
      return new Date(a.createdAt) - new Date(b.createdAt)
    })
    .map(d => publicDoc(d))
}

function getById(id) {
  const doc = load().find(d => d.id === id && !d.deletedAt)
  return doc ? doc : null   // return full doc including filePath
}

function create({ category, title, type, content, filename, filePath, createdBy, minRole, linkedControls }) {
  if (!VALID_CATEGORIES.includes(category)) throw new Error('Invalid category')
  const docs = load()
  const doc = {
    id: makeId(),
    category,
    title: title || 'Ohne Titel',
    type: type || 'markdown',
    content: content || '',
    filename: filename || null,
    filePath: filePath || null,
    linkedControls: Array.isArray(linkedControls) ? linkedControls : [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    createdBy: createdBy || 'system',
    version: 1,
    minRole: minRole || null
  }
  docs.push(doc)
  save(docs)
  return publicDoc(doc)
}

function update(id, fields) {
  const docs = load()
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return null
  const doc = docs[idx]
  if (fields.title          !== undefined) doc.title    = fields.title
  if (fields.category       !== undefined && VALID_CATEGORIES.includes(fields.category)) doc.category = fields.category
  if (fields.content        !== undefined) doc.content  = fields.content
  if (fields.filename       !== undefined) doc.filename = fields.filename
  if (fields.filePath       !== undefined) doc.filePath = fields.filePath
  if (fields.linkedControls !== undefined) doc.linkedControls = Array.isArray(fields.linkedControls) ? fields.linkedControls : []
  doc.updatedAt = nowISO()
  doc.version   = (doc.version || 1) + 1
  docs[idx] = doc
  save(docs)
  return publicDoc(doc)
}

function del(id, deletedBy) {
  const docs = load()
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return false
  // Soft-Delete: do NOT delete physical file here
  docs[idx].deletedAt = new Date().toISOString()
  docs[idx].deletedBy = deletedBy || null
  save(docs)
  return true
}

function permanentDelete(id) {
  const docs = load()
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return false
  const doc = docs[idx]
  // delete physical file if exists (only on hard delete)
  if (doc.filePath && fs.existsSync(doc.filePath)) {
    try { fs.unlinkSync(doc.filePath) } catch {}
  }
  docs.splice(idx, 1)
  save(docs)
  return true
}

function restore(id) {
  const docs = load()
  const idx = docs.findIndex(d => d.id === id)
  if (idx === -1) return null
  docs[idx].deletedAt = null
  docs[idx].deletedBy = null
  save(docs)
  return publicDoc(docs[idx])
}

function getDeleted() {
  return load().filter(d => d.deletedAt).map(d => publicDoc(d))
}

function getFilePath(id) {
  const doc = load().find(d => d.id === id)
  return doc ? doc.filePath : null
}

// Strip filePath from public responses (internal path)
function publicDoc(doc) {
  const { filePath, ...rest } = doc
  return rest
}

ensureDir()

// ── Seed: Architekturdokumentation als admin-intern Guidance ─────────────────

const ARCH_DOCS_ROOT = path.join(__dirname, '../../docs/architecture')
const PROJECT_ROOT   = path.join(__dirname, '../../')

const ARCH_SEED = [
  {
    seedId:   'seed_readme',
    title:    'ISMS Builder – Projektübersicht (README)',
    srcFile:  path.join(PROJECT_ROOT, 'README.md'),
  },
  {
    seedId:   'seed_contributing',
    title:    'Beitrag leisten – Developer Guide (CONTRIBUTING)',
    srcFile:  path.join(PROJECT_ROOT, 'CONTRIBUTING.md'),
  },
  {
    seedId:   'seed_c4',
    title:    'Architektur-Diagramme (C4 Model)',
    srcFile:  path.join(ARCH_DOCS_ROOT, 'c4-diagrams.md'),
  },
  {
    seedId:   'seed_datamodel',
    title:    'Datenmodell – JSON-Schemas aller Module',
    srcFile:  path.join(ARCH_DOCS_ROOT, 'data-model.md'),
  },
  {
    seedId:   'seed_openapi',
    title:    'API-Referenz (OpenAPI 3.0)',
    srcFile:  path.join(ARCH_DOCS_ROOT, 'openapi.yaml'),
    wrapCode: 'yaml',   // wrap non-markdown files in fenced code block
  },
  {
    seedId:   'seed_isms_build_documentation',
    title:    'ISMS Builder – Vollständige Architekturdokumentation',
    srcFile:  path.join(PROJECT_ROOT, 'docs/ISMS-build-documentation.md'),
  },
]

function seedArchitectureDocs() {
  const docs = load()
  let changed = false

  for (const entry of ARCH_SEED) {
    // Skip if already seeded (check by seedId marker in content)
    if (docs.some(d => d.seedId === entry.seedId && !d.deletedAt)) continue
    if (!fs.existsSync(entry.srcFile)) continue

    let content = fs.readFileSync(entry.srcFile, 'utf8')
    if (entry.wrapCode) {
      content = `\`\`\`${entry.wrapCode}\n${content}\n\`\`\``
    }

    docs.push({
      id:          'guid_arch_' + entry.seedId,
      seedId:      entry.seedId,
      category:    'admin-intern',
      title:       entry.title,
      type:        'markdown',
      content,
      minRole:     'admin',
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      deletedAt:   null,
      deletedBy:   null,
      createdBy:   'system',
      linkedControls: [],
      linkedPolicies: [],
    })
    changed = true
  }

  if (changed) save(docs)
}

const DEMO_GUIDE_SEED_ID = 'seed_demo_overview'
const DEMO_GUIDE_CONTENT = `# Demo-Betrieb – Übersicht & Übergabe in den Produktivbetrieb

> Dieser Beitrag erscheint automatisch, solange das System im Demo-Modus betrieben wird.
> Er erklärt die vorhandenen Demo-Daten, Zugangsdaten und den Weg in den Produktivbetrieb.

---

## Demo-Zugangsdaten

| Benutzername | Passwort    | Rolle         | Domäne | Besonderheiten                      |
|---|---|---|---|---|
| admin        | adminpass   | Administrator | Global | Voller Zugriff, CISO + DSO-Funktion |
| alice        | alicepass   | Abteilungsleiter | IT  | Zugriff auf Guidance & Risiken      |
| bob          | bobpass     | Leser         | HR     | Nur-Lese-Zugriff                    |

> **Sicherheitshinweis:** Diese Passwörter sind öffentlich bekannt. Vor dem Produktiveinsatz müssen alle Passwörter geändert werden.

---

## Vorhandene Demo-Daten

Das System enthält realistische Beispieldaten für folgende Module:

| Modul | Demo-Inhalt |
|---|---|
| **Richtlinien (Templates)** | Informationssicherheitsrichtlinie, Passwort-Policy, BYOD-Richtlinie, Backup-Policy, Zugangskontroll-Policy (je als Draft / Review / Approved) |
| **SoA** | 313 Controls über 8 Frameworks (ISO 27001, BSI, NIS2, EUCS, EUAI, ISO 9001, CRA) — alle bearbeitbar |
| **Risikomanagement** | 12 realistische Risiken mit Multi-Framework-Verlinkung (Ransomware, Phishing, Insider-Threat, Supply-Chain-Angriff u.a.) |
| **GDPR & Datenschutz** | Verarbeitungsverzeichnis (VVT), Auftragsverarbeitungsverträge (AV), TOMs, DSFA-Einträge, 72h-Timer-Demo |
| **Assets** | 8 Unternehmens-Assets (Server, Workstations, ERP, Cloud-Services, Netzwerkinfrastruktur) mit Klassifizierung |
| **Lieferketten** | 6 Lieferanten (Microsoft, DATEV, SAP, Cisco, AWS EMEA, Hetzner) inkl. NIS2/EUCS-Verlinkung |
| **BCM / BCP** | 8 Business-Impact-Analysen, 7 Continuity-Pläne, 6 Übungen |
| **Governance** | 3 Management-Reviews mit Maßnahmen und Meetingprotokollen |
| **Training** | 3 Schulungsmaßnahmen (ISO-Awareness, DSGVO, Phishing-Simulation) |
| **Rechtliches (Legal)** | 3 Verträge, 2 NDAs, 2 Datenschutzrichtlinien |
| **Sicherheitsziele** | 4 KPI-Ziele mit Fortschrittsbalken (Vulnerability-Response, Patch-Compliance, Phishing-Rate, Awareness) |
| **Vorfälle (Inbox)** | 10 Demo-Meldungen aus dem öffentlichen Vorfall-Meldeformular |
| **Guidance** | Systemhandbuch, Rollen-Dokumentation, Policy-Prozesse, SoA-Audit-Guide |

---

## Übergang in den Produktivbetrieb

### Schritt-für-Schritt

1. **Admin-Konsole öffnen** → Tab **Wartung**
2. **Demo-Reset durchführen:**
   - Sektion "Demo-Reset" anklicken
   - Im Bestätigungs-Dialog das Wort \`RESET\` eintippen
   - Das System exportiert automatisch alle Demo-Daten als JSON-Download (Backup)
   - Alle Moduldaten werden geleert, alle Benutzer außer \`admin\` gelöscht
   - Admin-Passwort wird auf \`adminpass\` zurückgesetzt, 2FA deaktiviert
3. **Auf die Login-Seite weiterleitet** — der gelbe Banner bestätigt den erfolgreich abgeschlossenen Reset
4. **Mit \`admin\` / \`adminpass\` anmelden** — Banner verschwindet, System ist produktionsbereit
5. **Sofort Passwort ändern:** Einstellungen → Passwort ändern
6. **2FA einrichten:** Einstellungen → 2FA aktivieren
7. **Eigene Benutzer anlegen:** Admin-Konsole → Tab Benutzer
8. **Eigene Inhalte erstellen:** alle Module sind leer und einsatzbereit

### Was bleibt nach dem Reset erhalten?

| Erhalten | Geleert |
|---|---|
| SoA-Controls (alle 313) | Templates / Policies |
| Dropdown-Listen | Risiken |
| Organisations-Einstellungen | Assets, BCM, Governance |
| (Admin-User) | Lieferanten, Legal, Training |
| | GDPR-Daten, Guidance |
| | Audit-Log, Sicherheitsziele |

---

## Demo-Daten wiederherstellen

Falls die Demo erneut gezeigt werden soll:

1. **Admin-Konsole → Wartung → "Demo-Daten importieren"**
2. Die beim Demo-Reset heruntergeladene JSON-Datei auswählen
3. Alle Moduldaten werden wiederhergestellt
4. alice und bob werden mit Original-Passwörtern und ohne 2FA neu angelegt
5. Der admin-Account bleibt unverändert

---

## Weitere Informationen

- **Architekturdokumentation & API-Referenz:** Guidance → Admin-intern
- **Rollenbeschreibungen:** Guidance → Rollen & Verantwortlichkeiten
- **Projektseite:** [GitHub – ISMS Builder](https://github.com/claudehecker/isms-builder)
- **Lizenz:** GNU Affero General Public License v3.0 (AGPL-3.0)
`

function seedDemoDoc() {
  const docs = load()
  let changed = false
  const existing = docs.find(d => d.seedId === DEMO_GUIDE_SEED_ID && !d.deletedAt)
  if (!existing) {
    docs.unshift({
      id:             'guid_demo_overview',
      seedId:         DEMO_GUIDE_SEED_ID,
      category:       'systemhandbuch',
      title:          'Demo-Betrieb – Übersicht & Übergabe in den Produktivbetrieb',
      type:           'markdown',
      content:        DEMO_GUIDE_CONTENT,
      pinOrder:       1,
      minRole:        null,
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
      deletedAt:      null,
      deletedBy:      null,
      createdBy:      'system',
      linkedControls: [],
      linkedPolicies: [],
    })
    changed = true
  } else if (existing.pinOrder == null) {
    existing.pinOrder = 1
    changed = true
  }
  // pinOrder 5 für bestehenden Systemhandbuch-Beitrag setzen (falls noch nicht gesetzt)
  const sysDoc = docs.find(d => d.id === 'guid_system_001' && !d.deletedAt)
  if (sysDoc && sysDoc.pinOrder == null) { sysDoc.pinOrder = 5; changed = true }
  if (changed) save(docs)
}

// ── Rollen-Bedienungsanleitungen ─────────────────────────────────────────────

const ROLE_GUIDES = [
  {
    seedId:   'seed_guide_ciso',
    id:       'guid_guide_ciso',
    pinOrder: 10,
    title:    'Bedienungsanleitung: CISO / Informationssicherheitsbeauftragter (ISB)',
    minRole:  null,
    content: `# Bedienungsanleitung: CISO / ISB

Der CISO (Chief Information Security Officer) bzw. Informationssicherheitsbeauftragte (ISB) trägt die Gesamtverantwortung für das ISMS. Diese Anleitung erklärt die wichtigsten Module und täglichen Aufgaben.

---

## Zuständige Module im Überblick

| Modul | Aufgabe | Wo im System |
|---|---|---|
| **Risikomanagement** | Risiken erfassen, bewerten, behandeln | Menü: Risiken |
| **SoA** | Controls bewerten, Anwendbarkeit & Status pflegen | Menü: SoA |
| **Sicherheitsziele** | KPIs definieren, Fortschritt verfolgen | Menü: Sicherheitsziele |
| **Vorfälle (CISO-Inbox)** | Gemeldete Sicherheitsvorfälle bearbeiten | Menü: Vorfälle |
| **Lieferketten** | Lieferanten überwachen, NIS2-Pflichten | Menü: Lieferketten |
| **BCM / BCP** | Business Impact Analysen, Pläne, Übungen | Menü: BCM |
| **Governance** | Management-Reviews, Maßnahmenpakete | Menü: Governance |
| **Reports** | Compliance-Matrix, Gap-Report, CSV-Export | Menü: Reports |
| **Einstellungen (CISO)** | SLA, Meldepflicht-Schwelle, Eskalations-E-Mail | Menü: Einstellungen |

---

## Tagesgeschäft – Typische Aufgaben

### Risiken bewerten
1. **Risiken → Neue Risiko** — Bedrohung, Wahrscheinlichkeit (1–5), Auswirkung (1–5) eintragen
2. Score = Wahrscheinlichkeit × Auswirkung (automatisch berechnet)
3. **Behandlungsmaßnahmen** per Klick auf einen Risikoeintrag → Tab "Behandlung"
4. Verknüpfung mit SoA-Controls über "🔗 Verknüpfungen" im Bearbeitungsformular

### SoA-Controls pflegen
1. **SoA → Framework-Tab** wählen (ISO 27001, NIS2, EUCS, BSI …)
2. Control anklicken → Status setzen (applicable / not-applicable / partial)
3. Begründung und Maßnahmen eintragen
4. **Inline-Edit:** Doppelklick auf ein Feld für schnelle Änderungen

### NIS2-Meldepflicht (72h-Frist)
- Sicherheitsvorfälle mit "Meldepflichtig"-Status in CISO-Inbox → BSI-Meldung vorbereiten
- Meldepflicht-Schwelle in **Einstellungen → CISO/ISB** konfigurieren
- Timer läuft ab Erfassung; Eskalations-E-Mail automatisch nach SLA

### Management-Review vorbereiten
1. **Governance → Management-Review → Neuer Review**
2. Tagesordnung, Teilnehmer, Beschlüsse eintragen
3. Maßnahmen direkt im Review verknüpfen
4. **Reports → Compliance-Matrix** als Anlage zum Review exportieren (CSV)

---

## CISO-Einstellungen konfigurieren
**Einstellungen → Abschnitt "CISO / ISB":**
- Eskalations-E-Mail (Benachrichtigung bei kritischen Vorfällen)
- Response-SLA in Stunden
- Meldepflicht-Schwelle (ab welchem Risikoscore wird NIS2-Meldung ausgelöst)
- Meldepflichtige Vorfallsarten

---

## Reports & Nachweise
| Report | Aufruf | Format |
|---|---|---|
| Compliance-Matrix | Reports → Compliance-Matrix | Tabelle + CSV |
| Gap-Report (fehlende Controls) | Reports → Gap-Report | Tabelle + CSV |
| Framework-Übersicht | Reports → Framework | Tabelle |
| Risiko-Liste | Risiken → Export (CSV) | CSV |

---

## Hinweise zur Weisungsunabhängigkeit
Der CISO/ISB berichtet direkt an die Geschäftsführung (ISO 27001 Kap. 5.1).
Die Funktion darf nicht in Konflikt mit operativen IT-Aufgaben stehen.
`,
  },
  {
    seedId:   'seed_guide_dsb',
    id:       'guid_guide_dsb',
    pinOrder: 20,
    title:    'Bedienungsanleitung: DSB / Datenschutzbeauftragter (GDPO)',
    minRole:  null,
    content: `# Bedienungsanleitung: DSB / Datenschutzbeauftragter (GDPO)

Der Datenschutzbeauftragte (DSB / GDPO) überwacht die Einhaltung der DSGVO und verwandter Datenschutzvorschriften.

> **Weisungsunabhängigkeit:** Der DSB ist gemäß Art. 38 Abs. 3 DSGVO bei der Ausübung seiner Aufgaben weisungsfrei und darf wegen seiner Aufgabenerfüllung nicht abberufen oder benachteiligt werden. Er berichtet unmittelbar an die höchste Managementebene.

---

## Zuständige Module im Überblick

| Modul | Aufgabe | Wo im System |
|---|---|---|
| **VVT** | Verarbeitungsverzeichnis (Art. 30 DSGVO) | Datenschutz → VVT |
| **AV-Verträge** | Auftragsverarbeitungsverträge prüfen | Datenschutz → AV |
| **DSFA** | Datenschutz-Folgenabschätzung (Art. 35) | Datenschutz → DSFA |
| **TOMs** | Technische & org. Maßnahmen dokumentieren | Datenschutz → TOMs |
| **DSAR** | Betroffenenrechte, Auskunftsersuchen | Datenschutz → DSAR |
| **72h-Timer** | Meldepflicht-Fristenüberwachung | Datenschutz → Vorfälle |
| **Löschprotokoll** | Art. 17 Löschungsnachweis | Datenschutz → Löschprotokoll |
| **Datenschutzrichtlinien** | Aktuelle Policies verwalten | Rechtliches → Policies |
| **Einstellungen (GDPO)** | DSAR-Fristen, DSB-Kontakt, Behörden | Einstellungen |

---

## Tagesgeschäft – Typische Aufgaben

### Verarbeitungsverzeichnis pflegen (VVT)
1. **Datenschutz → VVT → Neuer Eintrag**
2. Pflichtfelder: Bezeichnung, Zweck, Rechtsgrundlage (Art. 6/9), Datenkategorien, Betroffene, Empfänger, Löschfristen
3. Drittlandübermittlung: Land + Garantie (SCCs, BCRs) eintragen
4. CSV-Export über den "CSV"-Button in der Filter-Leiste

### DSFA durchführen (Art. 35 DSGVO)
1. **Datenschutz → DSFA → Neue Abschätzung**
2. Schwellenwert-Prüfung: Risikobewertung für Rechte und Freiheiten
3. Vorgesehene Maßnahmen und Restrisiko dokumentieren
4. Status: Entwurf → In Prüfung → Abgeschlossen

### 72h-Meldepflicht verwalten
1. Datenschutzverletzung in **Datenschutz → Vorfälle** erfassen
2. System startet automatisch 72h-Countdown ab Erfassung
3. Bei Ablauf: Meldung an Aufsichtsbehörde dokumentieren
4. Behörden-Kontakt in **Einstellungen → DSB/GDPO** hinterlegen

### DSAR bearbeiten (Auskunftsersuchen)
1. **Datenschutz → DSAR → Neues Ersuchen**
2. Fristberechnung automatisch nach GDPO-Einstellungen (Standard: 30 Tage, verlängerbar auf 90 Tage)
3. Status: Eingegangen → In Bearbeitung → Abgeschlossen / Abgelehnt

---

## GDPO-Einstellungen konfigurieren
**Einstellungen → Abschnitt "DSB / GDPO":**
- DSAR-Standardfrist (Tage)
- Verlängerte Frist (bei komplexen Ersuchen)
- Zuständige Datenschutzbehörde
- Standard-Antworttext für Betroffene

---

## Nachweise & Dokumentation
| Dokument | Aufruf | Art. DSGVO |
|---|---|---|
| Verarbeitungsverzeichnis (CSV) | VVT → CSV exportieren | Art. 30 |
| DSFA-Bericht | DSFA → Detailansicht | Art. 35 |
| AV-Vertragsübersicht | Datenschutz → AV | Art. 28 |
| TOM-Nachweis | Datenschutz → TOMs | Art. 32 |
| Löschprotokoll | Datenschutz → Löschprotokoll | Art. 17 |
`,
  },
  {
    seedId:   'seed_guide_revision',
    id:       'guid_guide_revision',
    pinOrder: 30,
    title:    'Bedienungsanleitung: Interne Revision',
    minRole:  null,
    content: `# Bedienungsanleitung: Interne Revision

Die Interne Revision prüft die Wirksamkeit des ISMS und der internen Kontrollsysteme unabhängig von operativen Stellen.

> **Weisungsunabhängigkeit:** Die Interne Revision ist gemäß AktG § 91 Abs. 2, IDW PS 321 und IIA-Standard 1100 funktional und organisatorisch unabhängig. Sie untersteht direkt dem Vorstand / der Geschäftsführung bzw. dem Prüfungsausschuss des Aufsichtsrats und ist von operativen Bereichen weisungsfrei.

---

## Zuständige Module im Überblick

| Modul | Prüfgegenstand | Wo im System |
|---|---|---|
| **SoA** | Umsetzungsstatus aller Controls | Menü: SoA |
| **Reports** | Compliance-Matrix, Gap-Bericht, Review-Zyklen | Menü: Reports |
| **Audit-Log** | Nachvollziehbarkeit aller Systemaktionen | Admin-Konsole → Audit-Log |
| **Risikomanagement** | Vollständigkeit Risikoregister, Behandlungsstand | Menü: Risiken |
| **Governance** | Management-Review-Protokolle, Maßnahmenstand | Menü: Governance |
| **Training** | Schulungsnachweis, Abdeckungsgrad | Menü: Training |
| **BCM** | Übungsberichte, BIA-Aktualität | Menü: BCM |
| **Einstellungen (Revision)** | Prüfungsumfang, Rhythmus, Berichtswesen | Einstellungen |

---

## Prüfungshandlungen – Typische Aufgaben

### Compliance-Stand erheben
1. **Reports → Compliance-Matrix:** Ampeldarstellung Control × Gesellschaft
2. Rote Felder = fehlende Umsetzung → Nachfragen beim Modulverantwortlichen
3. **Reports → Gap-Report:** alle Controls mit Status "not applicable" oder ohne Maßnahme
4. CSV-Export als Arbeitspapier

### SoA-Controls prüfen
1. **SoA → Framework auswählen** (ISO 27001, NIS2, BSI …)
2. Filter "not-applicable" setzen → Begründungen auf Plausibilität prüfen
3. Stichproben: Controls "applicable" mit Status "planned/partial" → Umsetzungsnachweis anfordern

### Audit-Log auswerten (Admin-Zugang erforderlich)
1. **Admin-Konsole → Audit-Log**
2. Filter nach Zeitraum, Benutzer oder Aktion
3. Kritische Aktionen: permanent_delete, demo_reset, settings-Änderungen

### Risikobewertung nachvollziehen
1. **Risiken → Liste:** Score, Datum der letzten Bearbeitung, Behandlungsstatus prüfen
2. Unbehandelte Hochrisiken (Score ≥ 15) identifizieren
3. Verknüpfte Controls im Detail-Panel nachvollziehen

### Management-Reviews beurteilen
1. **Governance → Management Reviews:** Vollständigkeit der Tagesordnung, Beschlussfassung
2. Maßnahmenplan: offene Punkte, Verantwortliche, Fälligkeiten
3. Lücken zwischen Review-Beschlüssen und SoA-Umsetzung dokumentieren

---

## Revisions-Einstellungen konfigurieren
**Einstellungen → Abschnitt "Interne Revision":**
- Revisionsleiter, E-Mail
- Prüfungsumfang (Freitext)
- Berichtsempfänger (GF / Aufsichtsrat / Prüfungsausschuss)
- Prüfungsrhythmus, letztes / nächstes Audit-Datum
- Externer Wirtschaftsprüfer

---

## Prüfungsberichte & Arbeitspapiere
| Nachweis | Abruf | Hinweis |
|---|---|---|
| Compliance-Matrix | Reports → Compliance-Matrix + CSV | Stichtag festhalten |
| Gap-Report | Reports → Gap-Report + CSV | Delta zum Vorjahr dokumentieren |
| Risiko-Export | Risiken → CSV | Vollständigkeitsprüfung |
| Audit-Log-Export | Admin → Audit-Log → CSV | Manipulationsschutz beachten |
| Training-Nachweise | Training → Liste | Abdeckungsgrad je Abteilung |
`,
  },
  {
    seedId:   'seed_guide_qmb',
    id:       'guid_guide_qmb',
    pinOrder: 40,
    title:    'Bedienungsanleitung: QMB / Qualitätsmanagementbeauftragter',
    minRole:  null,
    content: `# Bedienungsanleitung: QMB / Qualitätsmanagementbeauftragter

Der Qualitätsmanagementbeauftragte (QMB) koordiniert das QMS nach ISO 9001 bzw. branchenspezifischen Standards (IATF 16949, ISO 13485, AS9100) und stellt die Integration mit dem ISMS sicher.

---

## Zuständige Module im Überblick

| Modul | Aufgabe | Wo im System |
|---|---|---|
| **SoA – ISO 9001** | ISO 9001:2015 Controls bewerten | SoA → Tab "ISO 9001" |
| **Risikomanagement** | Risiken nach ISO 9001 Kap. 6.1 | Menü: Risiken |
| **Governance** | Management-Reviews (ISO 9001 Kap. 9.3) | Menü: Governance |
| **Training** | Schulungsmaßnahmen, Kompetenznachweis | Menü: Training |
| **Sicherheitsziele** | QM-Ziele mit KPI-Tracking | Menü: Sicherheitsziele |
| **Richtlinien** | QM-Handbuch, Verfahrensanweisungen | Menü: Richtlinien |
| **Reports** | Compliance-Matrix ISO 9001, Review-Zyklen | Menü: Reports |
| **Einstellungen (QMB)** | QMS-Scope, Norm, Zertifizierungsdaten | Einstellungen |

---

## Tagesgeschäft – Typische Aufgaben

### ISO 9001 Controls pflegen
1. **SoA → Tab "ISO 9001"** aufrufen
2. Controls nach aktuellem Umsetzungsstand bewerten (applicable / partial / not-applicable)
3. Besonders relevant: Kap. 4 (Kontext), 6.1 (Risiken), 7 (Unterstützung), 8 (Betrieb), 9 (Bewertung), 10 (Verbesserung)
4. Verknüpfung mit Richtlinien über "🔗 Verknüpfungen"

### QM-Risiken verwalten
1. **Risiken → Neue Risiko** — ISO 9001 Controls in "🔗 Verknüpfungen" verknüpfen
2. Qualitätsbezogene Risiken: Lieferantenausfall, Produktfehler, Kompetenzlücken
3. Behandlungsmaßnahmen: FMEA-Ergebnisse als Maßnahmen dokumentieren

### QM-Ziele mit KPIs verfolgen
1. **Sicherheitsziele → Neue Ziel** (gilt für alle ISMS/QM-Ziele)
2. Zielwert, Ist-Wert, Einheit (%, Anzahl, Tage) und Frist definieren
3. Regelmäßig aktualisieren — Fortschrittsbalken zeigt Erreichungsgrad

### Management-Review (ISO 9001 Kap. 9.3)
1. **Governance → Management-Review → Neuer Review**
2. Pflichtthemen ISO 9001: Kundenfeedback, Audit-Ergebnisse, Zielstatus, Ressourcen
3. Beschlüsse als Maßnahmen hinterlegen (Verantwortlicher + Fälligkeitsdatum)
4. Reports → Review-Zyklen als Vorbereitung nutzen

### Schulungsmaßnahmen verwalten
1. **Training → Neue Maßnahme** — Titel, Thema, Zielgruppe, Termin, Pflicht (ja/nein)
2. Abschluss & Teilnahmequote dokumentieren
3. Kompetenznachweis für ISO 9001 Kap. 7.2 sichergestellt

---

## QMB-Einstellungen konfigurieren
**Einstellungen → Abschnitt "QMB / Qualitätsmanagement":**
- QMB-Name und E-Mail
- QMS-Scope (Anwendungsbereich)
- Geltende Norm (ISO 9001 / IATF 16949 / ISO 13485 / AS9100)
- Zertifizierungsstelle, Zertifikat-Gültigkeit
- Audit-Termine, Rezertifizierungsdatum

---

## Reports & Zertifizierungsunterlagen
| Dokument | Abruf | ISO 9001 Kap. |
|---|---|---|
| Compliance-Matrix ISO 9001 | Reports → Compliance-Matrix (Framework: ISO 9001) + CSV | 9.1.3 |
| Zielerreichung | Sicherheitsziele → Übersicht | 9.1 |
| Training-Nachweis | Training → Liste | 7.2 |
| Management-Review-Protokoll | Governance → Review → Detail | 9.3 |
| Risikobewertung | Risiken → Export CSV | 6.1 |
`,
  },
  {
    seedId:   'seed_guide_abtlg',
    id:       'guid_guide_abtlg',
    pinOrder: 50,
    title:    'Bedienungsanleitung: Abteilungsleiter / Fachverantwortlicher',
    minRole:  null,
    content: `# Bedienungsanleitung: Abteilungsleiter / Fachverantwortlicher

Diese Anleitung richtet sich an Abteilungsleiter (dept_head) und Fachverantwortliche, die für ihren Bereich Richtlinien, Risiken und Schulungen pflegen.

---

## Deine Rolle im ISMS

| Aufgabe | Modul | Zugriff |
|---|---|---|
| Richtlinien für deinen Bereich pflegen | Richtlinien | Lesen + Erstellen/Bearbeiten |
| Risiken melden und mitbewerten | Risikomanagement | Lesen + Bearbeiten |
| Schulungsmaßnahmen planen | Training | Lesen + Bearbeiten |
| Assets deines Bereichs verwalten | Asset-Management | Lesen + Bearbeiten |
| SoA-Controls kommentieren | SoA | Lesen (+ Inline-Edit mit contentowner) |
| Vorfälle melden | Öffentl. Meldeformular / Vorfälle | Melden + Lesen |

---

## Tagesgeschäft – Typische Aufgaben

### Richtlinie bearbeiten
1. **Richtlinien** im Menü aufrufen
2. Eigene Richtlinie aus der Baumstruktur auswählen
3. **Bearbeiten**-Button → Inhalt aktualisieren, Datum "Nächstes Review" setzen
4. Status auf **"In Review"** setzen, damit CISO/ISB die Freigabe erteilt
5. Nach Freigabe durch Contentowner erscheint Status **"Approved"**

### Risiko melden
1. **Risiken → Neues Risiko**
2. Bedrohung beschreiben, Eintrittswahrscheinlichkeit und Auswirkung schätzen (1–5)
3. Vorgeschlagene Maßnahme eintragen
4. Eigene Abteilung als "Owner" angeben

### Schulung planen
1. **Training → Neue Maßnahme**
2. Thema, Zielgruppe (Abteilung), Termin, Pflichtschulungs-Flag setzen
3. Nach Durchführung: Abschluss und Teilnehmeranzahl eintragen

### Sicherheitsvorfall melden
- **Von innen (eingeloggt):** Vorfälle → Neuer Vorfall
- **Von außen / anonym:** Login-Seite → "Sicherheitsvorfall melden" (kein Login nötig)
- Pflichtfelder: E-Mail, Art des Vorfalls, Beschreibung

---

## Dashboards & Übersichten nutzen

Das **Dashboard** zeigt dir:
- Aktuelle Risiken in deinem Bereich (Top 5)
- Anstehende Reviews und Fälligkeiten (14-Tage-Vorschau)
- Offene DSAR und 72h-Meldungen (falls GDPR-Zugriff)
- KPI-Karten aller aktiven Module

Der **Kalender** zeigt alle Fälligkeiten:
- Review-Termine für Richtlinien
- Schulungstermine
- Asset-EoL-Termine
- Vertragslaufzeiten

---

## Was du NICHT tun kannst (und warum)

| Gesperrte Aktion | Warum |
|---|---|
| Richtlinien genehmigen (Approved setzen) | Nur Contentowner / Admin (4-Augen-Prinzip) |
| Benutzer anlegen | Nur Admin |
| Richtlinien endgültig löschen | Nur Admin (Papierkorb vorhanden) |
| SoA-Controls genehmigen | Nur CISO / Contentowner |
| Admin-Konsole aufrufen | Nur Admin |

---

## Tipps

- **Namenssuche:** Suchfeld in der Topbar findet Richtlinien, Risiken und Controls global
- **Verknüpfungen:** In jedem Formular unter "🔗 Verknüpfungen" kannst du SoA-Controls und Richtlinien verknüpfen — hilfreich für den Compliance-Nachweis
- **Guidance:** Diese Seite enthält weitere Anleitungen für alle Module
`,
  },
]

function seedRoleGuides() {
  const docs = load()
  let changed = false
  for (const guide of ROLE_GUIDES) {
    const existing = docs.find(d => d.seedId === guide.seedId && !d.deletedAt)
    if (!existing) {
      docs.push({
        id:             guide.id,
        seedId:         guide.seedId,
        category:       'rollen',
        title:          guide.title,
        type:           'markdown',
        content:        guide.content,
        pinOrder:       guide.pinOrder,
        minRole:        guide.minRole,
        createdAt:      new Date().toISOString(),
        updatedAt:      new Date().toISOString(),
        deletedAt:      null,
        deletedBy:      null,
        createdBy:      'system',
        linkedControls: [],
        linkedPolicies: [],
      })
      changed = true
    } else {
      // Migrate: move docs accidentally placed in systemhandbuch to rollen
      if (existing.category === 'systemhandbuch') { existing.category = 'rollen'; changed = true }
      if (existing.pinOrder == null) { existing.pinOrder = guide.pinOrder; changed = true }
    }
  }
  if (changed) save(docs)
}

// ── SoA & Audit Guide ────────────────────────────────────────────────────────

const SOA_GUIDE_SEED_ID = 'seed_soa_audit_guide'

const SOA_GUIDE_CONTENT = `# SoA & Audit – Leitfaden

Dieses Dokument erklärt die Nutzung des Statement of Applicability (SoA) und die Vorbereitung auf interne und externe Audits mit ISMS Builder.

---

## Was ist das SoA?

Das Statement of Applicability (SoA) ist ein Pflichtdokument nach ISO 27001 Kap. 6.1.3. Es listet alle relevanten Controls auf und begründet:
- **Warum** ein Control anwendbar ist (oder nicht)
- **Welche Maßnahmen** umgesetzt wurden
- **Welchen Umsetzungsstand** das Control hat

---

## Frameworks im Überblick

| Framework | Kürzel | Anzahl Controls | Hinweis |
|---|---|---|---|
| ISO 27001:2022 | ISO | 93 | ISO-Copyright — eigene Kontrolltexte erforderlich |
| BSI IT-Grundschutz | BSI | 88 | Frei verfügbar (bsi.bund.de) |
| NIS2-Richtlinie | NIS2 | 10 | EU-Verordnung, öffentlich |
| EUCS (EU Cloud) | EUCS | 44 | ENISA-Standard |
| EU AI Act | EUAI | 20 | EU-Verordnung, öffentlich |
| ISO 9001:2015 | ISO9001 | 36 | ISO-Copyright |
| ISO 9000:2015 | ISO9000 | 10 | ISO-Copyright |
| Cyber Resilience Act | CRA | 12 | EU-Verordnung, öffentlich |

> **Hinweis:** ISO-Controls sind nicht im Lieferumfang enthalten. Eigene Controls können über \`scripts/import-iso-controls.sh\` importiert werden.

---

## SoA-Control bearbeiten

1. **SoA → Framework-Tab** wählen (z.B. ISO 27001)
2. Control anklicken → Detail-Panel öffnet sich rechts
3. Felder ausfüllen:
   - **Anwendbarkeit:** applicable / not-applicable / partial
   - **Status:** planned / in-progress / implemented / not-applicable
   - **Begründung:** Warum applicable oder ausgeschlossen?
   - **Maßnahmen:** Was wurde konkret umgesetzt?
4. **Inline-Edit:** Doppelklick auf ein Feld für schnelle Änderungen direkt in der Tabelle
5. **Verknüpfungen:** "🔗 Verknüpfungen" → Controls mit Policies und Risiken verbinden

---

## Filter & Suche

| Filter | Beschreibung |
|---|---|
| Status: not-applicable | Alle ausgeschlossenen Controls — Begründungen prüfen |
| Status: planned | Geplante aber nicht umgesetzte Controls — Priorität prüfen |
| Status: partial | Teilweise umgesetzt — Maßnahmenplan vervollständigen |
| Suche | Volltextsuche über Control-ID, Titel und Begründung |

---

## Cross-Mapping

Das Cross-Mapping zeigt thematische Überschneidungen zwischen Frameworks:
- **SoA → Cross-Mapping** (Tab)
- 20 Themengruppen (z.B. "Zugangskontrolle", "Verschlüsselung")
- Zeigt welche Controls aus verschiedenen Frameworks dasselbe Thema abdecken
- Hilft Doppelarbeit zu vermeiden bei gleichzeitiger ISO 27001 + NIS2 + BSI-Compliance

---

## Audit-Vorbereitung

### Interne Vorbereitung
1. **Reports → Compliance-Matrix** aufrufen
   - Spalten: SoA-Controls (nach Framework)
   - Zeilen: Gesellschaften / Tochterunternehmen
   - Ampelfarben: grün = implemented, gelb = partial, rot = not-applicable / planned
2. **Reports → Gap-Report** — alle Controls mit fehlendem Umsetzungsnachweis
3. **Reports → Framework-Übersicht** — Prozentualer Umsetzungsstand je Framework
4. CSV-Export für Arbeitspapiere

### Für externe Zertifizierungsaudits (ISO 27001)

**Stage 1 (Dokumentenprüfung):**
- SoA exportieren (JSON → eigene Aufbereitung)
- Alle "not-applicable"-Begründungen nachvollziehbar dokumentieren
- Policies auf Status "approved" prüfen (kein Entwurf als Nachweis)
- VVT (DSGVO) auf Aktualität prüfen

**Stage 2 (Vor-Ort-Audit):**
- Risikomanagement: Alle Risiken bewertet, Behandlungen dokumentiert
- Training-Nachweise: Abschlussquoten, Zertifikate
- BCM-Übungsberichte: Letzte Übung < 12 Monate
- Audit-Log: Nachvollziehbarkeit aller Änderungen (Admin → Audit-Log)
- Management-Review-Protokoll (Governance → Reviews)

---

## RACI für SoA-Pflege

| Aktivität | CISO | DSB | QMB | Revision | Abtlg. |
|---|---|---|---|---|---|
| Controls bewerten | **R** | C | C | I | C |
| Begründungen schreiben | **R** | A (GDPR-Controls) | A (ISO 9001) | I | — |
| Maßnahmen dokumentieren | A | — | — | — | **R** |
| SoA genehmigen | **A** | — | — | I | — |
| Audit-Vorbereitung | **R** | C | C | **R** | C |

> R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## Häufige Fehler im SoA

| Fehler | Auswirkung | Lösung |
|---|---|---|
| Controls als "not-applicable" ohne Begründung | Audit-Finding | Begründung eintragen |
| Status "planned" seit > 12 Monaten | Non-Conformity | Maßnahmenplan erstellen, Verantwortlichen benennen |
| Keine Verknüpfung Control → Policy | Lücke im Nachweis | "🔗 Verknüpfungen" im Control pflegen |
| SoA nicht an aktuellen Scope angepasst | Certification Risk | Scope in Org-Einstellungen aktualisieren |
`

// ── Language helper ───────────────────────────────────────────────────────────

function _getDemoLang() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(_BASE, '.demo_lang_set'), 'utf8'))
    const l = d.lang
    if (l && l !== 'skip') return ['de', 'en', 'fr', 'nl'].includes(l) ? (l === 'de' ? 'de' : 'en') : 'en'
  } catch {}
  return 'en'
}

function _upsertSeed(docs, seedId, docData) {
  const lang = _getDemoLang()
  const existing = docs.find(d => d.seedId === seedId && !d.deletedAt)
  if (!existing) {
    docs.push({ ...docData, seedId, seedLang: lang, createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null, deletedBy: null, createdBy: 'system', linkedControls: [], linkedPolicies: [] })
    return true
  }
  // update content if language changed
  if (existing.seedLang !== lang) {
    existing.title    = docData.title
    existing.content  = docData.content
    existing.seedLang = lang
    existing.updatedAt = nowISO()
    return true
  }
  let changed = false
  if (existing.pinOrder == null && docData.pinOrder != null) { existing.pinOrder = docData.pinOrder; changed = true }
  if (existing.category && docData.category && existing.category !== docData.category) { existing.category = docData.category; changed = true }
  return changed
}

// ── SoA Guide – bilingual ─────────────────────────────────────────────────────

const SOA_GUIDE = {
  de: { title: 'SoA & Audit – Leitfaden', content: SOA_GUIDE_CONTENT },
  en: { title: 'SoA & Audit – Guide', content: `# SoA & Audit – Guide

This document explains how to use the Statement of Applicability (SoA) module and how to prepare for internal and external audits using ISMS Builder.

---

## What is the SoA?

The Statement of Applicability (SoA) is a mandatory document under ISO 27001 clause 6.1.3. It lists all relevant controls and documents:
- **Why** a control is applicable (or excluded)
- **What measures** have been implemented
- **Current implementation status**

---

## Frameworks Overview

| Framework | Code | Controls | Notes |
|---|---|---|---|
| ISO 27001:2022 | ISO | 93 | ISO copyright — supply your own control text |
| BSI IT-Grundschutz | BSI | 88 | Freely available (bsi.bund.de) |
| NIS2 Directive | NIS2 | 10 | EU regulation, public |
| EUCS (EU Cloud) | EUCS | 44 | ENISA standard |
| EU AI Act | EUAI | 20 | EU regulation, public |
| ISO 9001:2015 | ISO9001 | 36 | ISO copyright |
| ISO 9000:2015 | ISO9000 | 10 | ISO copyright |
| Cyber Resilience Act | CRA | 12 | EU regulation, public |

> **Note:** ISO controls are not included. Use \`scripts/import-iso-controls.sh\` to import your own.

---

## Editing a Control

1. **SoA → Framework tab** (e.g. ISO 27001)
2. Click a control → detail panel opens on the right
3. Fill in:
   - **Applicability:** applicable / not-applicable / partial
   - **Status:** planned / in-progress / implemented / not-applicable
   - **Justification:** Why included or excluded?
   - **Measures:** What was specifically implemented?
4. **Inline edit:** Double-click any field for quick in-table edits
5. **Traceability:** "🔗 Links" → link controls to policies and risks

---

## Filters & Search

| Filter | Description |
|---|---|
| Status: not-applicable | All excluded controls — verify justifications |
| Status: planned | Planned but not yet implemented — check priority |
| Status: partial | Partially implemented — complete action plan |
| Search | Full-text over control ID, title and justification |

---

## Cross-Mapping

The cross-mapping shows thematic overlaps between frameworks:
- **SoA → Cross-Mapping** tab
- 20 topic groups (e.g. "Access Control", "Encryption")
- Shows which controls across frameworks cover the same topic
- Helps avoid duplication when targeting ISO 27001 + NIS2 + BSI simultaneously

---

## Audit Preparation

### Internal Preparation
1. **Reports → Compliance Matrix**
   - Columns: SoA controls (by framework)
   - Rows: legal entities / subsidiaries
   - Traffic light: green = implemented, yellow = partial, red = not-applicable / planned
2. **Reports → Gap Report** — all controls without an implementation record
3. **Reports → Framework Overview** — percentage completion per framework
4. CSV export for working papers

### External Certification Audits (ISO 27001)

**Stage 1 (Document review):**
- Export SoA (JSON → own formatting)
- All "not-applicable" justifications must be clear and traceable
- Policies: all must be "approved" (no drafts as evidence)
- VVT/RoPA: verify it is current

**Stage 2 (On-site audit):**
- Risk management: all risks assessed, treatments documented
- Training records: completion rates, certificates
- BCM exercise reports: last exercise < 12 months
- Audit log: full traceability of all changes (Admin → Audit Log)
- Management review minutes (Governance → Reviews)

---

## RACI for SoA Maintenance

| Activity | CISO | DPO | QMO | Audit | Dept |
|---|---|---|---|---|---|
| Assess controls | **R** | C | C | I | C |
| Write justifications | **R** | A (GDPR) | A (ISO 9001) | I | — |
| Document measures | A | — | — | — | **R** |
| Approve SoA | **A** | — | — | I | — |
| Audit preparation | **R** | C | C | **R** | C |

> R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## Common SoA Mistakes

| Mistake | Impact | Fix |
|---|---|---|
| Controls marked "not-applicable" without justification | Audit finding | Enter a justification |
| Status "planned" for > 12 months | Non-conformity | Create action plan, assign owner |
| No control → policy link | Evidence gap | Use "🔗 Links" on the control |
| SoA not aligned with current scope | Certification risk | Update scope in Org Settings |
` }
}

function seedSoaGuide() {
  const lang = _getDemoLang()
  const data = SOA_GUIDE[lang] || SOA_GUIDE.en
  const docs = load()
  if (_upsertSeed(docs, SOA_GUIDE_SEED_ID, { id: 'guid_soa_audit_guide', category: 'soa-audit', type: 'markdown', pinOrder: 1, minRole: null, ...data })) save(docs)
}

// ── Policy-Prozesse Guide – bilingual ─────────────────────────────────────────

const POLICY_GUIDE_SEED_ID = 'seed_policy_prozesse_guide'

const POLICY_GUIDE = {
  de: {
    title: 'Policy-Prozesse – Erstellen, Prüfen & Freigeben',
    content: `# Policy-Prozesse – Erstellen, Prüfen & Freigeben

Dieser Leitfaden beschreibt den vollständigen Lebenszyklus einer Richtlinie (Policy) in ISMS Builder — von der Erstellung über den Review-Prozess bis zur Archivierung.

---

## Richtlinientypen

| Typ | Beschreibung | Beispiele |
|---|---|---|
| **Policy** | Verbindliche Vorgabe | Informationssicherheitsrichtlinie, Passwort-Policy |
| **Procedure** | Ablaufbeschreibung | Incident-Response-Verfahren, Change-Management |
| **Guideline** | Empfehlung | Sichere Programmierrichtlinien |
| **Standard** | Technische Norm | Verschlüsselungsstandard, Härtungs-Baseline |
| **SoA** | Statement of Applicability | ISO 27001 SoA-Dokument |
| **Risk** | Risikoakzeptanz-Dokument | Risikoannahme-Policy |
| **Template** | Vorlage | Datenschutz-Folgenabschätzungsvorlage |

---

## Lifecycle-Zustände

\`\`\`
draft  →  review  →  approved  →  archived
                ↑_____________|   (Re-Review)
\`\`\`

| Status | Bedeutung | Wer darf setzen |
|---|---|---|
| **draft** | In Bearbeitung, nicht freigegeben | editor+ |
| **review** | Zur Prüfung eingereicht | editor+ |
| **approved** | Freigegeben, verbindlich | contentowner / admin |
| **archived** | Nicht mehr gültig, nur Archiv | contentowner / admin |

---

## Neue Richtlinie erstellen

1. **Richtlinien** im Menü aufrufen
2. **+ Neue Seite** (Button oben rechts) anklicken
3. Pflichtfelder ausfüllen:
   - **Typ** (Policy / Procedure / …)
   - **Titel** (eindeutig und aussagekräftig)
   - **Sprache** (de / en)
   - **Status** beginnt automatisch als **draft**
4. **Inhalt** im Editor eintragen (Markdown oder Rich Text)
5. **Datum "Nächstes Review"** setzen (Pflicht für approved-Richtlinien)
6. **Verknüpfungen** unter "🔗 Verknüpfungen":
   - SoA-Controls verknüpfen (welche Controls deckt diese Policy ab?)
   - Anwendbare Gesellschaften setzen
7. **Speichern** (Strg+S oder Save-Button)

---

## Review-Prozess

### Richtlinie zur Prüfung einreichen
1. Richtlinie öffnen → **Bearbeiten**
2. Status auf **"review"** setzen
3. Speichern → Richtlinie erscheint im Dashboard unter "Handlungsbedarf"
4. Prüfer (contentowner) erhält ggf. E-Mail-Benachrichtigung (wenn konfiguriert)

### Als CISO / Contentowner prüfen
1. **Dashboard → Handlungsbedarf → Richtlinien in Review**
2. Richtlinie öffnen → Inhalt prüfen
3. Bei Freigabe: Status auf **"approved"** setzen + Revisonsdatum aktualisieren
4. Bei Ablehnung: Status zurück auf **"draft"** setzen + Kommentar in Beschreibung

---

## Versionierung

Jedes Speichern mit Status-Änderung erzeugt automatisch eine neue Version:

| Aktion | Versions-Increment |
|---|---|
| Inhalt bearbeiten (gleicher Status) | Minor (z.B. 1.0 → 1.1) |
| Status-Wechsel (z.B. draft → review) | Minor |
| Neue Genehmigung (→ approved) | Major (z.B. 1.x → 2.0) |

Versionsverlauf im Detail-Panel unter **"Verlauf"** einsehbar.

---

## Seitenhierarchie (Space-Struktur)

ISMS Builder unterstützt eine Confluence-ähnliche Seitenhierarchie:

- **Elternseite** festlegen: Richtlinie öffnen → **"Verschieben"** → Elternknoten wählen
- **Unterseite** erstellen: Richtlinie öffnen → **"+ Unterseite"**
- **Reihenfolge** per Drag & Drop oder ↑↓-Buttons im Baum anpassen
- **Breadcrumb** zeigt den Pfad zur aktuellen Seite

Empfohlene Struktur:
\`\`\`
├── Informationssicherheitsrichtlinie (Policy)
│   ├── Passwort-Policy (Policy)
│   ├── Clean-Desk-Policy (Policy)
│   └── BYOD-Richtlinie (Policy)
├── Incident-Response-Verfahren (Procedure)
│   └── Eskalationsplan (Procedure)
└── Datenschutzrichtlinie (Policy)
    └── Datenschutzerklärung (SoA)
\`\`\`

---

## Anhänge

Richtlinien können Anhänge (PDF, DOCX, bis 20 MB) haben:
1. Richtlinie öffnen → Tab **"Anhänge"**
2. Datei per Drag & Drop oder Dateiauswahl hochladen
3. Anhänge erscheinen in der Anhänge-Leiste und sind downloadbar

---

## Überprüfungszyklen (Review-Management)

Das System verwaltet Überprüfungstermine automatisch:

- **nextReviewDate**: Pflichtfeld bei approval — wann muss die Richtlinie erneut geprüft werden?
- **Farbkodierung** im Editor-Header:
  - 🟢 Grün: Review in > 30 Tagen
  - 🟡 Gelb: Review in ≤ 30 Tagen
  - 🔴 Rot: Review überfällig
- **Dashboard**: Alle überfälligen und bald fälligen Reviews unter "Handlungsbedarf"
- **Kalender**: Review-Termine als Kalendereinträge sichtbar
- **Reports → Review-Zyklen**: Vollständige Übersicht aller Richtlinien mit Fälligkeit

---

## RACI für Policy-Management

| Aktivität | CISO | Abtlg. | Contentowner | Revision |
|---|---|---|---|---|
| Richtlinie erstellen | R | R | — | — |
| Inhalt ausarbeiten | A | **R** | — | I |
| Review einreichen | R | **R** | — | — |
| Inhaltliche Prüfung | A | C | **R** | I |
| Freigabe erteilen | I | — | **R** | I |
| SoA-Controls verknüpfen | **R** | C | — | I |
| Archivierung | **R** | — | R | I |

---

## Häufige Fehler im Policy-Management

| Fehler | Auswirkung | Lösung |
|---|---|---|
| Richtlinie ohne Review-Datum freigegeben | Keine Fälligkeitsüberwachung | nextReviewDate vor Approval setzen |
| Status "draft" seit > 6 Monaten | Veraltetes Entwurfsdokument | Review anstoßen oder archivieren |
| Keine SoA-Verlinkung | Lücke im Compliance-Nachweis | Controls verknüpfen |
| Mehrere ähnliche Richtlinien | Redundanz, Widersprüche | Seitenhierarchie nutzen (Unterseiten) |
`
  },
  en: {
    title: 'Policy Processes – Create, Review & Approve',
    content: `# Policy Processes – Create, Review & Approve

This guide describes the complete lifecycle of a policy document in ISMS Builder — from creation through the review process to archiving.

---

## Document Types

| Type | Description | Examples |
|---|---|---|
| **Policy** | Mandatory requirement | Information Security Policy, Password Policy |
| **Procedure** | Process description | Incident Response Procedure, Change Management |
| **Guideline** | Recommendation | Secure Coding Guidelines |
| **Standard** | Technical standard | Encryption Standard, Hardening Baseline |
| **SoA** | Statement of Applicability | ISO 27001 SoA document |
| **Risk** | Risk acceptance document | Risk Acceptance Policy |
| **Template** | Blank form | Data Protection Impact Assessment template |

---

## Lifecycle States

\`\`\`
draft  →  review  →  approved  →  archived
                ↑_____________|   (Re-review)
\`\`\`

| Status | Meaning | Who can set |
|---|---|---|
| **draft** | Work in progress, not released | editor+ |
| **review** | Submitted for review | editor+ |
| **approved** | Released, binding | contentowner / admin |
| **archived** | No longer valid, archive only | contentowner / admin |

---

## Creating a New Policy

1. Open **Policies** in the menu
2. Click **+ New Page** (top right)
3. Fill in required fields:
   - **Type** (Policy / Procedure / …)
   - **Title** (unique and descriptive)
   - **Language** (de / en)
   - **Status** automatically starts as **draft**
4. Enter **content** in the editor (Markdown or rich text)
5. Set **Next Review Date** (required for approved policies)
6. Add **links** under "🔗 Links":
   - Link SoA controls (which controls does this policy cover?)
   - Set applicable entities
7. **Save** (Ctrl+S or Save button)

---

## Review Process

### Submitting for Review
1. Open policy → **Edit**
2. Set status to **"review"**
3. Save → policy appears on Dashboard under "Action Required"
4. Reviewer (contentowner) optionally receives email notification (if configured)

### Reviewing as CISO / Content Owner
1. **Dashboard → Action Required → Policies in Review**
2. Open policy → review content
3. To approve: set status to **"approved"** + update review date
4. To reject: set status back to **"draft"** + add comment to description

---

## Versioning

Every save with a status change automatically creates a new version:

| Action | Version increment |
|---|---|
| Edit content (same status) | Minor (e.g. 1.0 → 1.1) |
| Status change (e.g. draft → review) | Minor |
| New approval (→ approved) | Major (e.g. 1.x → 2.0) |

Version history visible in the detail panel under **"History"**.

---

## Page Hierarchy (Space Structure)

ISMS Builder supports a Confluence-style page hierarchy:

- **Set parent page**: Open policy → **"Move"** → select parent node
- **Create child page**: Open policy → **"+ Sub-page"**
- **Reorder** via drag & drop or ↑↓ buttons in the tree
- **Breadcrumb** shows the path to the current page

Recommended structure:
\`\`\`
├── Information Security Policy (Policy)
│   ├── Password Policy (Policy)
│   ├── Clean Desk Policy (Policy)
│   └── BYOD Policy (Policy)
├── Incident Response Procedure (Procedure)
│   └── Escalation Plan (Procedure)
└── Data Protection Policy (Policy)
    └── Privacy Notice (SoA)
\`\`\`

---

## Attachments

Policies can have attachments (PDF, DOCX, up to 20 MB):
1. Open policy → **"Attachments"** tab
2. Upload file via drag & drop or file picker
3. Attachments appear in the attachment bar and are downloadable

---

## Review Cycles

The system manages review schedules automatically:

- **nextReviewDate**: Required on approval — when does this policy need to be reviewed again?
- **Colour coding** in the editor header:
  - 🟢 Green: review in > 30 days
  - 🟡 Yellow: review in ≤ 30 days
  - 🔴 Red: review overdue
- **Dashboard**: All overdue and upcoming reviews under "Action Required"
- **Calendar**: Review dates visible as calendar entries
- **Reports → Review Cycles**: Full overview of all policies with due dates

---

## RACI for Policy Management

| Activity | CISO | Dept | Content Owner | Audit |
|---|---|---|---|---|
| Create policy | R | R | — | — |
| Draft content | A | **R** | — | I |
| Submit for review | R | **R** | — | — |
| Review content | A | C | **R** | I |
| Grant approval | I | — | **R** | I |
| Link SoA controls | **R** | C | — | I |
| Archive | **R** | — | R | I |

---

## Common Policy Management Mistakes

| Mistake | Impact | Fix |
|---|---|---|
| Policy approved without review date | No due date tracking | Set nextReviewDate before approving |
| Status "draft" for > 6 months | Stale draft document | Initiate review or archive |
| No SoA control links | Compliance evidence gap | Link relevant controls |
| Multiple overlapping policies | Redundancy, contradictions | Use page hierarchy (sub-pages) |
`
  }
}

function seedPolicyGuide() {
  const lang = _getDemoLang()
  const data = POLICY_GUIDE[lang] || POLICY_GUIDE.en
  const docs = load()
  if (_upsertSeed(docs, POLICY_GUIDE_SEED_ID, { id: 'guid_policy_prozesse_guide', category: 'policy-prozesse', type: 'markdown', pinOrder: 1, minRole: null, ...data })) save(docs)
}

// ── Make existing single-lang seeds language-aware ────────────────────────────

// SoA guide already handled above.
// DemoDoc and RoleGuides: update content on lang change via _upsertSeed wrapper

const DEMO_DOC_EN_TITLE = 'Demo Mode – Overview & Transition to Production'
const DEMO_DOC_EN_CONTENT = `# Demo Mode – Overview & Transition to Production

Welcome to **ISMS Builder** — your self-hosted Information Security Management System.

This document explains the demo environment and guides you through the transition to production.

---

## Demo Credentials

| User | Password | Role | Domain | Access |
|---|---|---|---|---|
| admin | adminpass | Admin | IT | Full access — all modules |
| alice | alicepass | Department Head | IT | Policies, Risks, Guidance (read+write) |
| bob | bobpass | Reader | HR | Read-only |

> **Security notice:** These passwords are publicly known. Change all passwords before going live.

---

## Demo Data Available

The system contains realistic sample data for the following modules:

| Module | Demo Content |
|---|---|
| **Policies** | Information Security Policy, Password Policy, BYOD Policy, Backup Policy, Access Control Policy |
| **SoA** | 313 controls across 8 frameworks (ISO 27001, BSI, NIS2, EUCS, EUAI, ISO 9001, CRA) — all editable |
| **Risk Management** | Realistic risks with multi-framework links (Ransomware, Phishing, Insider Threat, Supply Chain, …) |
| **GDPR & Privacy** | RoPA, DPAs, TOMs, DPIA entries, 72h timer demo |
| **Assets** | Company assets (servers, workstations, ERP, cloud services, network) with classification |
| **Supply Chain** | Suppliers incl. NIS2/EUCS links |
| **BCM / BCP** | Business Impact Analyses, Continuity Plans, Exercises |
| **Governance** | Management Reviews with action items and meeting minutes |
| **Training** | Training measures (ISO Awareness, GDPR, Phishing Simulation) |
| **Legal** | Contracts, NDAs, Privacy Policies |
| **Security Goals** | KPI goals with progress bars |
| **Incident Inbox** | Demo reports from the public incident submission form |
| **Guidance** | System manual, role guides, policy processes, SoA audit guide |

---

## Transition to Production

### Step by Step
1. Open **Admin Console** → tab **Maintenance**
2. **Run Demo Reset:**
   - Click "Demo Reset" section
   - Type \`RESET\` in the confirmation dialog
   - The system exports all demo data as a JSON download (backup)
   - All module data is cleared, all users except \`admin\` are deleted
   - Admin password is reset to \`adminpass\`, 2FA disabled
3. **Redirected to login page** — yellow banner confirms successful reset
4. **Log in with \`admin\` / \`adminpass\`** — banner disappears, system ready for production
5. **Change password immediately:** Settings → Change Password
6. **Set up 2FA:** Settings → Enable 2FA
7. **Create your users:** Admin Console → Users tab
8. **Create your content:** all modules are empty and ready

### What is preserved after reset?

| Preserved | Cleared |
|---|---|
| SoA controls (all 313) | Policies / Templates |
| Dropdown lists | Risks |
| Organisation settings | Assets, BCM, Governance |
| (Admin user) | Suppliers, Legal, Training |
| | GDPR data, Guidance |
| | Audit log, Security Goals |

---

## Restore Demo Data

To demonstrate the system again:

1. **Admin Console → Maintenance → "Import Demo Data"**
2. Select the JSON file downloaded during Demo Reset
3. All module data is restored
4. alice and bob are recreated with original passwords and no 2FA
5. The admin account remains unchanged

---

## Further Information

- **Architecture & API Reference:** Guidance → Admin Documentation
- **Role Guides:** Guidance → Roles
- **Project Page:** [GitHub – ISMS Builder](https://github.com/claudehecker/isms-builder)
- **Licence:** GNU Affero General Public License v3.0 (AGPL-3.0)
`

// Patch seedDemoDoc to be language-aware
const _origSeedDemoDoc = seedDemoDoc
function seedDemoDocI18n() {
  const lang = _getDemoLang()
  const docs = load()
  let changed = false
  const existing = docs.find(d => d.seedId === DEMO_GUIDE_SEED_ID && !d.deletedAt)
  if (!existing) {
    docs.unshift({
      id: 'guid_demo_overview', seedId: DEMO_GUIDE_SEED_ID, seedLang: lang,
      category: 'systemhandbuch', type: 'markdown',
      title:   lang === 'de' ? 'Demo-Betrieb – Übersicht & Übergabe in den Produktivbetrieb' : DEMO_DOC_EN_TITLE,
      content: lang === 'de' ? DEMO_GUIDE_CONTENT : DEMO_DOC_EN_CONTENT,
      pinOrder: 1, minRole: null,
      createdAt: nowISO(), updatedAt: nowISO(), deletedAt: null, deletedBy: null,
      createdBy: 'system', linkedControls: [], linkedPolicies: [],
    })
    changed = true
  } else {
    if (existing.seedLang !== lang) {
      existing.title    = lang === 'de' ? 'Demo-Betrieb – Übersicht & Übergabe in den Produktivbetrieb' : DEMO_DOC_EN_TITLE
      existing.content  = lang === 'de' ? DEMO_GUIDE_CONTENT : DEMO_DOC_EN_CONTENT
      existing.seedLang = lang
      existing.updatedAt = nowISO()
      changed = true
    }
    if (existing.pinOrder == null) { existing.pinOrder = 1; changed = true }
  }
  if (changed) save(docs)
}

// Role guide EN translations
const ROLE_GUIDES_EN = {
  seed_guide_ciso: {
    title: 'User Guide: CISO / Information Security Officer (ISB)',
    content: `# User Guide: CISO / Information Security Officer

The CISO (Chief Information Security Officer) bears overall responsibility for the ISMS. This guide explains the key modules and daily tasks.

---

## Module Overview

| Module | Task | Location |
|---|---|---|
| **Risk Management** | Record, assess and treat risks | Menu: Risks |
| **SoA** | Assess controls, maintain applicability & status | Menu: SoA |
| **Security Goals** | Define KPIs, track progress | Menu: Goals |
| **Incident Inbox** | Process reported security incidents | Menu: Incidents |
| **Supply Chain** | Monitor suppliers, NIS2 obligations | Menu: Suppliers |
| **BCM / BCP** | Business Impact Analyses, plans, exercises | Menu: BCM |
| **Governance** | Management reviews, action packages | Menu: Governance |
| **Reports** | Compliance matrix, gap report, CSV export | Menu: Reports |
| **Settings (CISO)** | SLA, notification threshold, escalation email | Menu: Settings |

---

## Daily Tasks

### Risk Assessment
1. **Risks → New Risk** — enter threat, probability (1–5), impact (1–5)
2. Score = probability × impact (calculated automatically)
3. Add **treatment plans** by clicking a risk entry → "Treatment" tab
4. Link to SoA controls via "🔗 Links" in the edit form

### Maintaining SoA Controls
1. **SoA → Framework tab** (ISO 27001, NIS2, BSI …)
2. Click control → set status (applicable / not-applicable / partial)
3. Enter justification and measures
4. **Inline edit:** double-click any field for quick changes

### NIS2 Reporting Obligation (72h deadline)
- Incidents with "reportable" status in CISO Inbox → prepare BSI/authority report
- Configure reporting threshold in **Settings → CISO/ISB**
- Timer runs from capture; escalation email triggered automatically after SLA

### Preparing Management Review
1. **Governance → Management Review → New Review**
2. Enter agenda, attendees, decisions
3. Link action items directly to the review
4. Export **Reports → Compliance Matrix** as attachment (CSV)

---

## Reports & Evidence

| Report | Access | Format |
|---|---|---|
| Compliance Matrix | Reports → Compliance Matrix | Table + CSV |
| Gap Report | Reports → Gap Report | Table + CSV |
| Framework Overview | Reports → Framework | Table |
| Risk Export | Risks → CSV | CSV |

---

## Notes on Independence
The CISO/ISB reports directly to executive management (ISO 27001 clause 5.1). The role must not conflict with operational IT responsibilities.
`
  },
  seed_guide_dsb: {
    title: 'User Guide: DPO / Data Protection Officer (GDPO)',
    content: `# User Guide: DPO / Data Protection Officer

The Data Protection Officer (DPO / GDPO) monitors compliance with GDPR and related data protection regulations.

> **Independence:** The DPO is free from instructions in performing their tasks (Art. 38(3) GDPR) and may not be dismissed or penalised for performing their duties. They report directly to the highest level of management.

---

## Module Overview

| Module | Task | Location |
|---|---|---|
| **RoPA** | Records of Processing Activities (Art. 30) | Privacy → RoPA |
| **DPA** | Data Processing Agreements | Privacy → DPA |
| **DPIA** | Data Protection Impact Assessment (Art. 35) | Privacy → DPIA |
| **TOMs** | Technical & organisational measures | Privacy → TOMs |
| **DSAR** | Data Subject Access Requests | Privacy → DSAR |
| **72h Timer** | Breach notification deadline tracking | Privacy → Incidents |
| **Deletion Log** | Art. 17 erasure record | Privacy → Deletion Log |
| **Privacy Policies** | Manage current policies | Legal → Policies |
| **Settings (GDPO)** | DSAR deadlines, DPO contact, authorities | Settings |

---

## Daily Tasks

### Maintaining RoPA
1. **Privacy → RoPA → New Entry**
2. Required fields: name, purpose, legal basis (Art. 6/9), data categories, data subjects, recipients, retention periods
3. Third country transfers: enter country + safeguard (SCCs, BCRs)
4. CSV export via the "CSV" button in the filter bar

### Conducting DPIA (Art. 35 GDPR)
1. **Privacy → DPIA → New Assessment**
2. Threshold check: risk assessment for rights and freedoms
3. Document planned measures and residual risk
4. Status: draft → under review → completed

### Managing 72h Breach Notification
1. Record breach in **Privacy → Incidents**
2. System automatically starts 72h countdown from capture
3. On expiry: document authority notification
4. Authority contact details in **Settings → DPO/GDPO**

### Processing DSAR (Subject Access Requests)
1. **Privacy → DSAR → New Request**
2. Deadline calculated automatically per GDPO settings (default: 30 days, extendable to 90)
3. Status: Received → In Progress → Completed / Rejected

---

## Evidence & Documentation

| Document | Access | Art. GDPR |
|---|---|---|
| RoPA (CSV) | RoPA → Export CSV | Art. 30 |
| DPIA Report | DPIA → Detail view | Art. 35 |
| DPA Overview | Privacy → DPA | Art. 28 |
| TOM Evidence | Privacy → TOMs | Art. 32 |
| Deletion Log | Privacy → Deletion Log | Art. 17 |
`
  },
  seed_guide_revision: {
    title: 'User Guide: Internal Audit',
    content: `# User Guide: Internal Audit

Internal Audit independently reviews the effectiveness of the ISMS and internal control systems.

> **Independence:** Internal Audit is functionally and organisationally independent (IIA Standard 1100, IDW PS 321). It reports directly to the Board / Executive Management or Audit Committee and is free from operational management instructions.

---

## Module Overview

| Module | Audit Subject | Location |
|---|---|---|
| **SoA** | Implementation status of all controls | Menu: SoA |
| **Reports** | Compliance matrix, gap report, review cycles | Menu: Reports |
| **Audit Log** | Traceability of all system actions | Admin Console → Audit Log |
| **Risk Management** | Completeness of risk register, treatment status | Menu: Risks |
| **Governance** | Management review minutes, action status | Menu: Governance |
| **Training** | Training records, coverage rate | Menu: Training |
| **BCM** | Exercise reports, BIA currency | Menu: BCM |

---

## Audit Procedures

### Assessing Compliance Status
1. **Reports → Compliance Matrix:** traffic light view Control × Entity
2. Red cells = missing implementation → query module owner
3. **Reports → Gap Report:** all controls with status "not applicable" or no measure
4. CSV export as working paper

### Reviewing SoA Controls
1. **SoA → select framework** (ISO 27001, NIS2, BSI …)
2. Filter "not-applicable" → check justifications for plausibility
3. Sampling: controls "applicable" with status "planned/partial" → request implementation evidence

### Evaluating Audit Log (admin access required)
1. **Admin Console → Audit Log**
2. Filter by period, user or action
3. Critical actions: permanent_delete, demo_reset, settings changes

### Tracing Risk Assessments
1. **Risks → List:** check score, last edit date, treatment status
2. Identify untreated high risks (score ≥ 15)
3. Trace linked controls in the detail panel

---

## Audit Reports & Working Papers

| Evidence | Access | Note |
|---|---|---|
| Compliance Matrix | Reports → Compliance Matrix + CSV | Record reference date |
| Gap Report | Reports → Gap Report + CSV | Document delta vs. prior year |
| Risk Export | Risks → CSV | Completeness check |
| Audit Log Export | Admin → Audit Log → CSV | Note tamper protection |
| Training Records | Training → List | Coverage rate by department |
`
  },
  seed_guide_qmb: {
    title: 'User Guide: QMO / Quality Management Officer',
    content: `# User Guide: QMO / Quality Management Officer

The Quality Management Officer (QMO) coordinates the QMS to ISO 9001 or sector-specific standards (IATF 16949, ISO 13485, AS9100) and ensures integration with the ISMS.

---

## Module Overview

| Module | Task | Location |
|---|---|---|
| **SoA – ISO 9001** | Assess ISO 9001:2015 controls | SoA → "ISO 9001" tab |
| **Risk Management** | Risks per ISO 9001 clause 6.1 | Menu: Risks |
| **Governance** | Management reviews (ISO 9001 clause 9.3) | Menu: Governance |
| **Training** | Training measures, competence records | Menu: Training |
| **Security Goals** | QM goals with KPI tracking | Menu: Goals |
| **Policies** | QM manual, work instructions | Menu: Policies |
| **Reports** | Compliance matrix ISO 9001, review cycles | Menu: Reports |

---

## Daily Tasks

### Maintaining ISO 9001 Controls
1. **SoA → "ISO 9001" tab**
2. Assess controls by current implementation (applicable / partial / not-applicable)
3. Key clauses: 4 (Context), 6.1 (Risks), 7 (Support), 8 (Operation), 9 (Evaluation), 10 (Improvement)
4. Link to policies via "🔗 Links"

### Managing QM Risks
1. **Risks → New Risk** — link ISO 9001 controls via "🔗 Links"
2. Quality-related risks: supplier failure, product defects, competence gaps
3. Treatment measures: document FMEA results as actions

### Tracking QM Goals with KPIs
1. **Goals → New Goal** (applies to all ISMS/QM goals)
2. Define target value, actual value, unit (%, count, days) and deadline
3. Update regularly — progress bar shows achievement

### Management Review (ISO 9001 clause 9.3)
1. **Governance → Management Review → New Review**
2. ISO 9001 mandatory topics: customer feedback, audit results, goal status, resources
3. Record decisions as action items (owner + due date)

---

## Reports & Certification Documents

| Document | Access | ISO 9001 Clause |
|---|---|---|
| Compliance Matrix ISO 9001 | Reports → Compliance Matrix (Framework: ISO 9001) + CSV | 9.1.3 |
| Goal Achievement | Goals → Overview | 9.1 |
| Training Records | Training → List | 7.2 |
| Management Review Minutes | Governance → Review → Detail | 9.3 |
| Risk Assessment | Risks → CSV Export | 6.1 |
`
  },
  seed_guide_abtlg: {
    title: 'User Guide: Department Head / Subject Matter Expert',
    content: `# User Guide: Department Head / Subject Matter Expert

This guide is for department heads (dept_head) and subject matter experts who maintain policies, risks and training for their area.

---

## Your Role in the ISMS

| Task | Module | Access |
|---|---|---|
| Maintain policies for your area | Policies | Read + create/edit |
| Report and assess risks | Risk Management | Read + edit |
| Plan training measures | Training | Read + edit |
| Manage your area's assets | Asset Management | Read + edit |
| Comment on SoA controls | SoA | Read (+ inline edit with contentowner) |
| Report incidents | Public form / Incidents | Submit + read |

---

## Daily Tasks

### Editing a Policy
1. Open **Policies** from the menu
2. Select your policy from the tree
3. Click **Edit** → update content, set "Next Review" date
4. Set status to **"review"** so CISO/content owner can approve
5. After approval by content owner the status becomes **"approved"**

### Reporting a Risk
1. **Risks → New Risk**
2. Describe the threat, estimate probability and impact (1–5)
3. Enter a proposed treatment measure
4. Enter your department as "Owner"

### Planning Training
1. **Training → New Measure**
2. Enter topic, target audience (department), date, mandatory flag
3. After completion: enter results and number of participants

### Reporting a Security Incident
- **From inside (logged in):** Incidents → New Incident
- **From outside / anonymous:** Login page → "Report Security Incident" (no login required)
- Required fields: email, incident type, description

---

## Dashboards & Overviews

The **Dashboard** shows:
- Current risks in your area (Top 5)
- Upcoming reviews and due dates (14-day preview)
- Open DSARs and 72h notifications (if GDPR access)
- KPI cards for all active modules

The **Calendar** shows all due dates:
- Policy review dates
- Training dates
- Asset end-of-life dates
- Contract expiry dates

---

## What You Cannot Do (and Why)

| Blocked Action | Reason |
|---|---|
| Approve policies (set "Approved") | Content owner / admin only (four-eyes principle) |
| Create users | Admin only |
| Permanently delete policies | Admin only (recycle bin available) |
| Approve SoA controls | CISO / content owner only |
| Access Admin Console | Admin only |

---

## Tips

- **Name search:** The search bar in the top bar finds policies, risks and controls globally
- **Links:** In every form under "🔗 Links" you can link SoA controls and policies — helpful for compliance evidence
- **Guidance:** This section contains further guides for all modules
`
  }
}

function seedRoleGuidesI18n() {
  const lang = _getDemoLang()
  const docs = load()
  let changed = false
  for (const guide of ROLE_GUIDES) {
    const enGuide = ROLE_GUIDES_EN[guide.seedId]
    const title   = lang === 'de' ? guide.title   : (enGuide ? enGuide.title   : guide.title)
    const content = lang === 'de' ? guide.content : (enGuide ? enGuide.content : guide.content)
    if (_upsertSeed(docs, guide.seedId, { id: guide.id, category: 'rollen', type: 'markdown', pinOrder: guide.pinOrder, minRole: guide.minRole, title, content })) changed = true
  }
  if (changed) save(docs)
}

// ── Seed: ISO-Controls Rechtlicher Hinweis ──────────────────────────────────
const ISO_NOTICE_SEED_ID = 'seed_iso_controls_notice'

const ISO_NOTICE_DE = `# <span style="color:#FFD700">⚠</span> Rechtlicher Hinweis: ISO-Controls — Manuelle Installation erforderlich

> <span style="color:#FFD700">**⚠ Dieser Hinweis ist verbindlich. Er gilt für alle Administratoren, Betreiber und Nutzer dieser Plattform.**</span>

---

## Was ist zu beachten?

**ISO 27001:2022, ISO 9000:2015 und ISO 9001:2015** sind urheberrechtlich geschützte Normen der
International Organization for Standardization (ISO, © ISO).

Die vollständigen Control-Definitionen — Titel, Beschreibungstexte und Anforderungsinhalte — sind
**nicht Bestandteil dieser Software** und dürfen **ohne gültige ISO-Lizenz weder weitergegeben
noch in einem System gespeichert oder genutzt werden**.

---

## Was muss der Administrator tun?

Die SoA-Module für ISO 27001, ISO 9000 und ISO 9001 werden **ohne Norminhalte** ausgeliefert.
Der Administrator ist verpflichtet, die Controls **eigenhändig** zu importieren:

1. **Lizenzierte Kopie beschaffen** — über [iso.org](https://www.iso.org/) oder einen autorisierten nationalen Händler (z. B. DIN, Beuth)
2. **JSON-Datei vorbereiten** — Format gemäß \`scripts/import-iso-controls.sh\`
3. **Importer ausführen:**
   \`\`\`bash
   bash scripts/import-iso-controls.sh /pfad/zur/iso-controls.json
   \`\`\`
4. **Server neu starten**

---

## Welche Frameworks sind bereits enthalten?

Die folgenden Frameworks basieren auf öffentlich verfügbaren EU-Rechtsakten bzw.
Bundesbehörden-Veröffentlichungen und sind **vollständig vorinstalliert** — keine Lizenz erforderlich:

| Framework | Grundlage |
|---|---|
| **BSI IT-Grundschutz** | Bundesamt für Sicherheit in der Informationstechnik (BSI) |
| **EU NIS2** | EU-Richtlinie 2022/2555 |
| **EUCS** | ENISA European Cybersecurity Certification Scheme for Cloud |
| **EU AI Act** | EU-Verordnung 2024/1689 |
| **CRA** | EU Cyber Resilience Act |

---

## Rechtsgrundlage

ISO-Normen sind nach **§ 2 UrhG** (Sprachwerke) sowie dem
**Berner Übereinkommen über den Schutz von Werken der Literatur und Kunst** urheberrechtlich geschützt.
Unbefugte Vervielfältigung, öffentliche Zugänglichmachung oder Speicherung — auch im internen
Unternehmensbetrieb ohne Lizenz — ist **unzulässig**.

**Die Verantwortung für den lizenzkonformen Betrieb liegt ausschließlich beim Betreiber dieser Installation.**
Die ISMS Builder-Autoren übernehmen keine Haftung für unlizenzierte Nutzung von ISO-geschützten Inhalten.
`

const ISO_NOTICE_EN = `# <span style="color:#FFD700">⚠</span> Legal Notice: ISO Controls — Manual Installation Required

> <span style="color:#FFD700">**⚠ This notice is binding. It applies to all administrators, operators and users of this platform.**</span>

---

## What you need to know

**ISO 27001:2022, ISO 9000:2015, and ISO 9001:2015** are copyright-protected standards published
by the International Organization for Standardization (ISO, © ISO).

The complete control definitions — titles, descriptions, and requirement text — are
**not included in this software** and must **not be stored, distributed or used without a valid ISO licence**.

---

## What must the administrator do?

The SoA modules for ISO 27001, ISO 9000, and ISO 9001 are delivered **without control content**.
The administrator is required to import the controls **manually**:

1. **Obtain a licensed copy** — from [iso.org](https://www.iso.org/) or an authorised national body
2. **Prepare a JSON file** — format documented in \`scripts/import-iso-controls.sh\`
3. **Run the import script:**
   \`\`\`bash
   bash scripts/import-iso-controls.sh /path/to/iso-controls.json
   \`\`\`
4. **Restart the server**

---

## Which frameworks are already included?

The following frameworks are based on publicly available EU legislation or federal publications
and are **fully pre-installed** — no licence required:

| Framework | Legal Basis |
|---|---|
| **BSI IT-Grundschutz** | German Federal Office for Information Security (BSI) |
| **EU NIS2** | EU Directive 2022/2555 |
| **EUCS** | ENISA European Cybersecurity Certification Scheme for Cloud |
| **EU AI Act** | EU Regulation 2024/1689 |
| **CRA** | EU Cyber Resilience Act |

---

## Legal basis

ISO standards are protected under copyright law (Berne Convention, national implementations).
Unauthorised reproduction, public communication or storage — even for internal business use
without a licence — is **not permitted**.

**Responsibility for licence-compliant operation rests solely with the operator of this installation.**
The ISMS Builder authors accept no liability for unlicensed use of ISO-protected content.
`

function seedIsoNotice() {
  const lang = _getDemoLang()
  const docs = load()
  const content = lang === 'de' ? ISO_NOTICE_DE : ISO_NOTICE_EN
  const title   = lang === 'de'
    ? '⚠ Rechtlicher Hinweis: ISO-Controls — Manuelle Installation erforderlich'
    : '⚠ Legal Notice: ISO Controls — Manual Installation Required'
  const existing = docs.find(d => d.seedId === ISO_NOTICE_SEED_ID && !d.deletedAt)
  if (!existing) {
    docs.push({ id: 'guid_iso_controls_notice', seedId: ISO_NOTICE_SEED_ID, seedLang: lang,
      category: 'systemhandbuch', type: 'markdown', pinOrder: 2, minRole: null,
      title, content, createdAt: nowISO(), updatedAt: nowISO(),
      deletedAt: null, deletedBy: null, createdBy: 'system',
      linkedControls: [], linkedPolicies: [] })
    save(docs)
  } else {
    // always keep title + content current (language or content changes)
    let changed = false
    if (existing.title !== title)     { existing.title = title; changed = true }
    if (existing.content !== content) { existing.content = content; changed = true }
    if (existing.seedLang !== lang)   { existing.seedLang = lang; changed = true }
    if (existing.pinOrder !== 2)      { existing.pinOrder = 2; changed = true }
    if (changed) { existing.updatedAt = nowISO(); save(docs) }
  }
}

module.exports = {
  getAll, getByCategory, getById, create, update, delete: del,
  permanentDelete, restore, getDeleted, getFilePath, VALID_CATEGORIES,
  seedArchitectureDocs,
  seedDemoDoc:    seedDemoDocI18n,
  seedRoleGuides: seedRoleGuidesI18n,
  seedSoaGuide,
  seedPolicyGuide,
  seedIsoNotice,
}
