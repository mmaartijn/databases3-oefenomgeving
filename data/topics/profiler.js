DB3.registerTopic({
  id: "profiler",
  intro: "Met SQL Server Profiler kijk je live mee welke queries er écht op je database worden uitgevoerd, door wie en hoe lang ze duren. Onmisbaar om te ontdekken wat een ORM als Entity Framework achter je rug om naar de server stuurt.",
  sections: [
    {
      title: "Wat is SQL Server Profiler?",
      body: `<p><strong>SQL Server Profiler</strong> is een monitoringtool die alle activiteit op een SQL Server-instance vastlegt: verbindingen die worden geopend en gesloten, queries die binnenkomen, stored procedures die worden aangeroepen, enzovoort. Zo'n opname heet een <em>trace</em>.</p>
<p>Je opent hem in SSMS via <strong>Tools &gt; SQL Server Profiler</strong>, verbindt met je server en start een nieuwe trace. Vanaf dat moment verschijnt elke gebeurtenis (event) als een regel in het venster.</p>
<p>Per regel zie je kolommen zoals:</p>
<table>
<thead><tr><th>Kolom</th><th>Wat zie je?</th></tr></thead>
<tbody>
<tr><td><code>EventClass</code></td><td>Soort gebeurtenis, bv. <code>SQL:BatchCompleted</code></td></tr>
<tr><td><code>TextData</code></td><td>De volledige SQL-tekst die is uitgevoerd</td></tr>
<tr><td><code>LoginName</code> / <code>ApplicationName</code></td><td>Wie (welke login/applicatie) de query stuurde</td></tr>
<tr><td><code>Duration</code>, <code>CPU</code>, <code>Reads</code>, <code>Writes</code></td><td>Hoe lang en hoe zwaar de query was</td></tr>
<tr><td><code>StartTime</code> / <code>EndTime</code></td><td>Wanneer het gebeurde</td></tr>
</tbody>
</table>
<div class="callout tip"><strong>Tip</strong> Profiler is dé manier om te zien welke queries er op je database draaien. Er bestaat geen magische systeemtabel of stored procedure in de cursus die je dat overzicht zomaar geeft; je start gewoon een trace.</div>`
    },
    {
      title: "Events: waarom je filtert op BatchCompleted",
      body: `<p>Een standaardtrace toont <em>alle</em> events: logins, logouts, het begin én het einde van elke batch, RPC-aanroepen… Dat wordt snel onoverzichtelijk. Een handige instelling is om op het tabblad <strong>Events Selection</strong> alleen <code>SQL:BatchCompleted</code> (en eventueel <code>RPC:Completed</code>, want Entity Framework stuurt geparameteriseerde queries vaak als RPC via <code>sp_executesql</code>) aan te vinken.</p>
<ul>
<li><code>SQL:BatchStarting</code> — de batch begint (nog geen duur bekend).</li>
<li><code>SQL:BatchCompleted</code> — verschijnt <strong>zodra een query/batch klaar is met uitvoeren</strong>. Pas dan kent Profiler de <code>Duration</code>, <code>CPU</code> en <code>Reads</code>.</li>
</ul>
<p>Een <em>batch</em> is hier gewoon het stuk SQL dat de client in één keer naar de server stuurt — dus niet "een groepje records" en ook niet "een verzameling die Profiler ophaalt".</p>
<div class="callout exam"><strong>Toetstip</strong> Het woord "batch" verwijst naar de SQL-opdracht die de client verstuurt. Het Completed-event komt binnen op het moment dat die opdracht is afgerond — niet als de trace stopt.</div>`
    },
    {
      title: "Wat Profiler wél en níet laat zien",
      body: `<p>Profiler vertelt je <strong>wát</strong> er gebeurde: welke query, van wie, hoe lang, hoeveel reads. Wat hij je <strong>niet</strong> vertelt, is <strong>hoe</strong> SQL Server die query intern heeft uitgevoerd: welke indexen er zijn gebruikt, of er een scan of seek was, welke join-methode is gekozen. Daarvoor heb je het <strong>query execution plan</strong> nodig.</p>
<table>
<thead><tr><th>Vraag</th><th>Profiler</th><th>Query execution plan</th></tr></thead>
<tbody>
<tr><td>Welke queries zijn uitgevoerd?</td><td>Ja</td><td>Nee (alleen de query die jij uitvoert)</td></tr>
<tr><td>Wie voerde de query uit?</td><td>Ja</td><td>Nee</td></tr>
<tr><td>Hoe lang duurde het?</td><td>Ja</td><td>Indirect (kosten/tijd per operator)</td></tr>
<tr><td>Welke index is gebruikt? Seek of scan?</td><td><strong>Nee</strong></td><td>Ja</td></tr>
<tr><td>Ontbrekende index-suggestie (groen)</td><td>Nee</td><td>Ja</td></tr>
</tbody>
</table>
<p>De relatie is dus: <strong>Profiler laat zien wélke queries draaien en hoe ze presteren; het execution plan geeft de verklaring wáárom ze zo presteren.</strong></p>
<p>Profiler is ook géén beheertool: je stelt er geen rechten/rollen mee in, geen back-ups, geen triggers en geen Full-Text-taalinstellingen.</p>`
    },
    {
      title: "Entity Framework en het N+1-probleem",
      body: `<p>Met Entity Framework (EF) schrijf je LINQ in C#, en EF vertaalt dat naar SQL. Handig, maar je ziet in je code niet <em>hoeveel</em> queries er daadwerkelijk naar de database gaan. Dat is het grote performancerisico van LINQ: één onschuldig ogende regel kan honderden queries veroorzaken.</p>
<p>Klassiek voorbeeld (lazy loading) in een webshop:</p>
<pre><code>var orders = context.Orders.ToList();          // 1 query
foreach (var o in orders)
{
    Console.WriteLine(o.Customer.CustomerName); // per order nóg een query!
}</code></pre>
<p>In Profiler zie je dan één <code>SELECT ... FROM Sales.Orders</code> gevolgd door een lange rij vrijwel identieke <code>SELECT ... FROM Sales.Customers WHERE CustomerID = @p0</code>. Dat heet het <strong>N+1-probleem</strong>: 1 query voor de lijst + N queries voor de gerelateerde data. Elke query heeft eigen netwerk- en verwerkingsoverhead.</p>
<div class="callout warn"><strong>Let op</strong> Async maken, de LINQ-query opknippen of caching aanzetten lost het fundamentele probleem niet op: het aantal round-trips blijft (of wordt zelfs groter).</div>`
    },
    {
      title: "De oplossing: Include (eager loading)",
      body: `<p>Met <code>.Include()</code> vertel je EF dat de gerelateerde (via een foreign key gekoppelde) data <strong>meteen</strong> mee moet komen. EF genereert dan één query met een <code>JOIN</code>:</p>
<pre><code>var orders = context.Orders
    .Include(o =&gt; o.Customer)
    .ToList();                                  // 1 query met JOIN</code></pre>
<p>De SQL die je dan in Profiler terugziet, lijkt op:</p>
<pre><code class="sql">SELECT o.OrderID, o.OrderDate, c.CustomerID, c.CustomerName
FROM Sales.Orders AS o
INNER JOIN Sales.Customers AS c
    ON c.CustomerID = o.CustomerID;</code></pre>
<p><code>Include</code> is dus géén index-hint, geen logging-optie en heeft niets met historische (temporal) data te maken: het zorgt alleen dat referentiële data via een join in dezelfde SQL-query wordt opgehaald.</p>
<div class="callout exam"><strong>Toetstip</strong> Zie je in de trace na één LINQ-statement een waterval van bijna dezelfde SELECTs? Denk direct aan <code>Include</code>.</div>`
    },
    {
      title: "Workflow: van Profiler naar execution plan",
      body: `<p>Een query die EF genereert kun je niet direct "met een plan" uitvoeren vanuit je applicatie. De werkwijze uit de cursus:</p>
<ol>
<li>Start een trace in Profiler (filter op <code>SQL:BatchCompleted</code> / <code>RPC:Completed</code>).</li>
<li>Gebruik de applicatie zodat de trage actie wordt uitgevoerd.</li>
<li>Zoek de verdachte query op (hoge <code>Duration</code> of <code>Reads</code>, of juist heel veel herhalingen).</li>
<li>Selecteer de regel en kopieer de SQL uit <code>TextData</code>.</li>
<li>Plak die in een queryvenster in SSMS, zet <strong>Include Actual Execution Plan</strong> aan en voer de query uit.</li>
<li>Analyseer het plan (scans, key lookups, suggesties) en verbeter de query of leg een index aan.</li>
</ol>
<p>Monitoren met Profiler levert twee soorten verbeterpunten op: <strong>complexe/trage queries</strong> (aanpakken met indexen of stored procedures) en <strong>heel veel queries</strong> (vereenvoudigen, bv. met <code>Include</code>).</p>`
    }
  ],
  keyPoints: [
    "Profiler (<strong>Tools &gt; SQL Server Profiler</strong>) legt alle queries en verbindingen op een server vast in een trace.",
    "Je ziet per query: de SQL-tekst, wie hem uitvoerde (login/applicatie), duur, CPU en reads.",
    "Je ziet in Profiler <strong>niet</strong> welke indexen zijn gebruikt — daarvoor heb je het query execution plan nodig.",
    "<code>SQL:BatchCompleted</code> verschijnt zodra een query (batch) klaar is met uitvoeren; filter hierop voor een overzichtelijke trace.",
    "Profiler = <em>wélke</em> queries en hoe snel; execution plan = <em>waarom</em> zo snel/traag.",
    "Risico van LINQ/EF: je ziet niet hoeveel queries er naar de database gaan (N+1-probleem).",
    "Veel bijna gelijke SELECTs na één LINQ-statement → gebruik <code>.Include()</code> (eager loading met een JOIN).",
    "EF-query analyseren: in Profiler de query selecteren/kopiëren, in SSMS uitvoeren met het actual execution plan aan.",
    "Profiler is een monitoringtool, geen beheertool voor rechten, back-ups of triggers."
  ],
  pitfalls: [
    { wrong: "In Profiler kan ik zien welke index een query gebruikte.", right: "Profiler toont alleen de query, wie, duur en reads. Indexgebruik (seek/scan) zie je in het query execution plan." },
    { wrong: "Het BatchCompleted-event betekent dat een groep records van een UPDATE verwerkt is.", right: "Een batch is de SQL die de client in één keer verstuurt; het event verschijnt zodra die query klaar is met uitvoeren." },
    { wrong: "Als EF heel veel queries stuurt, maak ik de LINQ async of zet ik caching aan.", right: "Het aantal round-trips is het probleem. Met <code>.Include()</code> haal je gerelateerde data in één JOIN-query op." },
    { wrong: "<code>Include</code> in LINQ is een hint welke index SQL Server moet gebruiken.", right: "<code>Include</code> zorgt dat gerelateerde (foreign-key) data meteen via een JOIN wordt meegeladen. Met indexen heeft het niets te maken." },
    { wrong: "Het vertalen van LINQ naar SQL is het trage deel van Entity Framework.", right: "Het echte risico is dat je niet ziet <em>hoeveel</em> queries er naar de database gaan; veel kleine queries kosten veel tijd." },
    { wrong: "Om het plan van een EF-query te zien zet ik 'execution plan' aan en draai ik de applicatie opnieuw.", right: "Het plan geldt voor queries in je SSMS-venster. Kopieer de query uit Profiler, voer hem in SSMS uit met Include Actual Execution Plan." },
    { wrong: "Met Profiler beheer je gebruikersrechten en back-ups.", right: "Profiler is puur voor monitoren: welke queries draaien er en hoe lang duren ze." }
  ],
  flashcards: [
    { front: "Waar open je SQL Server Profiler?", back: "In SSMS via <strong>Tools &gt; SQL Server Profiler</strong>, daarna verbinden en een trace starten." },
    { front: "Wat is een trace?", back: "Een opname van de events (queries, verbindingen…) die Profiler op de server registreert." },
    { front: "Wanneer verschijnt <code>SQL:BatchCompleted</code>?", back: "Zodra een query/batch klaar is met uitvoeren — dan zijn duur, CPU en reads bekend." },
    { front: "Waarom filter je vaak alleen op BatchCompleted?", back: "Om alleen de uitgevoerde queries te zien in plaats van álle events (logins, starts, enz.)." },
    { front: "Vier dingen die je wél in Profiler ziet", back: "De SQL-tekst, wie (login/applicatie), duur, en CPU/reads/writes." },
    { front: "Wat zie je níet in Profiler?", back: "Welke indexen gebruikt zijn en hoe de query intern is uitgevoerd → query execution plan." },
    { front: "Rolverdeling: welk hulpmiddel vertelt je <em>wélke</em> query traag is, en welk <em>waarom</em>?", back: "Profiler: welke queries draaien en hoe lang ze duren. Execution plan: hoe één query wordt uitgevoerd en waar de kosten zitten." },
    { front: "Wat is het N+1-probleem?", back: "1 query voor een lijst + per rij nog een query voor gerelateerde data; zichtbaar als een waterval gelijke SELECTs." },
    { front: "Een pagina met 50 orders doet in Profiler 51 queries. Waarom zag de developer dat niet in de C#-code?", back: "LINQ verbergt de SQL: lazy loading stuurt per order een extra query zonder dat het in de code opvalt." },
    { front: "Wat doet <code>.Include()</code> in LINQ?", back: "Laadt gerelateerde data (via foreign keys) direct mee met een JOIN in dezelfde SQL-query (eager loading)." },
    { front: "Hoe analyseer je het plan van een EF-query?", back: "Query in Profiler opzoeken, SQL kopiëren, in SSMS uitvoeren met <em>Include Actual Execution Plan</em>." },
    { front: "Welke twee soorten problemen vind je met Profiler?", back: "Trage/complexe queries (→ index, stored procedure) en heel veel queries (→ vereenvoudigen, Include)." },
    { front: "Waarom zie je EF-queries soms als <code>RPC:Completed</code>?", back: "EF stuurt geparameteriseerde queries via <code>sp_executesql</code>, wat als RPC-aanroep binnenkomt." },
    { front: "Waarom is Profiler handig bij Entity Framework?", back: "EF kan erg inefficiënte (of erg veel) queries genereren; Profiler maakt zichtbaar wat er echt gebeurt." }
  ],
  quiz: [
    {
      q: "Een collega wil weten welke SQL-statements de nieuwe ledenadministratie van een sportclub naar de database stuurt. Welk hulpmiddel past hier het best bij?",
      options: ["Het estimated execution plan van een willekeurige query", "SQL Server Profiler met een lopende trace", "De Activity-tab van de Full-Text catalog", "Een DDL-trigger op de database"],
      answer: 1,
      explain: "Profiler legt alle binnenkomende queries vast, inclusief de SQL-tekst. Een execution plan toont alleen hoe één query die jij zelf uitvoert verwerkt wordt, niet wat een applicatie allemaal verstuurt."
    },
    {
      q: "Welke informatie kun je uit een Profiler-trace <strong>niet</strong> halen?",
      options: ["Met welke login een statement werd uitgevoerd", "Hoeveel milliseconden een statement duurde", "Of de optimizer een index seek of index scan gebruikte", "De letterlijke SQL-tekst van een statement"],
      answer: 2,
      explain: "Seek/scan en indexgebruik zijn interne uitvoeringsdetails die je alleen in het query execution plan ziet. Login, duur en tekst staan juist wél als kolommen in de trace."
    },
    {
      q: "Je hebt in Profiler alleen het event <code>SQL:BatchCompleted</code> aangevinkt. Op welk moment verschijnt er een nieuwe regel?",
      options: ["Als een SQL-opdracht van een client volledig is uitgevoerd", "Elke keer dat 1000 rijen van een UPDATE verwerkt zijn", "Wanneer Profiler zijn buffer met events naar het scherm schrijft", "Als je de trace pauzeert of stopt"],
      answer: 0,
      explain: "BatchCompleted wordt gegenereerd zodra de batch (de SQL die de client in één keer stuurde) klaar is. 'Batch' slaat niet op een groepje records."
    },
    {
      q: "Een pagina in een bibliotheekapp toont 50 boeken met hun auteur. In Profiler zie je 1 SELECT op <code>Books</code> en daarna 50 vrijwel identieke SELECTs op <code>Authors</code>. Wat is de beste aanpassing in de LINQ-code?",
      code: "var books = context.Books.ToList();\nforeach (var b in books) Console.WriteLine(b.Author.Name);",
      options: ["De query omzetten naar <code>ToListAsync()</code>", "De query splitsen in twee aparte LINQ-statements", "Second-level caching inschakelen in EF", "<code>.Include(b =&gt; b.Author)</code> toevoegen"],
      answer: 3,
      explain: "Met Include laadt EF de auteurs direct mee via een JOIN: één query in plaats van 51. Async maakt de code niet-blokkerend, maar het aantal queries blijft gelijk."
    },
    {
      q: "Wat doet <code>.Include(o =&gt; o.Customer)</code> in een Entity Framework-query?",
      options: ["Het dwingt SQL Server de index op CustomerID te gebruiken", "Het haalt de gekoppelde klantgegevens via een JOIN in dezelfde SQL-query op", "Het voegt de historische versies van de klant uit de temporal table toe", "Het schrijft de gegenereerde SQL naar de applicatielog"],
      answer: 1,
      explain: "Include = eager loading van referentiële (foreign key) data via een JOIN. Het is geen index-hint en heeft niets met temporal tables of logging te maken."
    },
    {
      q: "Waarom wordt Entity Framework met LINQ vaak als performancerisico genoemd?",
      options: ["Omdat je in je C#-code niet ziet hoeveel queries er daadwerkelijk naar de server gaan", "Omdat het parsen van een LINQ-expressie langer duurt dan de query zelf", "Omdat EF geen WHERE-clausules naar SQL kan vertalen", "Omdat EF iedere query eerst omzet naar een stored procedure"],
      answer: 0,
      explain: "Het verborgen aantal round-trips (bv. N+1) is het echte risico. De vertaling van LINQ naar SQL is relatief goedkoop en WHERE wordt gewoon vertaald."
    },
    {
      q: "Je hebt in Profiler een trage query van je ASP.NET-applicatie gevonden. Hoe kom je het eenvoudigst bij het execution plan van precies die query?",
      options: ["In de connection string <code>ShowPlan=true</code> zetten en de app herstarten", "In Profiler op de kolom Duration dubbelklikken", "De SQL uit TextData kopiëren en in SSMS uitvoeren met Include Actual Execution Plan", "Het estimated plan van de hele database genereren"],
      answer: 2,
      explain: "Je pakt de exacte query uit de trace en draait hem zelf in SSMS met het actual plan aan. Een connection-string-optie zoals ShowPlan bestaat niet voor dit doel."
    },
    {
      q: "Een webpagina is traag. Welke aanpak is het meest gericht?",
      options: [
        "Eerst het plan van een willekeurige query bekijken, dan Profiler",
        "Met Profiler de trage of vaak herhaalde queries vinden, daarna van die query het execution plan bekijken",
        "Alleen Profiler, want die laat ook zien welke indexen ontbreken",
        "Alleen het plan, want Profiler toont alleen inlogpogingen"
      ],
      answer: 1,
      explain: "Profiler vertelt welke queries er draaien en hoe lang ze duren. Het execution plan van zo'n query verklaart waar de tijd in gaat."
    },
    {
      q: "Welke taak kun je met SQL Server Profiler uitvoeren?",
      options: ["Een onderhoudsplan voor nachtelijke back-ups instellen", "Meekijken welke queries draaien en hoe lang ze duren", "Een nieuwe login aanmaken en aan een rol koppelen", "De stopwoordenlijst van een Full-Text index aanpassen"],
      answer: 1,
      explain: "Profiler is een monitoringtool. Back-ups, logins/rollen en Full-Text-instellingen regel je elders in SSMS."
    },
    {
      q: "In een trace zie je dat één klik in een festivalapp één SELECT van 4 seconden veroorzaakt met miljoenen reads. Welk vervolg past hierbij?",
      options: ["Het execution plan van die query bekijken en zo nodig een index toevoegen", "Een <code>.Include()</code> toevoegen om het aantal queries te verlagen", "De trace filteren op BatchStarting in plaats van BatchCompleted", "Niets: Profiler zelf vertraagt de query"],
      answer: 0,
      explain: "Eén zware query is een 'trage query'-probleem: analyseer het plan (scans, lookups) en verbeter met een index. Include helpt tegen véél queries, niet tegen één zware."
    },
    {
      q: "Waarom is het verstandig in Profiler alleen het Completed-event van batches te tonen?",
      options: ["Omdat andere events alleen zichtbaar zijn voor de sysadmin", "Omdat Profiler anders niet kan verbinden met de server", "Omdat je zo alleen de afgeronde queries ziet, mét hun duur, zonder ruis van andere events", "Omdat het BatchStarting-event de query blokkeert tot hij gelogd is"],
      answer: 2,
      explain: "Standaard krijg je alle events; door te filteren hou je een overzichtelijke lijst afgeronde queries met duur/CPU/reads over."
    },
    {
      q: "Welke kolom in een Profiler-trace gebruik je om te achterhalen <em>wie</em> een query uitvoerde?",
      options: ["<code>Reads</code>", "<code>TextData</code>", "<code>Duration</code>", "<code>LoginName</code>"],
      answer: 3,
      explain: "LoginName (en ApplicationName/HostName) vertelt wie of wat de query stuurde. TextData bevat de SQL-tekst zelf."
    },
    {
      q: "Je ziet na het laden van een overzichtspagina 200 SELECTs met dezelfde vorm, alleen een andere <code>@p0</code>. Wat is hiervoor de gangbare naam?",
      options: ["Het N+1-probleem", "Parameter sniffing", "Een deadlock", "Lock escalation"],
      answer: 0,
      explain: "Eén query voor de lijst plus één per rij voor gerelateerde data is het N+1-probleem, typisch voor lazy loading in een ORM."
    },
    {
      q: "Een student zegt: \"Ik zie in Profiler in groen welke index er ontbreekt.\" Wat klopt er?",
      options: ["Dat klopt, mits je de optie 'show missing indexes' bij de trace aanzet", "Dat klopt niet; groene index-suggesties staan in het query execution plan", "Dat klopt, maar alleen voor queries langer dan één seconde", "Dat klopt niet; ontbrekende indexen zie je alleen in het transaction log"],
      answer: 1,
      explain: "Profiler geeft geen indexadvies. De groene 'Missing Index'-tekst is een onderdeel van het execution plan in SSMS."
    },
    {
      q: "Profiler laat zien dat een rapportagepagina 3 queries uitvoert die elk 5 ms duren, en één die 6 seconden duurt. Wat geeft het meeste resultaat?",
      options: ["Alle vier de queries in één <code>.Include()</code> samenvoegen", "Profiler vaker laten draaien zodat de cache opwarmt", "De drie snelle queries omzetten naar stored procedures", "De trage query analyseren met het execution plan"],
      answer: 3,
      explain: "Profiler wijst de bottleneck aan; het plan van díe query verklaart de traagheid en laat zien welke index of aanpassing helpt."
    }
  ]
});
