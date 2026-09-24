# PitWall — Decisioni tecniche e architetturali

## Stato del documento

Questo documento raccoglie le decisioni tecniche prese per il progetto **PitWall** prima dell'inizio dell'implementazione.

Lo scopo è duplice:

1. fornire all'agente AI un riferimento chiaro sulle scelte già effettuate;
2. permettere al proprietario del progetto di capire e ricordare **perché** tali scelte sono state prese.

Le decisioni qui riportate non sono immutabili. Possono essere riviste se durante lo sviluppo emergono problemi concreti, ma non devono essere cambiate automaticamente da un agente AI senza motivazione.

---

# 1. Obiettivo tecnico

PitWall sarà una web application pubblica per esplorare e confrontare le strategie di gara di Formula 1.

L'MVP deve permettere di:

- scegliere una stagione;
- scegliere un Gran Premio;
- scegliere due piloti;
- confrontare posizione giro per giro;
- confrontare tempi sul giro;
- visualizzare pit stop;
- visualizzare stint e mescole;
- mostrare il risultato finale;
- gestire correttamente dati mancanti ed errori.

Il progetto deve:

- essere pubblico su GitHub;
- avere una demo pubblica;
- funzionare senza AWS;
- avere costo possibilmente pari a 0€;
- evitare overengineering;
- mostrare competenze full-stack;
- essere predisposto per una futura estensione MCP;
- funzionare completamente anche senza AI.

---

# 2. Architettura scelta

È stata scelta l'architettura **Frontend + Backend serverless leggero**.

Schema generale:

```text
Browser
   ↓
React
   ↓
PitWall API
   ↓
Cloudflare Worker
   ↓
Cache
   ↓
OpenF1 API
```

Il frontend non interrogherà direttamente OpenF1.

Il browser parlerà con una nostra API:

```text
React
  ↓
/api/*
  ↓
Cloudflare Worker
```

Il Worker sarà responsabile di:

- interrogare OpenF1;
- validare i dati ricevuti;
- normalizzare i dati;
- gestire errori;
- gestire caching;
- restituire al frontend dati in un formato definito da PitWall.

---

# 3. Perché non è stato scelto frontend-only

Era stata considerata una soluzione più semplice:

```text
React
  ↓
OpenF1
```

Questa soluzione avrebbe funzionato ed era probabilmente sufficiente per una demo.

È stata scartata come architettura principale perché PitWall nasce anche come progetto da portfolio.

L'introduzione di un piccolo backend serverless permette di mostrare:

- API design;
- backend development;
- caching;
- gestione di API esterne;
- validazione;
- normalizzazione dei dati;
- error handling;
- separazione frontend/backend.

La complessità aggiuntiva rimane comunque contenuta.

---

# 4. Perché non useremo un database nell'MVP

Non verranno introdotti inizialmente:

- PostgreSQL;
- MySQL;
- SQLite lato server;
- Cloudflare D1;
- Redis;
- database simili.

OpenF1 possiede già i dati necessari.

Salvare una copia completa dei dati introdurrebbe problemi aggiuntivi:

```text
sincronizzazione
aggiornamenti
migrazioni
duplicazione dati
importazioni fallite
storage
```

senza portare abbastanza valore all'MVP.

Il database verrà aggiunto solo se emergerà un'esigenza reale.

---

# 5. Hosting e runtime

## Scelta

**Cloudflare Workers**

PitWall utilizzerà un unico progetto basato su:

```text
React + Vite + Cloudflare Worker
```

Il frontend sarà servito come applicazione web e le route:

```text
/api/*
```

saranno gestite dal Worker.

Questo permette di avere:

```text
un repository
un deploy
un dominio
frontend + backend
```

senza dover mantenere due infrastrutture separate.

---

# 6. Linguaggio

## Scelta

**TypeScript**

TypeScript verrà utilizzato sia nel frontend sia nel Worker.

Motivazioni:

- tipi condivisi;
- meno errori banali;
- migliore manutenzione;
- migliore autocomplete;
- utile per modellare dati complessi;
- buona integrazione con React;
- buona integrazione con Cloudflare Workers.

---

# 7. Frontend

## Scelta

**React**

React gestirà:

- selezione stagione;
- selezione gara;
- selezione piloti;
- dashboard;
- grafici;
- stati di caricamento;
- stati di errore;
- navigazione dell'app.

---

# 8. Build tool

## Scelta

**Vite**

Vite verrà utilizzato per:

