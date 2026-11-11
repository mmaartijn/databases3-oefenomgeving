DB3.registerTopic({
  id: "json",
  intro: "SQL Server slaat een brug tussen de strakke relationele wereld en flexibele, semi-gestructureerde data. Met FOR JSON maak je van een resultset JSON (of XML), en met JSON_VALUE en OPENJSON haal je JSON weer uit elkaar tot kolommen en rijen.",
  sections: [
    {
      title: "Wat is JSON en waarom in je database?",
      body: `<p><strong>JSON</strong> (JavaScript Object Notation) is een compact tekstformaat met <em>key-value pairs</em> (gescheiden door <code>:</code>), objecten tussen <code>{ }</code> en arrays tussen <code>[ ]</code>. Het is dé standaard voor communicatie tussen client en server (web-API's) en is makkelijk uitbreidbaar.</p>
<pre><code class="sql">{
  "OrderID": 7781,
  "Customer": { "Name": "Tailspin Toys", "City": "Utrecht" },
  "Lines": [
    { "StockItemID": 12, "Qty": 3 },
    { "StockItemID": 40, "Qty": 1 }
  ]
}</code></pre>
<p>Het grote voordeel van JSON in een database is <strong>schema-flexibiliteit</strong>: je hoeft niet van tevoren voor elk mogelijk veld een kolom te maken. Krijgt een product morgen een extra eigenschap (bijv. <code>"Allergens"</code>), dan zet je die gewoon in het JSON-document zonder <code>ALTER TABLE</code>. WideWorldImporters doet dit bijvoorbeeld met de kolom <code>Warehouse.StockItems.CustomFields</code>.</p>
<table><thead><tr><th></th><th>Relationele tabellen (SQL)</th><th>JSON / NoSQL-stijl</th></tr></thead>
<tbody>
<tr><td>Structuur</td><td>Ligt vast; alle data moet erin passen</td><td>Flexibel, per document anders mogelijk</td></tr>
<tr><td>Voorspelbaarheid</td><td>Vast verwachtingspatroon door kolommen en types</td><td>Je weet niet zeker welke keys er zijn</td></tr>
<tr><td>Bevragen</td><td>Optimale snelheid (indexen op kolommen)</td><td>Langzamer: tekst moet eerst geparsed worden</td></tr>
<tr><td>Bij elkaar</td><td>Data verspreid over tabellen (joins)</td><td>Gerelateerde data zit in één document</td></tr>
</tbody></table>
<div class="callout exam"><strong>Toetstip</strong> De reden om JSON op te slaan is <em>flexibiliteit van je schema</em>, niet "meer datatypes", "meer ruimte" of "betere .NET-integratie". De reden om data juist wél in tabellen/kolommen te zetten is dat <em>selecteren/bevragen sneller</em> gaat.</div>`
    },
    {
      title: "SQL vs NoSQL en ACID",
      body: `<p>NoSQL staat voor <em>Not Only SQL</em>: databases (zoals documentdatabases) die geen vaste tabelstructuur afdwingen. SQL Server combineert beide werelden: je hebt relationele tabellen mét ACID-transacties, en je kunt JSON-tekst opslaan in een <code>NVARCHAR(MAX)</code>-kolom.</p>
<ul>
<li>Een relationele database zoals SQL Server <strong>waarborgt ACID</strong> (Atomicity, Consistency, Isolation, Durability).</li>
<li>NoSQL-systemen leveren die garanties <strong>niet</strong> standaard; zij ruilen strikte consistentie in voor flexibiliteit en schaalbaarheid (vaak "eventual consistency").</li>
</ul>
<div class="callout warn"><strong>Let op</strong> "NoSQL garandeert ACID" is dus géén juiste bewering in de lijn van dit vak. Wil je ACID én JSON, dan sla je je JSON op in SQL Server.</div>
<p>Wanneer je weet dat je bepaalde velden vaak gaat filteren of sorteren, is het slim die velden <strong>uit de JSON te halen en als eigen kolom</strong> op te slaan. Dan kan SQL Server er indexen op gebruiken en gaat je <code>SELECT</code> veel sneller. De rest van het document bewaar je als JSON voor toekomstige, nog onbekende velden.</p>`
    },
    {
      title: "Van tabel naar JSON: FOR JSON AUTO en PATH",
      body: `<p>Om een gewone resultset als JSON terug te krijgen voeg je simpelweg <code>FOR JSON</code> toe aan het einde van je query. Geen stringconcatenatie, geen speciale procedure.</p>
<pre><code class="sql">SELECT c.CustomerID, c.CustomerName
FROM Sales.Customers AS c
WHERE c.CustomerID &lt;= 2
FOR JSON AUTO;
-- [{"CustomerID":1,"CustomerName":"Tailspin Toys (Head Office)"}, ...]</code></pre>
<table><thead><tr><th>Variant</th><th>Wie bepaalt de hiërarchie?</th></tr></thead>
<tbody>
<tr><td><code>FOR JSON AUTO</code></td><td><strong>SQL Server</strong> kiest de structuur, op basis van de volgorde van tabellen in je <code>SELECT</code>/<code>JOIN</code> (een gejoinde tabel wordt een geneste array).</td></tr>
<tr><td><code>FOR JSON PATH</code></td><td><strong>Jij</strong> bepaalt de structuur via de kolomaliassen; een punt in de alias maakt een genest object.</td></tr>
</tbody></table>
<pre><code class="sql">SELECT o.OrderID          AS [Order.Id],
       o.OrderDate        AS [Order.Date],
       c.CustomerName     AS [Order.Customer.Name]
FROM Sales.Orders AS o
JOIN Sales.Customers AS c ON c.CustomerID = o.CustomerID
WHERE o.OrderID = 1
FOR JSON PATH;
-- [{"Order":{"Id":1,"Date":"2013-01-01","Customer":{"Name":"Wingtip Toys"}}}]</code></pre>
<p><strong>Aliassen doen er dus toe:</strong> de alias van een kolom wordt de <em>propertynaam</em> in de JSON; bij <code>AUTO</code> wordt de alias van een (gejoinde) tabel de naam van het geneste object/array.</p>
<div class="callout exam"><strong>Toetstip</strong> Het verschil tussen PATH en AUTO gaat over <em>wie de hiërarchie/nesting bepaalt</em>, niet over welke kolommen of welke sorteervolgorde je krijgt. Dat regel je bij beide gewoon met <code>SELECT</code> en <code>ORDER BY</code>.</div>`
    },
    {
      title: "ROOT en de overstap naar XML",
      body: `<p>Met <code>ROOT('Naam')</code> geef je het teruggegeven JSON- of XML-object een <strong>naam voor het buitenste (root) element</strong>. ROOT is <em>optioneel</em>, zowel bij AUTO als bij PATH.</p>
<pre><code class="sql">SELECT s.SupplierID AS Id, s.SupplierName AS Name
FROM Purchasing.Suppliers AS s
FOR JSON PATH, ROOT('Suppliers');
-- {"Suppliers":[{"Id":1,"Name":"A Datum Corporation"}, ...]}</code></pre>
<p>Nuttig weetje: wil je <strong>XML</strong> in plaats van JSON, dan verander je alleen het keyword <code>JSON</code> in <code>XML</code>. De rest van de query blijft hetzelfde; het hangt dus níét van je brondata af, alleen van welk outputformaat jij wilt.</p>
<pre><code class="sql">SELECT s.SupplierID AS Id, s.SupplierName AS Name
FROM Purchasing.Suppliers AS s
FOR XML PATH('Supplier'), ROOT('Suppliers');
-- &lt;Suppliers&gt;&lt;Supplier&gt;&lt;Id&gt;1&lt;/Id&gt;...&lt;/Supplier&gt;&lt;/Suppliers&gt;</code></pre>`
    },
    {
      title: "Van JSON naar waarden: JSON_VALUE",
      body: `<p><code>JSON_VALUE(kolom, pad)</code> haalt <strong>één scalaire waarde</strong> (tekst, getal, boolean) uit een JSON-string. Het pad begint met <code>$</code> (de root) en navigeert met punten, arrays met <code>[index]</code>.</p>
<pre><code class="sql">SELECT StockItemID,
       StockItemName,
       JSON_VALUE(CustomFields, '$.CountryOfManufacture') AS Land,
       JSON_VALUE(CustomFields, '$.Tags[0]')              AS EersteTag
FROM Warehouse.StockItems
WHERE JSON_VALUE(CustomFields, '$.CountryOfManufacture') = 'Japan';</code></pre>
<p>Je gebruikt JSON_VALUE dus om een JSON-document te benaderen alsof het een sub-object met eigen velden is, in <code>SELECT</code>, <code>WHERE</code> en <code>ORDER BY</code>. Voor een heel object of array heb je <code>JSON_QUERY</code> of <code>OPENJSON</code> nodig; JSON_VALUE geeft dan <code>NULL</code>.</p>`
    },
    {
      title: "Van JSON naar rijen: OPENJSON + CROSS APPLY",
      body: `<p><code>OPENJSON</code> is een <strong>tabelwaardige functie</strong>: hij verandert een JSON-object of -array in een resultset met de kolommen <code>[key]</code>, <code>[value]</code> en <code>[type]</code>. Zo parse je een array naar <strong>meerdere rijen</strong>.</p>
<p>Staat de JSON in een kolom, dan combineer je OPENJSON met <code>CROSS APPLY</code>: per rij van de buitentabel wordt OPENJSON uitgevoerd op de JSON van díe rij.</p>
<pre><code class="sql">-- Elke rij in Webshop.Orders heeft een kolom OrderJson met een array "Lines"
SELECT o.OrderID,
       line.[key]                               AS RegelNr,
       JSON_VALUE(line.[value], '$.StockItemID') AS StockItemID,
       JSON_VALUE(line.[value], '$.Qty')         AS Aantal
FROM Webshop.Orders AS o
CROSS APPLY OPENJSON(o.OrderJson, '$.Lines') AS line;</code></pre>
<p>Je kunt OPENJSON <strong>nesten</strong>: een tweede <code>CROSS APPLY OPENJSON(line.[value], '$.Options')</code> haalt waarden uit een geneste array. Zo werkt ook het importscript van de weerdata-opdracht: eerst het hele bestand openen, dan per station de metingen met CROSS APPLY uitklappen.</p>
<pre><code class="sql">DECLARE @json NVARCHAR(MAX);
SELECT @json = BulkColumn
FROM OPENROWSET(BULK 'C:\\temp\\feed.json', SINGLE_CLOB) AS f;

SELECT JSON_VALUE(m.[value], '$.stationid') AS StationID,
       m.[value]                            AS RuweMeting   -- rest blijft JSON
FROM OPENJSON(@json, '$.actual') AS root
CROSS APPLY OPENJSON(root.[value]) AS m;</code></pre>
<table><thead><tr><th>Functie</th><th>Resultaat</th><th>Gebruik</th></tr></thead>
<tbody>
<tr><td><code>JSON_VALUE</code></td><td>Eén scalaire waarde</td><td>Een veld uitlezen/filteren</td></tr>
<tr><td><code>JSON_QUERY</code></td><td>Een object/array als JSON-tekst</td><td>Een deel-document doorgeven</td></tr>
<tr><td><code>OPENJSON</code></td><td>Een tabel (rijen)</td><td>Arrays/objecten uitklappen naar rijen</td></tr>
<tr><td><code>FOR JSON</code></td><td>JSON-tekst</td><td>Resultset omzetten naar JSON</td></tr>
</tbody></table>
<div class="callout tip"><strong>Tip</strong> Wil je de uitgeklapte key/value-rijen weer als nette kolommen, dan kun je pivoteren of <code>OPENJSON ... WITH (Kolom TYPE '$.pad')</code> gebruiken. Daarvoor moet je wel alle keys kennen, en dan ben je je NoSQL-flexibiliteit eigenlijk kwijt. Prima voor ad-hoc queries.</div>`
    }
  ],
  keyPoints: [
    "JSON in je database = <strong>flexibel schema</strong>: nieuwe velden zonder ALTER TABLE.",
    "Data in tabelkolommen i.p.v. één JSON-tekstveld = <strong>snellere SELECTs</strong> (indexeerbaar, geen parsing).",
    "Resultset naar JSON: voeg <code>FOR JSON</code> toe aan je query.",
    "<code>FOR JSON AUTO</code>: SQL Server bepaalt de hiërarchie. <code>FOR JSON PATH</code>: jij bepaalt de hiërarchie via aliassen met punten.",
    "Kolom- en tabelaliassen worden de <strong>property- en objectnamen</strong> in de JSON-output.",
    "<code>ROOT('Naam')</code> geeft het buitenste JSON/XML-object een naam en is optioneel.",
    "Van JSON naar XML: verander <code>FOR JSON</code> in <code>FOR XML</code>.",
    "<code>JSON_VALUE</code> haalt één scalaire waarde op; <code>OPENJSON</code> maakt rijen van objecten/arrays.",
    "Array in een kolom naar rijen: <code>CROSS APPLY OPENJSON(kolom, '$.pad')</code>; nesten kan voor geneste arrays.",
    "SQL Server waarborgt ACID; NoSQL-systemen doen dat niet standaard."
  ],
  pitfalls: [
    { wrong: "JSON gebruik je omdat het meer datatypes of meer opslagruimte heeft dan SQL.", right: "Het voordeel is <strong>schema-flexibiliteit</strong>. JSON is gewoon tekst (<code>NVARCHAR</code>) en heeft juist minder types." },
    { wrong: "Alles in één JSON-veld opslaan maakt je queries sneller.", right: "Andersom: kolommen in een tabelstructuur maken je <strong>SELECT sneller</strong>, omdat ze indexeerbaar zijn en niet geparsed hoeven te worden." },
    { wrong: "FOR JSON PATH bepaalt welke kolommen in de output komen, AUTO kiest ze zelf.", right: "Welke kolommen je krijgt bepaal je altijd met je SELECT-lijst. Het verschil gaat over de <strong>hiërarchie/nesting</strong>: bij PATH via aliassen, bij AUTO kiest SQL Server die." },
    { wrong: "ROOT is verplicht bij FOR JSON AUTO.", right: "<code>ROOT('...')</code> is altijd optioneel. Het geeft alleen het buitenste object een naam." },
    { wrong: "Of je FOR JSON of FOR XML gebruikt hangt af van hoe je brondata is opgeslagen.", right: "Het hangt alleen af van het <strong>gewenste outputformaat</strong>. Dezelfde tabel kan met beide keywords bevraagd worden." },
    { wrong: "JSON_VALUE en OPENJSON doen hetzelfde.", right: "<code>JSON_VALUE</code> geeft één scalaire waarde terug; <code>OPENJSON</code> geeft een tabel met rijen, ideaal voor arrays." },
    { wrong: "Een NoSQL-database waarborgt de ACID-principes net als SQL Server.", right: "ACID is juist de kracht van relationele databases; NoSQL levert die garanties niet standaard." }
  ],
  flashcards: [
    { front: "Belangrijkste reden om JSON in je database op te slaan?", back: "Flexibiliteit van je schema: nieuwe velden toevoegen zonder tabelwijziging." },
    { front: "Waarom liever tabelkolommen dan één JSON-tekstveld?", back: "Je <strong>SELECT</strong> gaat sneller (indexen, geen parsing, vaste types)." },
    { front: "Hoe maak je van een resultset JSON?", back: "Voeg <code>FOR JSON AUTO</code> of <code>FOR JSON PATH</code> toe aan de query." },
    { front: "Je joint Customers en Orders en wilt snel JSON zonder over de structuur na te denken. Welke variant?", back: "<code>FOR JSON AUTO</code>: SQL Server nest zelf op basis van de tabellen in de SELECT." },
    { front: "Je wilt <code>{\"klant\":{\"adres\":{\"stad\":\"Breda\"}}}</code> precies zo vormgeven. Welke variant en hoe?", back: "<code>FOR JSON PATH</code> met een alias als <code>AS [klant.adres.stad]</code>." },
    { front: "<code>SELECT CustomerName AS naam ... FOR JSON PATH</code>: hoe heet de property in de output?", back: "<code>\"naam\"</code>: de alias wordt de propertynaam." },
    { front: "ROOT('X')", back: "Geeft het buitenste JSON- of XML-object de naam X. Optioneel." },
    { front: "Een koppeling wil dezelfde resultset als XML in plaats van JSON. Wat pas je aan?", back: "Het keyword: <code>FOR XML</code> in plaats van <code>FOR JSON</code> (bijv. <code>FOR XML PATH</code>)." },
    { front: "JSON_VALUE", back: "Haalt één scalaire waarde uit een JSON-string via een pad, bijv. <code>'$.Prijs'</code>." },
    { front: "OPENJSON", back: "Tabelwaardige functie: zet JSON-object/array om in rijen met <code>key</code>, <code>value</code>, <code>type</code>." },
    { front: "Array uit een kolom naar meerdere rijen?", back: "<code>CROSS APPLY OPENJSON(kolom, '$.pad')</code>" },
    { front: "Waarden uit een geneste array halen?", back: "OPENJSON nesten: een tweede CROSS APPLY OPENJSON op de <code>[value]</code> van de eerste." },
    { front: "Wat betekent <code>$</code> in een JSON-pad?", back: "De root van het JSON-document." },
    { front: "NoSQL", back: "Not Only SQL: flexibele, schemaloze opslag; waarborgt niet standaard ACID." }
  ],
  quiz: [
    {
      q: "Een festivalorganisatie slaat per artiest technische wensen op. Elke artiest heeft andere wensen en er komen regelmatig nieuwe soorten bij. Waarom is een JSON-kolom hier aantrekkelijk?",
      options: ["Omdat JSON-kolommen automatisch geïndexeerd worden", "Omdat je nieuwe soorten wensen kunt opslaan zonder je tabelstructuur aan te passen", "Omdat JSON minder schijfruimte kost dan losse kolommen", "Omdat JSON-data automatisch gevalideerd wordt op datatypes"],
      answer: 1,
      explain: "De kracht van JSON is schema-flexibiliteit: elk document kan andere velden hebben. JSON wordt juist níét automatisch geïndexeerd of gevalideerd; het is gewoon tekst."
    },
    {
      q: "Een webshop filtert dagelijks miljoenen keren op de merknaam van een product, die nu diep in een JSON-document staat. Wat is de beste verbetering?",
      options: ["De JSON omzetten naar XML", "Een ROOT-element toevoegen aan het document", "FOR JSON PATH gebruiken in plaats van AUTO", "De merknaam als eigen kolom opslaan zodat er een index op kan"],
      answer: 3,
      explain: "Een vaste kolom kan geïndexeerd worden en hoeft niet per rij geparsed te worden, dus de SELECT wordt sneller. FOR JSON en ROOT gaan over het maken van output, niet over het lezen van opgeslagen JSON."
    },
    {
      q: "Wat moet je minimaal aan een gewone SELECT-query toevoegen om het resultaat als JSON terug te krijgen?",
      code: "SELECT PersonID, FullName\nFROM Application.People\nWHERE IsEmployee = 1",
      options: ["FOR JSON AUTO aan het einde van de query", "CAST(... AS JSON) om elke kolom", "Een aanroep van OPENJSON in de FROM", "Een JSON_VALUE om elke kolom"],
      answer: 0,
      explain: "FOR JSON (AUTO of PATH) zet de resultset om naar JSON. OPENJSON en JSON_VALUE werken de andere kant op: van JSON naar rijen/waarden. Een JSON-datatype om naar te casten bestaat in deze SQL Server-versies niet."
    },
    {
      q: "Wat levert deze query op?",
      code: "SELECT p.PersonID AS [Medewerker.Id],\n       p.FullName AS [Medewerker.Naam]\nFROM Application.People AS p\nWHERE p.PersonID = 2\nFOR JSON PATH;",
      options: ["[{\"PersonID\":2,\"FullName\":\"...\"}]", "[{\"Medewerker.Id\":2,\"Medewerker.Naam\":\"...\"}]", "[{\"Medewerker\":{\"Id\":2,\"Naam\":\"...\"}}]", "Een foutmelding: punten zijn niet toegestaan in aliassen"],
      answer: 2,
      explain: "Bij FOR JSON PATH worden aliassen de propertynamen en betekent een punt in de alias: genest object. Dus ontstaat een object 'Medewerker' met daarin Id en Naam. De oorspronkelijke kolomnamen worden niet gebruikt omdat de alias ze vervangt."
    },
    {
      q: "Je wilt zelf precies bepalen welk veld in welk genest object terechtkomt. Welke optie kies je?",
      options: ["FOR JSON AUTO", "FOR JSON PATH", "FOR JSON ROOT", "OPENJSON"],
      answer: 1,
      explain: "Met PATH bepaal je de hiërarchie zelf via aliassen. Bij AUTO kiest SQL Server de structuur op basis van de tabellen in je query. ROOT is een optie, geen variant, en OPENJSON leest JSON in plaats van het te maken."
    },
    {
      q: "Een query eindigt op <code>FOR JSON AUTO, ROOT('Leden')</code>. Wat doet <code>ROOT('Leden')</code>?",
      options: ["Het filtert alleen de rijen uit de tabel Leden", "Het maakt van de tabel Leden het hoofdobject bij een JOIN", "Het verplicht dat elke rij een veld 'Leden' heeft", "Het verpakt de output in een buitenste object met de naam 'Leden'"],
      answer: 3,
      explain: "ROOT geeft het teruggegeven JSON- of XML-object een naam voor het buitenste element: {\"Leden\":[...]}. Het heeft niets te maken met filteren of joinen."
    },
    {
      q: "Een collega levert een rapportage met <code>FOR JSON PATH, ROOT('Rapport')</code>. Een afnemer wil exact dezelfde gegevens als XML. Wat is de eenvoudigste aanpassing?",
      options: ["JSON vervangen door XML in de FOR-clausule", "De database-instelling voor outputformaat wijzigen", "De uitkomst met CAST naar het type XML omzetten", "De data eerst in een XML-kolom opslaan"],
      answer: 0,
      explain: "Je hoeft alleen het keyword te wisselen: FOR XML in plaats van FOR JSON. Er bestaat geen database-instelling voor het outputformaat, en de vorm van de brondata is niet bepalend."
    },
    {
      q: "Welke functie gebruik je om alleen de waarde van <code>\"Kleur\"</code> uit een JSON-kolom <code>Specs</code> te tonen?",
      options: ["OPENJSON(Specs, '$.Kleur')", "FOR JSON PATH", "JSON_VALUE(Specs, '$.Kleur')", "JSON_MODIFY(Specs, '$.Kleur')"],
      answer: 2,
      explain: "JSON_VALUE geeft één scalaire waarde terug. OPENJSON zou een tabel opleveren (handig voor arrays), en JSON_MODIFY wijzigt een waarde in plaats van deze te lezen."
    },
    {
      q: "Een bibliotheek heeft per uitlening een JSON-kolom met een array <code>\"Boeken\"</code>. Je wilt per boek een aparte rij. Welke constructie past?",
      options: ["SELECT ... FROM Uitleningen WHERE JSON_VALUE(Info, '$.Boeken') IS NOT NULL", "SELECT ... FROM Uitleningen AS u CROSS APPLY OPENJSON(u.Info, '$.Boeken') AS b", "SELECT ... FROM Uitleningen FOR JSON AUTO", "SELECT ... FROM Uitleningen AS u JOIN JSON_VALUE(u.Info, '$.Boeken') AS b"],
      answer: 1,
      explain: "OPENJSON klapt een array uit naar rijen, en CROSS APPLY voert dat per uitlening uit. JSON_VALUE geeft voor een array NULL terug, omdat het alleen scalaire waarden ophaalt."
    },
    {
      q: "Wat geeft <code>JSON_VALUE(Info, '$.Boeken')</code> terug als <code>Boeken</code> een array is?",
      options: ["De eerste waarde uit de array", "Alle waarden als kommagescheiden tekst", "Een aparte rij per element", "NULL (in de standaardmodus), omdat het geen scalaire waarde is"],
      answer: 3,
      explain: "JSON_VALUE is bedoeld voor scalaire waarden. Voor een object of array geeft het in de standaard (lax) modus NULL. Voor rijen gebruik je OPENJSON, voor het JSON-fragment JSON_QUERY."
    },
    {
      q: "Elke bestelling bevat een array <code>Regels</code>, en elke regel weer een array <code>Opties</code>. Hoe krijg je elke optie op een eigen rij?",
      options: ["Twee keer CROSS APPLY OPENJSON: eerst op '$.Regels', daarna op de [value] van de regel met '$.Opties'", "Dat kan niet; OPENJSON werkt maar één niveau diep", "Met FOR JSON PATH en een punt in de alias", "Met JSON_VALUE(..., '$.Regels.Opties')"],
      answer: 0,
      explain: "OPENJSON kan genest worden: de [value]-kolom van de eerste aanroep is weer JSON die je opnieuw kunt openen. Zo haal je ook waarden uit geneste arrays."
    },
    {
      q: "Welke kolommen levert <code>OPENJSON(@json)</code> zonder WITH-clausule op?",
      options: ["Alleen de kolom value", "Een kolom per key in het document", "key, value en type", "id, path en text"],
      answer: 2,
      explain: "Zonder WITH geeft OPENJSON de standaardkolommen key, value en type. Een kolom per key krijg je pas als je zelf een WITH-schema opgeeft (en dus alle keys kent)."
    },
    {
      q: "Welke bewering over SQL Server en NoSQL past bij de lesstof?",
      options: ["NoSQL-databases waarborgen ACID beter dan relationele databases", "SQL Server kan geen semi-gestructureerde data opslaan", "Relationele tabellen zijn flexibeler dan JSON-documenten", "SQL Server combineert relationele tabellen (met ACID) met de mogelijkheid JSON op te slaan en te bevragen"],
      answer: 3,
      explain: "SQL Server slaat een brug: je houdt ACID-transacties en kunt toch flexibele JSON opslaan. NoSQL levert ACID niet standaard, en relationele tabellen zijn juist minder flexibel (vaste structuur)."
    },
    {
      q: "Je gebruikt <code>FOR JSON AUTO</code> op een query met <code>Sales.Customers AS Klant JOIN Sales.Orders AS Bestelling</code>. Welke rol speelt de alias <code>Bestelling</code>?",
      options: ["Geen; AUTO negeert alle aliassen", "Het wordt de naam van de geneste array met bestellingen per klant", "Het wordt de naam van het root-object", "Het bepaalt de sorteervolgorde van de bestellingen"],
      answer: 1,
      explain: "Bij AUTO nest SQL Server de gejoinde tabel onder de eerste tabel, en gebruikt de tabelalias als naam van die geneste array. Aliassen hebben dus wel effect; het root-object geef je met ROOT een naam."
    },
    {
      q: "Wanneer is FOR JSON AUTO de handigste keuze?",
      options: ["Als je snel JSON wilt en de standaardstructuur die SQL Server kiest goed genoeg is", "Als je een eigen, diep geneste structuur met zelfgekozen objectnamen nodig hebt", "Als je JSON wilt inlezen naar rijen", "Als je XML-output nodig hebt"],
      answer: 0,
      explain: "AUTO laat SQL Server de structuur kiezen: snel en eenvoudig. Voor een eigen hiërarchie kies je PATH, voor inlezen OPENJSON en voor XML FOR XML."
    },
    {
      q: "In een importscript wordt een JSON-bestand eerst met OPENROWSET in een variabele gelezen en daarna met OPENJSON verwerkt. Een paar vaste velden komen in eigen kolommen; de volledige meting gaat als JSON in een NVARCHAR(MAX)-kolom. Waarom die combinatie?",
      options: ["Omdat OPENJSON alleen werkt als je de JSON ook bewaart", "Omdat NVARCHAR(MAX) sneller doorzoekbaar is dan losse kolommen", "Vaste velden zijn snel te bevragen, en het JSON-deel houdt de opslag flexibel voor velden die later nog komen", "Omdat SQL Server geen datum- of getalkolommen uit JSON kan vullen"],
      answer: 2,
      explain: "Dit combineert het beste van beide werelden: de velden waar je op zoekt staan in kolommen (snel, met een key), en de rest blijft flexibel als JSON. Een tekstkolom met JSON is juist níét sneller doorzoekbaar."
    }
  ]
});
