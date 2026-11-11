DB3.registerTopic({
  id: "queryplans",
  intro: "De profiler vertelt je wélke query traag is; het query execution plan vertelt je waarom. Je leert het plan lezen: welke operatoren er zijn, wat de pijlen betekenen en welke signalen wijzen op een ontbrekende of slecht gekozen index.",
  sections: [
    {
      title: "Wat is een query execution plan?",
      body: `<p>Voordat SQL Server een query uitvoert, bedenkt de <em>query optimizer</em> een stappenplan: welke indexes worden gebruikt, in welke volgorde tabellen worden gejoind, waar gesorteerd wordt. Dat plan kun je bekijken.</p>
<ol>
<li>Klik in SSMS op <strong>Include Actual Execution Plan</strong> (Ctrl+M).</li>
<li>Voer de query uit.</li>
<li>Open het tabblad <strong>Execution Plan</strong>.</li>
<li>Hover over een stap voor details (estimated/actual rows, kosten, gebruikte index).</li>
</ol>
<p>Ontbreekt er volgens SQL Server een index, dan staat die suggestie in <strong>groen</strong> boven het plan ("Missing Index").</p>
<div class="callout exam"><strong>Toetstip</strong> Wil je de performance van een query verbeteren, dan begin je met het <strong>query execution plan</strong>. Daaruit volgt of je de query moet herschrijven of een index op de juiste kolommen moet maken. "Zet het in een view of procedure, die is gecompileerd" of "index op alle kolommen" lost het echte probleem niet op.</div>`
    },
    {
      title: "Lezen: pijlen en dikte",
      body: `<p>Een plan lees je van <strong>rechts naar links</strong>: rechts staan de bronnen (tabellen/indexes), links het eindresultaat (SELECT).</p>
<ul>
<li>De <strong>pijlen</strong> geven de <strong>volgorde</strong> van de stappen aan: de data stroomt van de ene operatie naar de volgende.</li>
<li>De <strong>dikte</strong> van een pijl staat voor de <strong>hoeveelheid data</strong> (aantal rijen) die van de ene naar de volgende operatie gaat. Een dikke pijl helemaal rechts die pas links dun wordt, betekent dat er veel data wordt opgehaald en pas laat wordt weggefilterd.</li>
</ul>
<p>De pijldikte zegt dus niets over hoe lang een stap duurt, hoe complex hij is of welke foreign keys gebruikt worden. Voor de kosten kijk je naar het percentage onder elke operator.</p>`
    },
    {
      title: "De belangrijkste operatoren",
      body: `<table>
<thead><tr><th>Operator</th><th>Betekenis</th><th>Typisch bij</th></tr></thead>
<tbody>
<tr><td><strong>Clustered Index Scan</strong></td><td>De hele tabel van begin tot eind doorlopen</td><td>Geen bruikbare index voor de WHERE</td></tr>
<tr><td><strong>Clustered Index Seek</strong></td><td>Via de boom direct naar de juiste rij(en)</td><td><code>WHERE PrimaryKey = 42</code></td></tr>
<tr><td><strong>NonClustered Index Seek</strong></td><td>Gericht zoeken in een eigen index</td><td><code>WHERE CustomerName = 'Tailspin'</code> met index op CustomerName</td></tr>
<tr><td><strong>NonClustered Index Scan</strong></td><td>Een eigen index (gesorteerd) helemaal doorlopen</td><td><code>ORDER BY</code> op een geïndexeerde kolom, of een range</td></tr>
<tr><td><strong>Key Lookup</strong></td><td>Per gevonden rij terug naar de clustered index voor ontbrekende kolommen</td><td>SELECT van kolommen die niet in de nonclustered index zitten</td></tr>
<tr><td><strong>Sort</strong></td><td>Los sorteren in het geheugen</td><td>ORDER BY / GROUP BY zonder passende index</td></tr>
<tr><td>Nested Loops / Hash Match / Merge Join</td><td>Manieren om te joinen</td><td>JOINs</td></tr>
</tbody>
</table>
<p>Voorbeeld: je maakt <code>IX_Customers_PhoneNumber</code> en draait <code>SELECT PhoneNumber FROM Sales.Customers ORDER BY PhoneNumber</code>. In het plan zie je een <strong>NonClustered Index Scan</strong>: de index wordt van voor naar achter gelezen, die staat al op volgorde, dus er is geen Sort nodig. Het is een <em>scan</em> (geen seek), omdat je alle rijen wilt.</p>`
    },
    {
      title: "Signalen en oplossingen",
      body: `<table>
<thead><tr><th>Wat je ziet</th><th>Wat je overweegt</th></tr></thead>
<tbody>
<tr><td>Een los blok <strong>Sort</strong> met hoge kosten</td><td>Een index maken met de gesorteerde kolom(men) als indexkolom, zodat de data al op volgorde ligt</td></tr>
<tr><td><strong>NonClustered Index Scan/Seek + Key Lookup</strong> in de brontabel</td><td>De overige gebruikte kolommen <strong>INCLUDE</strong>n in die index (covering index)</td></tr>
<tr><td><strong>Clustered Index Scan</strong> op een grote tabel met een selectieve WHERE</td><td>Een nonclustered index op de WHERE-kolom(men)</td></tr>
<tr><td><strong>Estimated rows</strong> wijkt sterk af van <strong>actual rows</strong></td><td>De optimizer kon geen goede inschatting maken op basis van de beschikbare indexes/statistieken, dus het plan is waarschijnlijk niet optimaal. Een index op de juiste kolommen geeft betere statistieken en schattingen</td></tr>
<tr><td>Joins die traag zijn</td><td>Controleer of de <strong>foreign key-kolommen</strong> geïndexeerd zijn (dat gebeurt niet automatisch)</td></tr>
</tbody>
</table>
<pre><code class="sql">-- Probleem: Key Lookup voor Quantity
SELECT InvoiceID, StockItemID, Quantity
FROM   Sales.InvoiceLines
WHERE  StockItemID = 45;

-- Oplossing: Quantity meenemen in de index
CREATE NONCLUSTERED INDEX IX_InvoiceLines_StockItemID
ON Sales.InvoiceLines (StockItemID)
INCLUDE (Quantity);</code></pre>`
    },
    {
      title: "Gesuggereerde indexes: niet klakkeloos overnemen",
      body: `<p>De groene "Missing Index"-suggestie is gemaakt voor <strong>precies deze ene query</strong>. Neem hem niet blind over:</p>
<ul>
<li>Is de index <strong>generiek genoeg</strong> om ook andere queries te helpen? Vaak stelt SQL Server een index voor met een lange INCLUDE-lijst die alleen voor deze query past.</li>
<li>Bestaat er al een vergelijkbare index die je kunt uitbreiden?</li>
<li>Elke extra index maakt INSERT/UPDATE/DELETE iets trager en kost opslag.</li>
</ul>
<p>Of de voorgestelde index clustered of nonclustered is, of hij kolommen include't en op één tabel ligt, is niet het punt (een index ligt altijd op één tabel). Het gaat om <em>herbruikbaarheid</em>.</p>`
    }
  ],
  keyPoints: [
    "Het query execution plan verklaart <strong>waarom</strong> een query traag is; aanzetten met Include Actual Execution Plan.",
    "De pijlen geven de volgorde van de stappen aan; lezen van rechts naar links.",
    "De <strong>dikte</strong> van een pijl = de hoeveelheid data die naar de volgende operatie gaat.",
    "ORDER BY op een kolom met een eigen (niet-PK) index → <strong>NonClustered Index Scan</strong>.",
    "Los <strong>Sort</strong>-blok → overweeg een index op de gesorteerde kolom(men).",
    "NonClustered Index Scan + lookup in de brontabel → <strong>INCLUDE</strong> de gebruikte kolommen in die index.",
    "Estimated vs. actual rows ver uit elkaar → het plan kon niet goed worden ingeschat op basis van de indexes.",
    "Gesuggereerde index? Controleer of hij <strong>generiek genoeg</strong> is.",
    "Beste route naar betere performance: plan analyseren, dan query of indexes aanpassen."
  ],
  pitfalls: [
    { wrong: "Een dikke pijl betekent dat die stap lang duurt.", right: "De dikte staat voor de hoeveelheid data die van de ene naar de volgende operatie gaat." },
    { wrong: "ORDER BY op een geïndexeerde kolom geeft altijd een Index Seek.", right: "Als je alle rijen gesorteerd wilt, leest SQL Server de index helemaal: een NonClustered Index Scan." },
    { wrong: "De gesuggereerde index in groen kun je altijd direct overnemen.", right: "Hij is voor deze ene query gemaakt. Check of hij generiek genoeg is voor andere queries." },
    { wrong: "Een query in een view of stored procedure zetten maakt hem significant sneller.", right: "Het plan blijft hetzelfde. Analyseer het plan en pas query of indexes aan." },
    { wrong: "Een index op álle kolommen in de query is de snelste oplossing.", right: "Te brede indexes zijn duur bij schrijven en vaak te specifiek. Kies de juiste indexkolommen en include alleen wat nodig is." },
    { wrong: "Bij een Key Lookup maak je een tweede clustered index.", right: "Een tabel heeft maar één clustered index. Include de ontbrekende kolommen in de nonclustered index." }
  ],
  flashcards: [
    { front: "Hoe zet je het actual execution plan aan in SSMS?", back: "Include Actual Execution Plan (Ctrl+M), query uitvoeren, tabblad Execution Plan." },
    { front: "Je volgt in een plan de pijlen van rechts naar links. Wat leer je daaruit?", back: "In welke volgorde de operaties draaien en waar hun data heen gaat." },
    { front: "Eén pijl in je plan is opvallend dik. Wat zegt dat, en waar zoek je dan?", back: "Er stromen daar veel rijen. Zoek bij de operator ervoor of een filter of index dat aantal eerder kan verkleinen." },
    { front: "In welke richting lees je een plan?", back: "Van rechts (bronnen) naar links (resultaat)." },
    { front: "ORDER BY op eigen nonclustered index: welke operator?", back: "NonClustered Index Scan." },
    { front: "Je <code>ORDER BY LastEditedWhen</code> veroorzaakt 60% van de kosten in een Sort-operator. Welke indexmaatregel overweeg je?", back: "Een index met LastEditedWhen als indexkolom; dan ligt de data al gesorteerd." },
    { front: "NonClustered Index Scan + zoeken in de brontabel?", back: "Include de gebruikte kolommen in die index." },
    { front: "Estimated rows ≠ actual rows: wat betekent dat?", back: "Het plan kon niet goed worden opgesteld op basis van de beschikbare indexes/statistieken." },
    { front: "Waar let je op bij een gesuggereerde index?", back: "Of hij generiek genoeg is (niet alleen voor deze ene query)." },
    { front: "Wat is een Key Lookup?", back: "Per rij terug naar de clustered index om kolommen op te halen die niet in de nonclustered index zitten." },
    { front: "Waar zie je een ontbrekende index-suggestie?", back: "In groen boven het execution plan (Missing Index)." }
  ],
  quiz: [
    {
      q: "Je hebt zelf een index gemaakt op <code>Sales.Customers(PhoneNumber)</code> (niet de primary key) en voert <code>SELECT PhoneNumber FROM Sales.Customers ORDER BY PhoneNumber</code> uit. Welke operator verwacht je?",
      options: ["Clustered Index Seek", "NonClustered Index Scan", "Clustered Index Scan + Sort", "NonClustered Index Seek"],
      answer: 1,
      explain: "Alle rijen gesorteerd nodig: de nonclustered index wordt van voor naar achter gelezen (scan). Die staat al op volgorde, dus er is geen Sort nodig."
    },
    {
      q: "In een plan is de pijl uit een Clustered Index Scan heel dik en de pijl na het Filter heel dun. Wat leid je daaruit af?",
      options: [
        "De scan was snel, het filter traag",
        "Er worden veel rijen gelezen die het filter weer weggooit; een index op de filterkolom kan helpen",
        "Het filter heeft een fout",
        "De dikte zegt iets over de prioriteit van de operator"
      ],
      answer: 1,
      explain: "De dikte toont de hoeveelheid data die doorstroomt. Veel rijen lezen om ze daarna weg te filteren is een klassiek signaal voor een ontbrekende index."
    },
    {
      q: "Waarom lees je een grafisch execution plan meestal van rechts naar links?",
      options: [
        "Omdat de kosten rechts staan",
        "Omdat de pijlen laten zien hoe de data van de eerste operaties (rechts) naar het resultaat (links) stroomt",
        "Omdat SSMS het plan spiegelt",
        "Omdat de SELECT altijd de duurste stap is"
      ],
      answer: 1,
      explain: "De pijlen geven de volgorde en richting van de dataflow aan: van de bronoperaties rechts naar de SELECT links."
    },
    {
      q: "Het plan van een rapportquery toont een duur, los Sort-blok voor <code>ORDER BY OrderDate</code>. Wat kun je overwegen?",
      options: [
        "Een view maken met ORDER BY OrderDate",
        "De primary key op OrderDate laten sorteren via een hint",
        "De query in een stored procedure zetten",
        "Een index maken met OrderDate als indexkolom"
      ],
      answer: 3,
      explain: "Als de data via een index al gesorteerd beschikbaar is, hoeft SQL Server niet meer apart te sorteren. ORDER BY in een view mag niet eens."
    },
    {
      q: "In het plan zie je een NonClustered Index Seek op IX_Orders_CustomerID, gevolgd door een Key Lookup in de clustered index voor de kolommen OrderDate en ExpectedDeliveryDate. Wat maakt de query het meest waarschijnlijk sneller?",
      options: [
        "OrderDate en ExpectedDeliveryDate includen in IX_Orders_CustomerID",
        "Een tweede clustered index maken op OrderDate",
        "Een nieuwe nonclustered index op alleen CustomerID maken",
        "De kolommen includen in de clustered index"
      ],
      answer: 0,
      explain: "Met INCLUDE staan de kolommen in de index zelf en vervalt de lookup. Een tabel heeft maar één clustered index, en die bevat al alle kolommen."
    },
    {
      q: "Bij een operator staat 'Estimated Number of Rows: 12' en 'Actual Number of Rows: 48.000'. Wat zegt dit?",
      options: [
        "De UPDATE is maar gedeeltelijk uitgevoerd",
        "Er staat een filter in een view",
        "De optimizer kon op basis van de beschikbare indexes geen goede inschatting maken, dus het plan is waarschijnlijk niet optimaal",
        "Een trigger heeft extra rijen toegevoegd"
      ],
      answer: 2,
      explain: "Grote verschillen tussen estimated en actual wijzen op slechte schattingen. Een index op de juiste kolommen (en daarmee betere statistieken) helpt."
    },
    {
      q: "Het plan van één rapportquery stelt een index voor met 2 sleutelkolommen en 9 INCLUDE-kolommen. Wat is de verstandigste reactie?",
      options: [
        "Direct aanmaken: SQL Server weet het het best",
        "Eerst nagaan of andere queries er ook baat bij hebben, en de index anders slanker maken",
        "Niet aanmaken, want indexen met INCLUDE zijn trager",
        "Een clustered index van maken, dan zijn de includes niet nodig"
      ],
      answer: 1,
      explain: "Een suggestie is afgestemd op precies die ene query. Elke index kost ruimte en vertraagt schrijfacties. Kies daarom een index die breder bruikbaar is, en neem niet blind alle includes over."
    },
    {
      q: "Een query is te traag. Wat zet je als eerste in om hem gericht te verbeteren?",
      options: [
        "Het query execution plan, om te zien waar de kosten zitten en welke index of herschrijving helpt",
        "Een stored procedure, want die is gecompileerd",
        "Een view, want daarin is de data al geselecteerd",
        "Een index op alle kolommen die in de query voorkomen"
      ],
      answer: 0,
      explain: "Eerst analyseren, dan gericht ingrijpen. Een view of procedure gebruikt hetzelfde plan, en een index op alles is duur en vaak te specifiek."
    },
    {
      q: "Hoe lees je een grafisch execution plan het handigst?",
      options: [
        "Van links naar rechts, zoals tekst",
        "Van rechts naar links: van de databronnen naar het resultaat",
        "Van boven naar beneden, op volgorde van kosten",
        "In willekeurige volgorde; elke operator staat los"
      ],
      answer: 1,
      explain: "Rechts staan de scans/seeks op tabellen en indexes, links eindigt het plan bij de SELECT."
    },
    {
      q: "Welke operator duidt erop dat SQL Server de hele tabel doorloopt, omdat er geen bruikbare index is voor de WHERE?",
      options: ["Clustered Index Seek", "Key Lookup", "Clustered Index Scan", "Nested Loops"],
      answer: 2,
      explain: "Een Clustered Index Scan leest de tabel helemaal. Met een passende nonclustered index wordt dat vaak een seek."
    },
    {
      q: "<code>SELECT * FROM Sales.Orders WHERE OrderID = 5012</code>. OrderID is de primary key (clustered). Welke operator verwacht je?",
      options: ["Clustered Index Seek", "Clustered Index Scan", "NonClustered Index Scan", "Sort"],
      answer: 0,
      explain: "Zoeken op één specifieke waarde van de clustering key gaat via de boom direct naar de rij: een seek."
    },
    {
      q: "Een join tussen Sales.Invoices en Sales.Customers op CustomerID is traag en het plan toont een scan op Invoices. Wat is een logische oorzaak?",
      options: [
        "De primary key van Customers is niet geïndexeerd",
        "De join-kolom is nullable",
        "Customers heeft te veel kolommen",
        "De foreign key-kolom Invoices.CustomerID heeft geen index"
      ],
      answer: 3,
      explain: "Foreign keys worden niet automatisch geïndexeerd. Een primary key heeft altijd al een index."
    }
  ]
});