- sviluppo locale;
- build;
- integrazione React;
- integrazione con Cloudflare Workers.

---

# 9. Libreria grafici

## Scelta

**Apache ECharts**

Era stata valutata anche Recharts.

### Recharts

Pro:

- semplice;
- molto integrato con React;
- facile da imparare.

Contro:

- meno flessibile per grafici complessi;
- potrebbe diventare limitante con annotazioni, eventi e timeline complesse.

### ECharts

Pro:

- molto potente;
- supporta annotazioni;
- supporta marker;
- supporta zoom;
- supporta tooltip avanzati;
- adatto a dataset complessi;
- adatto a visualizzazioni sportive.

Contro:

- leggermente più complesso;
- meno "React-native" come filosofia.

## Decisione

PitWall utilizzerà **ECharts** perché la data visualization è una parte centrale del progetto.

---

# 10. Fonte dati

## Scelta

**OpenF1**

OpenF1 sarà la sorgente dati primaria.

Endpoint inizialmente rilevanti:

```text
sessions
drivers
laps
position
pit
stints
session_result
race_control
```

L'integrazione deve essere isolata in un modulo dedicato.

Il resto dell'app non deve conoscere direttamente il formato OpenF1.

---

# 11. OpenF1 Adapter

Verrà creato uno strato dedicato:

```text
OpenF1
  ↓
OpenF1 Client
  ↓
Validation
  ↓
Normalization
  ↓
PitWall Domain
```

File indicativi:

```text
worker/openf1/client.ts
worker/openf1/schemas.ts
worker/openf1/normalize.ts
```

Questo livello serve a proteggere PitWall da cambiamenti dell'API esterna.

---

# 12. Runtime validation con Zod

## Scelta

**Zod**

### Cos'è Zod?

TypeScript controlla i tipi mentre sviluppiamo.

Ma quando riceviamo dati da Internet:

```text
OpenF1
   ↓
JSON
```

TypeScript non può garantire che quei dati siano veramente corretti.

Esempio.

Noi potremmo aspettarci:

```json
{
  "driver_number": 16,
  "lap_number": 22,
  "lap_duration": 82.4
}
```

ma l'API potrebbe restituire:

```json
{
  "driver_number": 16,
  "lap_number": null
}
```

oppure potrebbe mancare un campo.

Zod permette di controllare realmente il dato ricevuto.

Concettualmente:

```text
OpenF1 JSON
     ↓
Zod
     ↓
è valido?
  ↙       ↘
 sì       no
 ↓         ↓
continua   errore controllato
```

### Perché usarlo

Evita che dati imprevisti arrivino fino ai grafici e causino errori difficili da capire.

Zod sarà usato principalmente nel backend, al confine tra:

```text
Internet
↓
PitWall
```

---

# 13. Normalizzazione dei dati

Questa è una decisione architetturale fondamentale.

Il resto dell'app non lavorerà direttamente con oggetti OpenF1.

Esempio OpenF1:

```json
{
  "driver_number": 16,
  "lap_number": 18,
  "lap_duration": 82.412,
  "is_pit_out_lap": false
}
```

PitWall lo trasformerà in un modello interno:

```ts
interface Lap {
  driverId: string
  lapNumber: number
  durationMs: number | null
  pitOut: boolean
}
```

Quindi:

```text
OpenF1 format
     ↓
normalization
     ↓
PitWall format
```

Vantaggi:

- meno dipendenza da OpenF1;
- codice più leggibile;
- test più semplici;
- futuro MCP più semplice;
- eventuale cambio di provider più semplice.

---

# 14. Domain layer

PitWall avrà propri modelli.

Indicativamente:

```text
Race
Driver
Lap
Position
Stint
PitStop
RaceResult
RaceControlEvent
```

La UI e l'analysis layer devono usare questi oggetti.

Non devono usare direttamente gli oggetti OpenF1.

---

# 15. Analysis layer

Verrà creato uno strato indipendente da React.

Esempi di funzioni future:

```text
compareLapTimes()
getPositionEvolution()
getStints()
getPitStops()
getAveragePace()
compareStintPace()
getPositionGain()
```

Queste funzioni:

- non devono conoscere React;
- non devono conoscere OpenF1;
- devono lavorare con i modelli PitWall;
- devono essere facilmente testabili.

Schema:

```text
Normalized PitWall Data
          ↓
      Analysis
          ↓
     Results/Data
          ↓
         UI
```

In futuro:

```text
Analysis
   ├── UI
   └── MCP
```

---

