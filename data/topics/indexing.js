DB3.registerTopic({
  id: "indexing",
  intro: "Een index is een gesorteerde opzoekstructuur die SQL Server in een paar stappen bij de juiste rij brengt, in plaats van de hele tabel door te lopen. Je leert het verschil tussen clustered en nonclustered, wat INCLUDE doet en wanneer een index helpt of juist in de weg zit.",
  sections: [
    {
      title: "Clustered index: de tabel zelf",
      body: `<p>Een index is een <strong>lookup-structuur naar het record</strong>, opgebouwd als een gebalanceerde boom (B-tree). In een paar sprongen ben je bij de juiste rij in plaats van miljoenen rijen te lezen.</p>
<p>De <strong>clustered index</strong> is bijzonder: dat is <em>de tabel zelf</em>. De rijen staan fysiek gesorteerd op de sleutel van de clustered index, standaard de <strong>primary key</strong>. De volgorde is dus niet "willekeurig" of "op volgorde van aanmaken", maar op de waarde van de primary key-kolom(men).</p>
<ul>
<li>Een tabel heeft <strong>precies één</strong> clustered index (de data kan maar op één manier fysiek gesorteerd zijn).</li>
<li>De clustered index bevat <strong>alle kolommen</strong> van de rij.</li>
</ul>
<pre><code class="sql">CREATE TABLE Sales.Klant (
    KlantID INT NOT NULL CONSTRAINT PK_Klant PRIMARY KEY CLUSTERED,
    Naam    NVARCHAR(100) NOT NULL,
    Plaats  NVARCHAR(50)  NULL
);  -- rijen staan gesorteerd op KlantID</code></pre>`
    },
    {
      title: "Nonclustered indexes en INCLUDE",
      body: `<p>Naast de clustered index kan een tabel <strong>0 tot veel nonclustered indexes</strong> hebben. Een nonclustered index is een aparte, gesorteerde structuur met:</p>
<ul>
<li>de <strong>indexkolommen</strong> (zoekbaar en gesorteerd; dat mogen er meerdere zijn);</li>
<li>een <strong>verwijzing</strong> naar de rij in de clustered index;</li>
<li>optioneel <strong>included kolommen</strong>: extra kolommen die in de index worden opgeslagen, maar <em>niet</em> zoekbaar of gesorteerd zijn.</li>
</ul>
<pre><code class="sql">CREATE NONCLUSTERED INDEX IX_InvoiceLines_InvoiceID_StockItemID
ON Sales.InvoiceLines (InvoiceID, StockItemID)   -- indexkolommen
INCLUDE (Quantity);                              -- meegenomen kolom</code></pre>
<p>Waarom INCLUDE? Als een query alleen <code>InvoiceID</code>, <code>StockItemID</code> en <code>Quantity</code> nodig heeft, staat alles al in de index. Er is dan <strong>geen extra lookup naar de clustered index</strong> nodig (een <em>covering index</em>).</p>
<p>Selecteer je een kolom die niet in de index zit (niet als indexkolom en niet included), dan krijg je geen fout en geen NULL. SQL Server haalt die waarde per rij alsnog uit de <strong>clustered index</strong> op (Key Lookup). Dat werkt, maar is trager.</p>
<div class="callout tip"><strong>Onthoud</strong> Indexkolom = om op te <em>zoeken en sorteren</em>. INCLUDE = om <em>mee te nemen</em>, zodat de clustered index niet benaderd hoeft te worden. INCLUDE filtert geen rijen en bepaalt geen sorteervolgorde.</div>`
    },
    {
      title: "Seek of scan?",
      body: `<table>
<thead><tr><th>Query</th><th>Verwacht</th><th>Waarom</th></tr></thead>
<tbody>
<tr><td><code>WHERE CustomerName = 'Tailspin Toys'</code></td><td><strong>Seek</strong></td><td>Specifieke waarde: via de boom direct naar de plek</td></tr>
<tr><td><code>WHERE OrderDate &gt; '2016-01-01'</code></td><td><strong>Scan</strong> (of range seek + scan)</td><td>Een reeks waarden: de index wordt vanaf een punt doorgelopen</td></tr>
<tr><td><code>ORDER BY CustomerName</code></td><td><strong>Index scan</strong></td><td>Alle rijen in volgorde: de gesorteerde index wordt doorgelopen</td></tr>
<tr><td><code>WHERE LEFT(CustomerName, 3) = 'Tai'</code></td><td>Scan</td><td>Een functie op de kolom maakt zoeken in de boom onmogelijk</td></tr>
</tbody>
</table>
<p>Het aantal geselecteerde kolommen bepaalt niet of het een seek of scan wordt, en je kunt SQL Server ook niet zomaar "laten scannen". <strong>SQL Server kiest zelf</strong> welke index hij gebruikt.</p>`
    },
    {
      title: "Wat gebeurt er bij schrijven?",
      body: `<p>Indexes zijn geen losse kopieën die "af en toe" bijgewerkt worden. Wijzig je een waarde, dan werkt SQL Server direct <strong>elke index</strong> bij waarin die kolom voorkomt, <strong>als indexkolom óf als included kolom</strong>.</p>
<pre><code class="sql">UPDATE Sales.InvoiceLines SET Quantity = 12 WHERE InvoiceLineID = 7;
-- clustered index (bevat alles) + IX_InvoiceLines_InvoiceID_StockItemID (include Quantity) worden bijgewerkt</code></pre>
<p>Daarom: <strong>elke index maakt INSERT, UPDATE en DELETE iets trager</strong> en kost opslag. Maak niet voor elke query een eigen index.</p>
<p>Verdere regels:</p>
<ul>
<li>Een index hoort bij <strong>één tabel</strong>; een index over meerdere tabellen bestaat niet.</li>
<li>Een index mag <strong>meerdere indexkolommen</strong> en <strong>meerdere included kolommen</strong> hebben.</li>
<li>Dezelfde kolom mag in <strong>meerdere indexes</strong> voorkomen.</li>
</ul>`
    },
    {
      title: "Praktische vuistregels",
      body: `<ul>
<li><strong>Foreign keys zijn niet automatisch geïndexeerd!</strong> Trage joins? Kijk eerst of de FK-kolom een index heeft. (De primary key aan de andere kant heeft er altijd al een.)</li>
<li>Bekijk wat je <strong>veel</strong> gebruikt (WHERE, JOIN, ORDER BY) en index daarop.</li>
<li><strong>Include</strong> de kolommen die je vaak selecteert, om lookups te voorkomen.</li>
<li>Maak indexes <strong>niet te specifiek</strong> voor één query; SQL Server kiest zelf welke hij gebruikt.</li>
<li>Wijken in het execution plan de <strong>estimated en actual rows</strong> ver uit elkaar? Een index op de juiste kolommen geeft SQL Server betere statistieken en dus betere schattingen.</li>
</ul>
<pre><code class="sql">-- Klassieke winst: FK-kolom indexeren
CREATE NONCLUSTERED INDEX IX_Invoices_CustomerID
ON Sales.Invoices (CustomerID);</code></pre>
<div class="callout tip"><strong>Extra</strong> Naast row-based indexes bestaan ook <em>columnstore</em> indexes, die per kolom opslaan en sterk zijn bij grote analytische queries (aggregaties over miljoenen rijen).</div>`
    }
  ],
  keyPoints: [
    "Een tabel heeft <strong>precies één clustered index</strong> en <strong>0 tot veel nonclustered indexes</strong>.",
    "De clustered index ís de tabel: rijen staan gesorteerd op de primary key.",
    "Een nonclustered index bevat indexkolommen + een verwijzing naar de clustered index.",
    "<code>INCLUDE</code> neemt extra kolommen op in de index, zodat de clustered index niet benaderd hoeft te worden.",
    "Kolom geselecteerd die niet in de gebruikte index zit → waarde wordt uit de clustered index gehaald (lookup).",
    "Een waarde wijzigen = bijwerken in alle indexes die die kolom als indexkolom of include hebben.",
    "Zoeken op één waarde → seek. Range (&lt;, &gt;) of sorteren → scan.",
    "Een index hoort bij één tabel; meerdere tabellen in één index kan niet.",
    "Foreign keys worden niet automatisch geïndexeerd: een veelvoorkomende oorzaak van trage joins.",
    "Elke index vertraagt schrijven iets: maak ze niet te specifiek en niet te veel."
  ],
  pitfalls: [
    { wrong: "De rijen in een clustered index staan op volgorde van aanmaken.", right: "Ze staan gesorteerd op de sleutel van de clustered index, standaard de primary key." },
    { wrong: "Een tabel kan meerdere clustered indexes hebben.", right: "Precies één: de data kan maar op één manier fysiek gesorteerd zijn." },
    { wrong: "INCLUDE bepaalt de tweede sorteervolgorde van de index.", right: "Included kolommen zijn niet gesorteerd of zoekbaar; ze worden alleen meegenomen om lookups te voorkomen." },
    { wrong: "Selecteer je een kolom die niet in de index staat, dan krijg je NULL of een fout.", right: "SQL Server haalt de waarde gewoon uit de clustered index op, met een extra lookup." },
    { wrong: "Indexes worden op gezette tijden bijgewerkt.", right: "Bij elke wijziging worden alle indexes waarin de kolom voorkomt direct bijgewerkt." },
    { wrong: "Een foreign key krijgt automatisch een index.", right: "Alleen primary keys en unique constraints krijgen er automatisch een. FK-kolommen moet je zelf indexeren." }
  ],
  flashcards: [
    { front: "Een collega wil Sales.Orders zowel op OrderDate als op CustomerID clusteren. Waarom lukt dat niet, en wat doe je wel?", back: "De rijen kunnen fysiek maar op één manier gesorteerd liggen, dus er is één clustered index. Voor de andere kolom maak je een nonclustered index (daarvan mag je er veel hebben)." },
    { front: "Sales.Orders heeft een primary key op OrderID en verder geen clustered index-keuze. Hoe liggen de rijen opgeslagen?", back: "Gesorteerd op OrderID: de primary key wordt standaard de clustering key." },
    { front: "Wat bevat een nonclustered index?", back: "De indexkolommen, eventuele included kolommen en een verwijzing naar de clustered index." },
    { front: "Een query zoekt op CustomerID en toont ook OrderDate. Wat voeg je toe aan <code>IX_Orders_CustomerID</code> om lookups te vermijden?", back: "<code>INCLUDE (OrderDate)</code>: dan staat die waarde in de index zelf." },
    { front: "Je ziet in het plan naast een Index Seek ook een Key Lookup. Wat vertelt dat?", back: "De index mist een kolom die je selecteert; per rij wordt die nog uit de clustered index gehaald." },
    { front: "Wat gebeurt er met indexes als je een waarde wijzigt?", back: "Alle indexes waarin de kolom als indexkolom of include voorkomt worden direct bijgewerkt." },
    { front: "<code>WHERE OrderDate &gt; '2016-01-01'</code> op een index op OrderDate: seek of scan, en waarom?", back: "Een (range)scan: SQL Server loopt een aaneengesloten stuk van de index af. Dat geldt ook bij sorteren op de indexkolom." },
    { front: "Wanneer verwacht je een index seek?", back: "Bij zoeken op een specifieke waarde." },
    { front: "Kun je één index maken op Orders.OrderDate én Customers.CustomerName samen?", back: "Nee. Een gewone index hoort bij precies één tabel." },
    { front: "Trage join, mogelijke oorzaak?", back: "De foreign key-kolom is niet geïndexeerd." },
    { front: "Nadeel van veel indexes", back: "INSERT/UPDATE/DELETE worden trager en het kost opslag." },
    { front: "Het plan schat 12 rijen en krijgt er 80.000. Welke indexmaatregel helpt de optimizer beter te schatten?", back: "Een index op de gefilterde/gejoinde kolommen. Daarmee komen er ook statistieken bij, dus een betere schatting." }
  ],
  quiz: [
    {
      q: "Een collega stelt voor: 'We maken een tweede clustered index op OrderDate, naast die op OrderID.' Wat antwoord je?",
      options: [
        "Prima, zolang de namen verschillen",
        "Kan niet: de rijen liggen maar in één volgorde; maak een nonclustered index op OrderDate",
        "Kan alleen als OrderDate uniek is",
        "Kan, maar dan vervalt de primary key"
      ],
      answer: 1,
      explain: "Er is precies één clustered index per tabel, omdat die de fysieke volgorde van de rijen is. Nonclustered indexes mag je er zoveel bij maken als zinvol is."
    },
    {
      q: "Een tabel heeft primary key <code>ProductCode</code> (clustered). In welke volgorde liggen de rijen opgeslagen?",
      options: [
        "Op volgorde van ProductCode",
        "Op volgorde van invoegen",
        "Op volgorde van de eerste kolom in de tabeldefinitie",
        "Willekeurig, afhankelijk van vrije ruimte op schijf"
      ],
      answer: 0,
      explain: "De clustered index sorteert de rijen fysiek op de clustering key, hier de primary key ProductCode."
    },
    {
      q: "Je maakt <code>CREATE INDEX IX_Orders_CustomerID ON Sales.Orders (CustomerID) INCLUDE (OrderDate)</code>. Wat is het effect van de INCLUDE?",
      options: [
        "Orders worden binnen een klant gesorteerd op OrderDate",
        "Alleen orders met een OrderDate komen in de index",
        "De index wordt afhankelijk van een andere index op OrderDate",
        "OrderDate staat in de index, zodat queries die het nodig hebben niet naar de clustered index hoeven"
      ],
      answer: 3,
      explain: "INCLUDE neemt de kolom mee in de index zonder hem zoekbaar of gesorteerd te maken. Zo vermijd je een Key Lookup."
    },
    {
      q: "Een query gebruikt IX_Orders_CustomerID (zonder includes) maar selecteert ook <code>Comments</code>. Wat gebeurt er met die kolom?",
      options: [
        "Je krijgt een foutmelding",
        "De waarde wordt per rij uit de clustered index opgehaald",
        "Comments wordt als NULL teruggegeven",
        "Je krijgt een waarschuwing en de index wordt genegeerd"
      ],
      answer: 1,
      explain: "SQL Server zoekt via de verwijzing in de nonclustered index de rij op in de clustered index (Key Lookup)."
    },
    {
      q: "Je past de <code>Quantity</code> van een orderregel aan. Quantity staat als included kolom in een nonclustered index. Wat gebeurt er met die index?",
      options: [
        "Niets; alleen indexes waarin Quantity een indexkolom is worden bijgewerkt",
        "De update wordt geweigerd omdat de kolom in een index zit",
        "De index wordt direct bijgewerkt, net als de clustered index",
        "De index wordt bij de volgende onderhoudsjob bijgewerkt"
      ],
      answer: 2,
      explain: "Elke index waarin de kolom voorkomt, als indexkolom of include, wordt direct mee bijgewerkt."
    },
    {
      q: "Welke van deze indexen kun je NIET aanmaken?",
      options: [
        "<code>ON Sales.Orders (CustomerID, OrderDate)</code>",
        "<code>ON Sales.Orders (CustomerID) INCLUDE (Comments, PickedByPersonID)</code>",
        "<code>ON Sales.Orders (CustomerID, Sales.Customers.CustomerName)</code>",
        "Een tweede index die ook CustomerID bevat"
      ],
      answer: 2,
      explain: "Een index hoort bij één tabel, dus kolommen uit Customers kunnen niet in een index op Orders. Samengestelde indexen, INCLUDE en overlap met andere indexen mogen allemaal."
    },
    {
      q: "Bij welke query verwacht je eerder een index <strong>scan</strong> dan een seek (er is een index op OrderDate)?",
      options: [
        "<code>WHERE OrderDate = '2016-05-01'</code>",
        "<code>WHERE OrderID = 12</code>",
        "Een query die maar twee kolommen selecteert",
        "<code>WHERE OrderDate &gt; '2016-01-01' ORDER BY OrderDate</code>"
      ],
      answer: 3,
      explain: "Een range of een sortering op de indexkolom laat SQL Server de index doorlopen. Een specifieke waarde geeft een seek."
    },
    {
      q: "Een join tussen <code>Sales.OrderLines</code> en <code>Sales.Orders</code> op OrderID is erg traag. Wat is de meest waarschijnlijke oorzaak?",
      options: [
        "Orders.OrderID (de primary key) heeft geen index",
        "De foreign key-kolom OrderLines.OrderID heeft geen index",
        "De join-kolom is niet uniek in OrderLines",
        "De join-kolom is nullable"
      ],
      answer: 1,
      explain: "Foreign keys worden niet automatisch geïndexeerd; primary keys wel. Niet-uniek is bij een FK normaal."
    },
    {
      q: "Een query filtert op <code>Sales.Invoices.ConfirmedDeliveryTime</code>. Het plan verwacht 15 rijen, er komen er 90.000. Wat is de meest gerichte stap?",
      options: [
        "Een index op ConfirmedDeliveryTime, zodat de optimizer statistieken heeft en beter schat",
        "De query in een view zetten",
        "De query in een stored procedure zetten",
        "De kolom omzetten naar varchar"
      ],
      answer: 0,
      explain: "Een grote afwijking wijst op slechte of ontbrekende statistieken. Met een index op de gefilterde kolom komen die er en kiest de optimizer een beter plan. View en procedure veranderen de schatting niet."
    },
    {
      q: "Waarom moet je niet voor elke query een eigen, zeer specifieke index aanmaken?",
      options: [
        "SQL Server gebruikt nooit meer dan één index per database",
        "Indexes maken SELECT-queries trager",
        "Elke index maakt schrijfacties trager en SQL Server kiest zelf welke index hij gebruikt",
        "Een tabel mag maximaal drie indexes hebben"
      ],
      answer: 2,
      explain: "Elke INSERT/UPDATE/DELETE moet alle relevante indexes bijwerken. Brede, herbruikbare indexes zijn meestal beter."
    },
    {
      q: "Wat is het doel van de INCLUDE-clausule in een index?",
      options: [
        "Aangeven welke rijen in de index komen, zodat hij kleiner wordt",
        "Aangeven op welke andere index deze voortbouwt",
        "Aangeven of de index oplopend of aflopend gesorteerd is",
        "Extra kolommen meenemen zodat de clustered index daarvoor niet benaderd hoeft te worden"
      ],
      answer: 3,
      explain: "Rijen filteren doe je met een filtered index (WHERE), sorteerrichting met ASC/DESC. INCLUDE voegt alleen kolommen toe aan het blad van de index."
    },
    {
      q: "Wat zit er in een nonclustered index, naast de indexkolommen?",
      options: [
        "Alle kolommen van de tabel",
        "Een verwijzing naar de rij in de clustered index (plus eventuele included kolommen)",
        "Een kopie van de hele tabel, gesorteerd op een andere kolom",
        "Alleen het aantal rijen per waarde"
      ],
      answer: 1,
      explain: "De nonclustered index wijst via de clustering key naar de volledige rij. Alleen de clustered index bevat alle kolommen."
    }
  ]
});
