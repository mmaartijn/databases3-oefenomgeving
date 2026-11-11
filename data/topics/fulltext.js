DB3.registerTopic({
  id: "fulltext",
  intro: "LIKE zoekt naar patronen; Full Text Search zoekt naar betekenis. Het vindt ook andere vormen van een woord, synoniemen en woorden die dicht bij elkaar staan, en dat razendsnel dankzij een slimme index. Je leert wanneer je CONTAINS, FREETEXT of hun TABLE-varianten met ranking gebruikt.",
  sections: [
    {
      title: "Wat is Full Text Search?",
      body: `<p>Full Text Search (FTS) zoekt in grote stukken tekst op basis van een <strong>slimme index</strong>. Bij het indexeren knipt SQL Server de tekst in woorden en brengt elk woord terug naar zijn <strong>stam</strong> met een <em>stemmer</em>:</p>
<pre><code class="sql">running → run      ran → run      runs → run
lopen   → loop     liep → loop    gelopen → loop</code></pre>
<p>Woorden met dezelfde stam liggen daardoor dicht bij elkaar in de index. Daar komt de <strong>performance</strong> vandaan: een zoekvraag hoeft niet alle tekst te lezen, maar zoekt in die index.</p>
<p>Daarnaast kent FTS:</p>
<ul>
<li><strong>Andere vormen</strong> van een woord (vervoegingen, meervouden).</li>
<li><strong>Synoniemen</strong> via een <strong>thesaurus</strong>. Die vul je zelf, want synoniemen zijn per domein anders (in een boardgame-database is "meeple" iets anders dan in een kledingwinkel).</li>
<li><strong>Ranking</strong>: resultaten krijgen een score voor hoe goed ze matchen.</li>
<li><strong>Nabijheid</strong>: woorden die dicht bij elkaar staan (<code>NEAR</code>). "Overval" NEAR "bank" geeft andere artikelen dan "rente" NEAR "bank".</li>
</ul>`
    },
    {
      title: "FTS vs. LIKE",
      body: `<table>
<thead><tr><th></th><th>LIKE</th><th>Full Text Search</th></tr></thead>
<tbody>
<tr><td>Zoekt op</td><td>Patronen in tekens</td><td>Woorden en hun betekenis</td></tr>
<tr><td>Vervoegingen/synoniemen</td><td>Nee</td><td>Ja (stemmer + thesaurus)</td></tr>
<tr><td>Index</td><td><code>'%woord%'</code> kan geen index gebruiken</td><td>Eigen full-text index</td></tr>
<tr><td>Meerdere kolommen</td><td>Per kolom een LIKE</td><td>In één keer over meerdere kolommen</td></tr>
<tr><td>Ranking</td><td>Nee</td><td>Ja (CONTAINSTABLE/FREETEXTTABLE)</td></tr>
</tbody>
</table>
<p>Wanneer kies je toch <strong>LIKE</strong>? Als je redelijk precies weet wat je zoekt en een <strong>exacte (patroon)match</strong> wilt, bijvoorbeeld een productcode die met <code>'BG-2024-'</code> begint. Dat LIKE "makkelijker te schrijven" zou zijn of FTS niet werkt bij korte teksten, zijn geen goede redenen.</p>`
    },
    {
      title: "Inrichten",
      body: `<p>Voordat je kunt zoeken:</p>
<ol>
<li>De Full-Text-component moet in SQL Server <strong>geïnstalleerd</strong> zijn.</li>
<li>Je hebt een <strong>full-text catalog</strong> nodig.</li>
<li>De tabel heeft een <strong>unieke index</strong> nodig (de primary key voldoet).</li>
<li>Je geeft per kolom aan in welke <strong>taal</strong> de tekst is (voor de juiste stemmer).</li>
</ol>
<pre><code class="sql">CREATE FULLTEXT CATALOG BoardgameCatalog AS DEFAULT;

CREATE FULLTEXT INDEX ON dbo.Boardgames
(
    PrimaryName  LANGUAGE 1033,   -- Engels
    Description  LANGUAGE 1033,
    Mechanics    LANGUAGE 1033
)
KEY INDEX PK_Boardgames
ON BoardgameCatalog;</code></pre>`
    },
    {
      title: "De vier zoekfuncties",
      body: `<table>
<thead><tr><th>Functie</th><th>Wat</th><th>Gebruik</th></tr></thead>
<tbody>
<tr><td><code>CONTAINS(kolom, 'zoek')</code></td><td>Precieze woorden/zinsdelen (met prefix <code>"run*"</code>, AND, OR, NOT, NEAR)</td><td>In de WHERE</td></tr>
<tr><td><code>FREETEXT(kolom, 'zoek')</code></td><td>Zoals CONTAINS, maar met <strong>stemming</strong> (vervoegingen) en thesaurus: zoekt op betekenis</td><td>In de WHERE</td></tr>
<tr><td><code>CONTAINSTABLE(tabel, kolom, 'zoek')</code></td><td>Zoals CONTAINS, maar als tabel met <code>[KEY]</code> en <strong><code>RANK</code></strong></td><td>JOIN op de key</td></tr>
<tr><td><code>FREETEXTTABLE(tabel, kolom, 'zoek')</code></td><td>Zoals FREETEXT, maar met <strong>RANK</strong></td><td>JOIN op de key</td></tr>
</tbody>
</table>
<pre><code class="sql">-- Exact het woord 'dragon'
SELECT PrimaryName FROM dbo.Boardgames
WHERE  CONTAINS(Description, 'dragon');

-- Ook 'dragons', vervoegingen en synoniemen
SELECT PrimaryName FROM dbo.Boardgames
WHERE  FREETEXT(Description, 'dragon');

-- Het béste document dat ook vervoegingen mag bevatten
SELECT TOP (1) b.PrimaryName, ft.[RANK]
FROM   FREETEXTTABLE(dbo.Boardgames, Description, 'trading ships across the sea') ft
JOIN   dbo.Boardgames b ON b.BggId = ft.[KEY]
ORDER BY ft.[RANK] DESC;</code></pre>
<p>De <strong>RANK</strong>-kolom geeft aan <strong>hoe goed het resultaat matcht met de zoekvraag</strong> (0 tot 1000). Dat is een relevantiescore, niet simpelweg "hoe vaak het woord voorkomt" of "de afstand van NEAR".</p>
<div class="callout exam"><strong>Toetstip</strong> Moet je het <em>beste</em> resultaat hebben? Dan heb je een <strong>TABLE</strong>-variant nodig (die heeft RANK). Mogen er ook <em>vervoegingen/verbasteringen</em> in? Dan <strong>FREETEXT</strong>. Allebei? <strong>FREETEXTTABLE</strong>.</div>`
    },
    {
      title: "Geavanceerd zoeken en goede keuzes",
      body: `<p>In de zoekstring van <code>CONTAINS</code>/<code>CONTAINSTABLE</code> kun je combineren:</p>
<pre><code class="sql">WHERE CONTAINS(Description, 'NEAR(hide, seek)')                 -- dicht bij elkaar
WHERE CONTAINS(Description, 'NEAR(hide, seek) AND pony')         -- en ook 'pony'
WHERE CONTAINS(Description, 'NEAR(hide, seek) AND NOT pony')     -- maar niet 'pony'
WHERE CONTAINS(Description, 'NEAR((hide, seek), 2)')             -- max. 2 woorden ertussen
WHERE CONTAINS(Description, 'NEAR((seek, hide), 2, TRUE)')       -- en seek vóór hide</code></pre>
<p><strong>Kolommen kiezen</strong>: je kúnt met <code>*</code> op alle geïndexeerde kolommen zoeken, maar dat is niet altijd het beste. Weet je ongeveer in welke kolom de informatie staat (bijv. alleen <code>Mechanics</code>), dan geeft zoeken op alleen die kolom <strong>betere resultaten</strong>, met minder ruis.</p>
<pre><code class="sql">WHERE CONTAINS(Mechanics, 'deck')          -- gericht
WHERE CONTAINS(*, 'deck')                  -- alle geïndexeerde kolommen</code></pre>
<p><strong>Gebruikers die niet precies weten hoe ze iets moeten schrijven?</strong> Kies dan de meest vergevingsgezinde zoekfunctie: <strong>FREETEXT</strong>(TABLE). Elke typfout handmatig in de thesaurus zetten of een stapel LIKE-varianten schrijven is niet te onderhouden.</p>`
    }
  ],
  keyPoints: [
    "FTS is snel omdat de index gevuld wordt met de <strong>stam</strong> van de woorden.",
    "FTS kent vervoegingen (stemmer), synoniemen (thesaurus), ranking en nabijheid (NEAR).",
    "Een <strong>thesaurus</strong> legt vast welke synoniemen gelden.",
    "Kies LIKE als je precies weet wat je zoekt en een exacte match wilt.",
    "<code>CONTAINS</code> zoekt het exacte woord; <code>FREETEXT</code> ook vervoegingen en verbasteringen.",
    "<code>CONTAINSTABLE</code>/<code>FREETEXTTABLE</code> geven een <code>RANK</code>: hoe goed het resultaat bij de zoekvraag past.",
    "Beste document mét verbasteringen → <strong>FREETEXTTABLE</strong> + TOP(1) op RANK.",
    "<code>NEAR</code> = zoektermen moeten dicht bij elkaar in de tekst staan (eventueel met maximale afstand en volgorde).",
    "Zoek gericht op de kolommen waar je de data verwacht; dat geeft vaak betere resultaten dan <code>*</code>.",
    "Inrichten: component installeren, full-text catalog, unieke index (PK) en taal per kolom."
  ],
  pitfalls: [
    { wrong: "LIKE is sneller dan Full Text Search voor het doorzoeken van lange teksten.", right: "<code>LIKE '%woord%'</code> kan geen index gebruiken; FTS werkt met een eigen index en is op grote datasets vele malen sneller." },
    { wrong: "CONTAINS(kolom, 'person') vindt ook 'personalise'.", right: "CONTAINS zoekt het hele woord. Voor een prefix gebruik je <code>'\"person*\"'</code>." },
    { wrong: "FREETEXT vindt woorden die alleen qua spelling lijken, zoals 'perron' bij 'person'.", right: "FREETEXT werkt met stammen en synoniemen (betekenis), niet met letters die toevallig overeenkomen." },
    { wrong: "Met CONTAINS of FREETEXT kun je direct de TOP(1) beste match selecteren.", right: "Die geven geen score. Voor 'de beste' heb je de RANK uit CONTAINSTABLE of FREETEXTTABLE nodig." },
    { wrong: "In Full Text Search zoek je altijd op alle kolommen voor het beste resultaat.", right: "Als je weet in welke kolommen de data staat, geeft gericht zoeken minder ruis en betere resultaten." },
    { wrong: "NEAR gebruik je om GPS-coördinaten in de buurt te vinden.", right: "NEAR is voor woorden in een tekst. Voor afstand tussen locaties gebruik je STDistance." }
  ],
  flashcards: [
    { front: "Je zoekt 'running' en vindt ook 'ran' en 'runs', en toch is de zoekopdracht snel. Wat heeft SQL Server vooraf gedaan?", back: "Een full-text index gevuld met de stam van elk woord (via de stemmer), zodat zoeken een opzoeking in die index is." },
    { front: "Klanten zoeken op 'sneakers', maar in je data staat 'gympen'. Welk FTS-onderdeel stel je in?", back: "De thesaurus: daarin leg je vast dat die woorden als synoniem gelden." },
    { front: "Wanneer LIKE i.p.v. FTS?", back: "Als je redelijk precies weet wat je zoekt en een exacte match wilt." },
    { front: "CONTAINS vs. FREETEXT", back: "CONTAINS: exact het woord. FREETEXT: ook vervoegingen/verbasteringen en synoniemen." },
    { front: "Wat geven CONTAINSTABLE en FREETEXTTABLE extra?", back: "Een tabel met [KEY] en RANK, waardoor je op relevantie kunt sorteren." },
    { front: "Waar is de RANK op gebaseerd?", back: "Op hoe goed het resultaat matcht met de zoekvraag." },
    { front: "Beste document, verbasteringen toegestaan: welke functie?", back: "FREETEXTTABLE, JOIN op KEY, TOP(1) ORDER BY RANK DESC." },
    { front: "Wat doet NEAR?", back: "Zoektermen moeten dicht bij elkaar in de tekst staan, eventueel met max. afstand en volgorde." },
    { front: "Vervoegingen van 'hide' zoeken", back: "<code>WHERE FREETEXT(kolom, 'hide')</code>" },
    { front: "Vereisten voor FTS op een tabel", back: "FTS geïnstalleerd, full-text catalog, unieke index (bijv. PK), taal per kolom." },
    { front: "<code>CONTAINS(*, 'blue')</code> geeft veel ruis, omdat 'blue' ook in de opmerkingen staat. Wat verbeter je?", back: "Zoek alleen in de kolom(men) waar het hoort, bijv. <code>CONTAINS(StockItemName, 'blue')</code>; dat geeft relevantere resultaten." },
    { front: "Gebruikers maken veel typ- en vervoegingsfouten. Welke aanpak?", back: "FREETEXT(TABLE) gebruiken, de meest vergevingsgezinde zoekfunctie." }
  ],
  quiz: [
    {
      q: "Waarom is <code>CONTAINS(Description, 'steel')</code> op een grote tabel veel sneller dan <code>LIKE '%steel%'</code>?",
      options: [
        "CONTAINS draait parallel en LIKE niet",
        "CONTAINS zoekt in een vooraf gevulde index met woordstammen; LIKE met % vooraan moet elke rij doorzoeken",
        "LIKE controleert ook hoofdletters",
        "CONTAINS kijkt alleen naar de eerste 100 rijen"
      ],
      answer: 1,
      explain: "Een full-text index slaat per woord(stam) op in welke rijen het voorkomt. LIKE met een wildcard vooraan kan geen index gebruiken."
    },
    {
      q: "Een medewerker zoekt naar artikelcodes die beginnen met <code>'WWI-2016-'</code>. Wat is hier de logische keuze?",
      options: [
        "LIKE 'WWI-2016-%', omdat het om een exact, bekend patroon gaat",
        "FREETEXT, omdat dat ook vervoegingen vindt",
        "FREETEXTTABLE, omdat je dan een rank krijgt",
        "CONTAINS met NEAR"
      ],
      answer: 0,
      explain: "Als je precies weet wat je zoekt en een exacte (patroon)match wilt, is LIKE prima, en met een prefix kan het zelfs een gewone index gebruiken."
    },
    {
      q: "Je wilt in de beschrijvingen ook teksten vinden met 'ran' en 'running' als iemand zoekt op 'run'. Wat gebruik je?",
      options: [
        "<code>WHERE Description LIKE '%run%'</code>",
        "<code>WHERE CONTAINS(Description, 'run')</code>",
        "<code>WHERE FREETEXT(Description, 'run')</code>",
        "<code>WHERE Description = NEAR('run')</code>"
      ],
      answer: 2,
      explain: "FREETEXT gebruikt stemming en vindt dus andere vormen van het woord. CONTAINS zoekt exact 'run'; LIKE zou ook 'brunch' vinden en mist 'ran'."
    },
    {
      q: "Welke query vindt ook producten met 'gaming' of 'games' in de omschrijving als je op 'game' zoekt?",
      options: [
        "<code>WHERE CONTAINS(Description, 'game')</code>",
        "<code>WHERE FREETEXT(Description, 'game')</code>",
        "<code>WHERE Description = 'game'</code>",
        "<code>WHERE CONTAINS(Description, '\"game\"')</code>"
      ],
      answer: 1,
      explain: "FREETEXT zoekt op betekenis en neemt vervoegingen mee. CONTAINS met een los woord zoekt dat exacte woord, tenzij je bijv. FORMSOF(INFLECTIONAL, ...) gebruikt."
    },
    {
      q: "Gebruikers zoeken op 'laptop', maar in je productdata heet het 'notebook'. Wat stel je in?",
      options: [
        "Een extra LIKE '%notebook%'",
        "Een thesaurus-regel die laptop en notebook als synoniem koppelt",
        "Een stoplist met 'laptop'",
        "Een NEAR-zoekopdracht"
      ],
      answer: 1,
      explain: "In de thesaurus leg je synoniemen vast. Een stoplist doet het omgekeerde: daarin staan woorden die juist genegeerd worden."
    },
    {
      q: "Je zoekt het ene spel dat het best past bij de omschrijving 'trading ships across the sea', en vervoegingen mogen ook. Welke aanpak?",
      options: [
        "CONTAINS en dan TOP(1) van het resultaat",
        "CONTAINSTABLE, JOIN op KEY, TOP(1) ORDER BY RANK DESC",
        "FREETEXTTABLE, JOIN op KEY, TOP(1) ORDER BY RANK DESC",
        "FREETEXT en dan TOP(1) van het resultaat"
      ],
      answer: 2,
      explain: "'Het best passend' vraagt om RANK (dus een TABLE-variant); 'vervoegingen mogen' vraagt om FREETEXT. Samen: FREETEXTTABLE."
    },
    {
      q: "Waarop is de waarde in de RANK-kolom van CONTAINSTABLE gebaseerd?",
      options: [
        "Op hoe vaak de zoekwoorden voorkomen",
        "Op de afstand tussen woorden bij NEAR",
        "Op de volgorde waarin de woorden staan",
        "Op hoe goed het resultaat matcht met de zoekvraag"
      ],
      answer: 3,
      explain: "RANK is een relevantiescore (0–1000) voor de hele match. Frequentie en nabijheid kunnen meewegen, maar het is niet alleen dat."
    },
    {
      q: "Je wilt alleen nieuwsartikelen vinden waarin 'overval' en 'bank' vlak bij elkaar staan. Wat gebruik je?",
      options: [
        "<code>CONTAINS(Body, 'NEAR(overval, bank)')</code>",
        "<code>Body LIKE '%overval%bank%'</code>",
        "<code>FREETEXT(Body, 'overval') AND FREETEXT(Body, 'bank')</code>",
        "<code>Body.STDistance('bank') &lt; 5</code>"
      ],
      answer: 0,
      explain: "NEAR is de Full Text-operator voor nabijheid. LIKE eist een vaste volgorde en kent geen afstand; STDistance is voor spatial data."
    },
    {
      q: "De tabel Boardgames heeft een full-text index op PrimaryName, Description en Mechanics. Je zoekt spellen met het spelmechanisme 'deck building'. Wat geeft waarschijnlijk de beste resultaten?",
      options: [
        "Zoeken met <code>*</code> op alle kolommen; dat combineert het meeste",
        "Alleen zoeken in de kolom Mechanics",
        "Het maakt niet uit; FTS kiest zelf de juiste kolom",
        "Zoeken met LIKE op Description"
      ],
      answer: 1,
      explain: "Als je weet waar de informatie staat, voorkom je ruis door gericht te zoeken (bijv. spellen die 'deck' alleen in het verhaal noemen)."
    },
    {
      q: "In een zoekscherm typen gebruikers 'build', 'builds' en 'building' door elkaar. Je wilt de resultaten ook op relevantie sorteren. Welke query past?",
      options: [
        "<code>SELECT ... FROM FREETEXTTABLE(Warehouse.StockItems, *, @zoek) ORDER BY RANK DESC</code>",
        "<code>SELECT ... WHERE StockItemName LIKE '%' + @zoek + '%' ORDER BY StockItemName</code>",
        "<code>SELECT ... WHERE CONTAINS(StockItemName, 'NEAR(build, s)')</code>",
        "<code>SELECT ... WHERE StockItemName = @zoek</code>"
      ],
      answer: 0,
      explain: "FREETEXTTABLE zoekt op betekenis, inclusief vervoegingen, en geeft een RANK terug om op te sorteren. LIKE en = vinden de varianten niet, en NEAR gaat over woorden dicht bij elkaar."
    },
    {
      q: "Welke voorwaarde geldt voor een tabel waarop je een full-text index wilt maken?",
      options: [
        "De tabel mag geen primary key hebben",
        "Alle kolommen moeten NVARCHAR(MAX) zijn",
        "De tabel moet een temporal table zijn",
        "De tabel heeft een unieke index nodig, bijvoorbeeld de primary key"
      ],
      answer: 3,
      explain: "De full-text index moet elke rij uniek kunnen aanwijzen (de KEY). Daarnaast heb je een catalog en een taalinstelling nodig."
    },
    {
      q: "Wat doet <code>CONTAINS(Description, 'NEAR((seek, hide), 2, TRUE)')</code>?",
      options: [
        "Zoekt 'seek' en 'hide' met maximaal 2 woorden ertussen, waarbij 'seek' vóór 'hide' moet staan",
        "Zoekt de 2 beste resultaten voor 'seek' en 'hide'",
        "Zoekt 'seek' of 'hide' in maximaal 2 kolommen",
        "Zoekt synoniemen van 'seek' en 'hide' met rank 2 of hoger"
      ],
      answer: 0,
      explain: "Het getal is de maximale afstand in woorden; TRUE betekent dat de volgorde van de termen telt."
    }
  ]
});