# 16. API PitWall

Non verrà creata una copia identica dell'API OpenF1.

Da evitare:

```text
/api/laps
/api/pit
/api/stints
```

se rappresentano solamente proxy diretti di OpenF1.

L'API dovrebbe invece esporre concetti PitWall.

Endpoint indicativi:

```text
GET /api/seasons

GET /api/races?season=2025

GET /api/races/:sessionKey/drivers

GET /api/races/:sessionKey/comparison?drivers=16,44
```

L'endpoint `comparison` potrà aggregare i dati necessari a una pagina.

---

# 17. Endpoint aggregato

## Scelta

Per il confronto tra due piloti preferiamo un endpoint aggregato.

Esempio:

```text
GET /api/races/12345/comparison?drivers=16,44
```

Il browser fa:

```text
1 richiesta
```

Il Worker può fare:

```text
laps
positions
stints
pit
results
```

in parallelo verso OpenF1.

Poi restituisce un unico payload normalizzato.

Vantaggi:

- frontend più semplice;
- meno orchestrazione lato browser;
- caching centralizzato;
- error handling centralizzato.

---

# 18. Caching

## Scelta

PitWall userà caching sia lato browser sia lato Worker.

### Cos'è il caching?

Caching significa:

> salvare temporaneamente un risultato già ottenuto per evitare di rifare la stessa operazione.

Esempio senza cache:

```text
utente apre Monza 2025
        ↓
OpenF1

utente ricarica
        ↓
OpenF1

utente ricarica ancora
        ↓
OpenF1
```

Con cache:

```text
prima richiesta
      ↓
OpenF1
      ↓
salva risultato

seconda richiesta
      ↓
usa risultato salvato
```

### Perché serve in PitWall

I dati di una gara già conclusa cambiano pochissimo o non cambiano affatto.

Non ha senso riscaricarli continuamente.

Il caching permette:

- meno richieste;
- maggiore velocità;
- minore rischio di rate limit;
- minore dipendenza da OpenF1;
- migliore esperienza utente.

---

# 19. Due livelli di cache

PitWall avrà:

```text
Browser Cache
    ↓
Worker Cache
    ↓
OpenF1
```

Sono due cose diverse.

---

## Browser cache

Verrà gestita principalmente da **TanStack Query**.

Se l'utente passa da:

```text
Monza
↓
Spa
↓
Monza
```

l'app può riusare i dati di Monza già caricati.

---

## Worker cache

Il Worker potrà salvare temporaneamente risposte provenienti da OpenF1.

Esempio:

```text
utente A → Monza
            ↓
          OpenF1

utente B → Monza
            ↓
          cache

utente C → Monza
            ↓
          cache
```

In questo modo più utenti possono condividere i risultati già recuperati.

---

# 20. Strategia cache iniziale

Politica indicativa:

```text
stagioni
→ cache molto lunga

lista gare storiche
→ cache lunga

gara storica conclusa
→ circa 7 giorni

gara conclusa recentemente
→ circa 1 ora
```

I valori esatti potranno essere modificati durante lo sviluppo.

Non verranno inizialmente introdotti:

- Redis;
- Cloudflare KV;
- database per il caching.

La soluzione deve restare semplice.

---

# 21. TanStack Query

## Scelta

**TanStack Query**

### Cos'è?

È una libreria React che aiuta a gestire dati che arrivano da API.

Gestisce automaticamente concetti come:

```text
loading
error
cache
refetch
retry
```

Senza TanStack Query dovremmo costruire manualmente molta logica.

Esempio concettuale:

```text
React component
      ↓
TanStack Query
      ↓
PitWall API
```

TanStack Query gestirà principalmente la cache lato browser.

---

# 22. Testing

## Scelta

**Vitest**

I test saranno concentrati sulla logica importante.

Tre categorie principali.

---

## Normalization tests

Controllano:

```text
OpenF1 data
    ↓
Normalization
    ↓
PitWall data
```

Esempio:

```text
driver_number: 16
lap_number: 12

↓

Driver/Lap PitWall corretti
```

---

## Analysis tests

Controllano funzioni come:

```text
compareLapTimes()
compareStintPace()
getPositionEvolution()
```

Questi test sono particolarmente importanti perché verificano che le analisi mostrate agli utenti siano corrette.

---

## Worker/API tests

Mock delle risposte OpenF1.

Schema:

```text
request PitWall API
        ↓
mock OpenF1
        ↓
validation
        ↓
normalization
        ↓
expected response
```

---

