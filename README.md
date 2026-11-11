# DB3 Oefenomgeving

Statische oefensite voor **Databases 3 (DATAB3SO)**. Per onderwerp uit de toetsmatrijs krijgen studenten uitleg, kernpunten, valkuilen, flashcards en een oefenquiz. Daarnaast is er een proeftoets van 45 vragen (3 per onderwerp).

Er is geen build-stap en er zijn geen dependencies: plain HTML, CSS en JavaScript. Voortgang wordt alleen in de `localStorage` van de browser bewaard.

## Structuur

```
index.html           overzicht + toetsmatrijs + voortgang
onderwerp.html       ?id=<onderwerp>  uitleg | kernpunten | flashcards | quiz
proeftoets.html      45 vragen, 3 per onderwerp, nabespreking per onderwerp
css/style.css        alle styling (licht + donker thema)
js/db3.js            catalogus: 15 onderwerpen, 7 clusters (toetsmatrijs)
js/app.js            opslag, highlighting, quiz-, flashcard- en proeftoets-logica
data/topics/*.js     de inhoud, één bestand per onderwerp
scripts/validate.mjs controleert alle onderwerpbestanden
```

## Lokaal bekijken

```bash
python -m http.server 8080      # of: npx serve .
# open http://localhost:8080
```

## Inhoud aanpassen

Elk bestand in `data/topics/` roept `DB3.registerTopic({...})` aan met `intro`, `sections`, `keyPoints`, `pitfalls`, `flashcards` en `quiz`. Na een wijziging:

```bash
node scripts/validate.mjs           # alles
node scripts/validate.mjs views     # één onderwerp
```

De validator controleert de minimale aantallen, dat elke quizvraag precies 4 opties heeft, dat `answer` tussen 0 en 3 ligt en hoe de juiste antwoorden over A-D verdeeld zijn.

## Bronmateriaal blijft buiten de repo

De map `Assets/` (Brightspace-export en Remindo-toetsvragen) staat in `.gitignore` en `.vercelignore` en komt dus nooit in git of in een deployment. De oefenvragen op de site zijn zelf geschreven op basis van de lesstof: ze dekken dezelfde concepten als de toets, maar zijn geen kopie van de toetsvragen.

## Hosting op GitHub Pages

De site wordt gehost met GitHub Pages vanaf de branch `main` (root). Er is geen build-stap nodig: elke push naar `main` staat binnen een minuut online. Het bestand `.nojekyll` zorgt dat GitHub de bestanden ongewijzigd serveert. Alle pagina's hebben `<meta name="robots" content="noindex">`.

Vercel kan ook: importeer de repo met framework preset **Other** en zonder build command. `vercel.json` en `.vercelignore` zijn daarvoor al aanwezig.