# 23. Code quality

Verranno utilizzati:

```text
ESLint
Prettier
TypeScript typecheck
```

Scopi:

### ESLint

Individua potenziali problemi nel codice.

### Prettier

Mantiene una formattazione uniforme.

### Typecheck

Controlla gli errori TypeScript.

---

# 24. GitHub Actions

## Scelta

Configurare CI con GitHub Actions.

Trigger:

```text
push
pull request
```

Pipeline:

```text
checkout
 ↓
npm install
 ↓
lint
 ↓
typecheck
 ↓
test
 ↓
build
```

Se qualcosa fallisce:

```text
CI ❌
```

Se tutto passa:

```text
CI ✅
```

In futuro sarà possibile aggiungere deploy automatico della branch `main`.

---

# 25. Error handling

PitWall deve gestire esplicitamente almeno:

```text
OpenF1 non disponibile
rate limit
timeout
dati mancanti
campi null
gara senza dati
pilota ritirato
risposta non valida
errore di rete
```

La UI non deve mostrare errori tecnici grezzi.

Da evitare:

```text
Cannot read properties of undefined
```

Preferire:

```text
Race data is currently unavailable.
Please try again later.
```

---

# 26. Librerie e infrastrutture che NON useremo inizialmente

Non usare nell'MVP salvo reale necessità:

```text
AWS
PostgreSQL
MySQL
Redis
D1
Docker obbligatorio
Kubernetes
microservices
authentication
user accounts
queues
cron jobs
LLM
AI agents
MCP
```

Questo è intenzionale.

L'obiettivo è costruire il prodotto, non accumulare tecnologie.

---

# 27. Struttura repository proposta

```text
pitwall/

src/
├── app/
│   ├── App.tsx
│   └── providers.tsx
│
├── api/
│   └── pitwallClient.ts
│
├── domain/
│   ├── race.ts
│   ├── driver.ts
│   ├── lap.ts
│   ├── stint.ts
│   ├── pitStop.ts
│   └── position.ts
│
├── analysis/
│   ├── compareLapTimes.ts
│   ├── positionEvolution.ts
│   ├── stintAnalysis.ts
│   └── pitStopAnalysis.ts
│
├── features/
│   ├── race-selector/
│   ├── driver-selector/
│   └── race-comparison/
│
├── charts/
│
└── components/

worker/
├── index.ts
│
├── routes/
│   ├── seasons.ts
│   ├── races.ts
│   ├── drivers.ts
│   └── comparison.ts
│
├── openf1/
│   ├── client.ts
│   ├── schemas.ts
│   ├── normalize.ts
│   └── types.ts
│
└── cache/
    └── cache.ts

tests/

docs/
├── architecture.md
├── decisions.md
└── openf1-data-model.md

.github/
└── workflows/
    └── ci.yml

wrangler.jsonc
vite.config.ts
package.json
```

La struttura può cambiare se emergono motivazioni concrete.

La separazione concettuale deve invece rimanere.

---

# 28. Ordine di implementazione

## Phase 0 — Decisioni

Completato:

```text
✓ architettura frontend + Worker
✓ TypeScript
✓ React
✓ Vite
✓ Cloudflare Workers
✓ ECharts
✓ TanStack Query
✓ Zod
✓ Vitest
✓ no database
✓ no authentication
✓ no AI iniziale
✓ no MCP iniziale
```

---

## Phase 1 — Foundation

```text
□ creare repository GitHub
□ inizializzare React + TypeScript + Vite
□ configurare Cloudflare Worker
□ configurare sviluppo locale
□ creare endpoint /api/health
□ primo deploy pubblico
```

---

## Phase 2 — OpenF1 exploration

Studiare realmente gli endpoint:

```text
□ sessions
□ drivers
□ laps
□ position
□ pit
□ stints
□ session_result
□ race_control
```

Creare:

```text
docs/openf1-data-model.md
```

---

## Phase 3 — Backend foundation

```text
□ OpenF1 client
□ Zod schemas
□ normalization
□ error handling
□ PitWall API routes
□ caching
```

---

## Phase 4 — Frontend data layer

```text
□ TanStack Query
□ PitWall API client
□ loading states
□ error states
```

---

## Phase 5 — Selection flow

```text
□ season selector
□ race selector
□ driver A selector
□ driver B selector
```

---

## Phase 6 — Core visualizations

```text
□ race summary
□ position chart
□ lap time chart
□ stint visualization
□ pit stop markers
```

---

## Phase 7 — Analysis layer

```text
□ position evolution
□ pace comparison
□ stint comparison
□ pit analysis
```

---

## Phase 8 — Quality

```text
□ normalization tests
□ analysis tests
□ Worker tests
□ ESLint
□ Prettier
□ typecheck
□ GitHub Actions
```

---

## Phase 9 — Portfolio polish

```text
□ responsive UI
□ visual polish
□ README
□ screenshots
□ architecture diagram
□ documented decisions
□ public demo
```

A questo punto l'MVP è considerato completo.

---

# 29. MCP futuro

MCP verrà valutato solo dopo l'MVP.

Architettura desiderata:

```text
                    React
                      ↑
                      │
OpenF1 → Domain → Analysis
                      │
                      ↓
                     MCP
```

MCP non dovrà essere un semplice proxy di OpenF1.

Deve esporre capacità PitWall.

Tool possibili:

```text
compare_drivers
get_stints
get_pit_stops
compare_stint_pace
get_position_changes
```

---

# 30. AI futura

Un eventuale agente AI arriverà dopo MCP o comunque dopo la stabilizzazione dell'analysis layer.

Schema:

```text
User question
     ↓
AI Agent
     ↓
PitWall tools
     ↓
Analysis layer
     ↓
Verified data
```

La AI non deve sostituire l'analisi deterministica.

Deve usare dati e funzioni già verificati.

---

# 31. Principi di sviluppo

Durante tutto il progetto seguire queste regole.

### 1. Build the product first

Prima costruire PitWall.

Poi aggiungere AI.

---

### 2. No technology for its own sake

Prima di aggiungere una tecnologia chiedere:

> Quale problema reale risolve?

---

### 3. External APIs are untrusted inputs

I dati OpenF1 devono essere:

```text
validated
normalized
handled safely
```

---

### 4. UI should not know OpenF1

La UI deve conoscere solamente il dominio PitWall.

---

### 5. Analysis should not know React

Le funzioni di analisi devono essere indipendenti dal frontend.

---

### 6. MCP should reuse the analysis layer

Non duplicare logica.

---

### 7. Decisions must be understandable

Quando un agente AI propone una scelta significativa deve spiegare:

```text
alternative
pro
contro
recommendation
trade-off
```

---

# 32. Glossario rapido

## API

Un modo standard con cui due software comunicano.

In PitWall:

```text
React → PitWall API → OpenF1
```

---

## Backend

La parte dell'applicazione che gira sul server.

Nel nostro caso:

```text
Cloudflare Worker
```

---

## Serverless

Non significa che non esistono server.

Significa che non dobbiamo amministrarli direttamente.

Cloudflare gestisce l'infrastruttura.

---

## Worker

Piccolo programma backend eseguito sull'infrastruttura Cloudflare.

---

## Cache

Copia temporanea di un risultato per evitare di ricalcolarlo o riscaricarlo.

---

## Rate limit

Numero massimo di richieste che un servizio permette in un determinato periodo.

---

## Zod

Libreria che verifica che i dati ricevuti a runtime rispettino la struttura attesa.

---

## Normalization

Trasformazione di dati esterni nel formato interno dell'applicazione.

```text
OpenF1 data
↓
PitWall data
```

---

## Domain model

Il modo in cui PitWall rappresenta concetti come:

```text
Race
Driver
Lap
Stint
PitStop
```

---

## Analysis layer

Funzioni che elaborano i dati e producono informazioni utili.

---

## TanStack Query

Libreria React per recuperare e gestire dati provenienti da API.

---

## CI

Continuous Integration.

Esecuzione automatica di:

```text
lint
test
build
```

quando viene modificato il repository.

---

## GitHub Actions

Sistema GitHub che esegue automaticamente workflow come la CI.

---

## MCP

Protocollo che permette ad applicazioni AI di utilizzare tool e dati forniti da software esterni.

In PitWall sarà un'estensione futura.

---

# 33. Decisione finale sull'MVP

L'MVP di PitWall sarà quindi:

```text
React
+
TypeScript
+
Vite
+
ECharts
+
TanStack Query

        ↓

Cloudflare Worker

+
Zod
+
Normalization
+
HTTP Caching

        ↓

OpenF1
```

Quality layer:

```text
Vitest
ESLint
Prettier
TypeScript
GitHub Actions
```

Non presenti inizialmente:

```text
Database
Authentication
AI
MCP
AWS
```

Questa è l'architettura di riferimento da utilizzare per iniziare lo sviluppo.
