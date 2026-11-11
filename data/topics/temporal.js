DB3.registerTopic({
  id: "temporal",
  intro: "Met een temporal table (system-versioned table) houdt SQL Server zelf de volledige geschiedenis van elke rij bij. Je kunt daarna vragen: hoe zag deze klant eruit op 1 maart om 10:00? Zonder triggers of zelfgebouwde historietabellen.",
  sections: [
    {
      title: "Het probleem en de oplossing",
      body: `<p>Vaak wil je niet alleen de huidige waarheid weten, maar ook wat er vroeger gold: naar welk adres is dat pakket destijds gestuurd, welke prijs gold er op het moment van de bestelling? Vroeger bouwde je daarvoor zelf een historietabel met triggers. Sinds SQL Server 2016 doet de database dat voor je met <strong>temporal tables</strong>.</p>
<p>Een temporal table bestaat <strong>fysiek uit twee tabellen</strong>:</p>
<ul>
<li>De <strong>huidige tabel</strong> met alleen de actuele rijen.</li>
<li>De <strong>history table</strong> met alle oude versies.</li>
</ul>
<p>Waarom twee? Omdat de <strong>huidige waarheid veel vaker bevraagd wordt</strong> dan de historie. Door de oude versies apart te zetten blijft de actuele tabel klein en snel.</p>
<div class="callout warn"><strong>Let op</strong> Elke UPDATE en DELETE levert een rij in de history op. Bij tabellen die vaak wijzigen kan de database daardoor flink groeien.</div>`
    },
    {
      title: "Een temporal table maken",
      body: `<p>Je hebt twee <strong>periodekolommen</strong> nodig van type <code>DATETIME2</code>. Ze moeten:</p>
<ul>
<li><code>GENERATED ALWAYS AS ROW START</code> / <code>ROW END</code> zijn (SQL Server vult ze, jij niet);</li>
<li><strong>NOT NULL</strong> zijn;</li>
<li>als <strong><code>PERIOD FOR SYSTEM_TIME</code></strong> gemarkeerd zijn.</li>
</ul>
<p>Voeg je ze toe aan een bestaande tabel met data, dan geef je ze een default op het <strong>begin en eind der (SQL-)tijden</strong>:</p>
<pre><code class="sql">ALTER TABLE Sales.Customers ADD
    ValidFrom DATETIME2(0) GENERATED ALWAYS AS ROW START NOT NULL
              DEFAULT ('19000101'),
    ValidTo   DATETIME2(0) GENERATED ALWAYS AS ROW END   NOT NULL
              DEFAULT ('99991231 23:59:59'),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);

ALTER TABLE Sales.Customers
SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = Sales.CustomersHistory));</code></pre>
<p>Er is dus géén kolom <code>Deleted</code>, <code>VersionNumber</code> of <code>UpdatedAt</code> nodig; de periode zegt alles. De tijden zijn in <strong>UTC</strong>.</p>`
    },
    {
      title: "Wat gebeurt er bij INSERT, UPDATE en DELETE?",
      body: `<table>
<thead><tr><th>Actie</th><th>Huidige tabel</th><th>History table</th></tr></thead>
<tbody>
<tr><td>INSERT</td><td>Nieuwe rij, <code>ValidFrom</code> = nu, <code>ValidTo</code> = 9999-12-31</td><td>Niets</td></tr>
<tr><td>UPDATE</td><td>Rij krijgt nieuwe waarden, <code>ValidFrom</code> = nu</td><td>Oude versie erbij, met <code>ValidTo</code> = nu</td></tr>
<tr><td>DELETE</td><td>Rij is <strong>weg</strong></td><td>Laatste versie erbij, met <code>ValidTo</code> = moment van verwijderen</td></tr>
</tbody>
</table>
<p>Gevolg voor de huidige tabel: <code>SELECT * FROM Sales.Customers</code> laat rijen zien met <strong>verschillende <code>ValidFrom</code></strong> (het moment van insert of laatste wijziging), maar met <strong>dezelfde <code>ValidTo</code></strong> (9999-12-31), want ze zijn allemaal nog geldig.</p>
<p>De <strong>history table is read-only</strong> zolang system versioning aan staat. Een INSERT, UPDATE of DELETE erop geeft een fout. Zo kan niemand de geschiedenis vervalsen.</p>`
    },
    {
      title: "Terug in de tijd: FOR SYSTEM_TIME",
      body: `<p>Je hoeft de twee tabellen niet zelf te joinen of te UNIONen. Met <code>FOR SYSTEM_TIME</code> combineert SQL Server huidige en historische data voor je:</p>
<table>
<thead><tr><th>Clausule</th><th>Geeft</th></tr></thead>
<tbody>
<tr><td><code>AS OF @t</code></td><td>De versie die <strong>op moment @t van kracht was</strong>: per primary key maximaal één rij</td></tr>
<tr><td><code>FROM @a TO @b</code></td><td>Alle versies die ergens in die periode actief waren (eindgrens exclusief)</td></tr>
<tr><td><code>BETWEEN @a AND @b</code></td><td>Idem, eindgrens inclusief. Meerdere versies van dezelfde PK worden <strong>allemaal</strong> teruggegeven</td></tr>
<tr><td><code>CONTAINED IN (@a, @b)</code></td><td>Versies die volledig binnen de periode begonnen én eindigden</td></tr>
<tr><td><code>ALL</code></td><td>Alles: huidig + historie</td></tr>
</tbody>
</table>
<pre><code class="sql">-- Naar welk adres stuurden we op 3 maart om 10:00?
SELECT CustomerName, DeliveryAddressLine1, DeliveryPostalCode
FROM   Sales.Customers
FOR SYSTEM_TIME AS OF '2025-03-03 10:00:00'
WHERE  CustomerID = 832;

-- Alle versies van deze klant in het eerste kwartaal
SELECT CustomerID, CreditLimit, ValidFrom, ValidTo
FROM   Sales.Customers
FOR SYSTEM_TIME BETWEEN '2025-01-01' AND '2025-03-31'
WHERE  CustomerID = 832
ORDER BY ValidFrom;</code></pre>
<div class="callout exam"><strong>Toetstip</strong> Bij <code>BETWEEN</code>/<code>FROM ... TO</code>/<code>ALL</code> kan dezelfde primary key vaker voorkomen. Dat is geen fout en er komt geen versienummer bij: je krijgt gewoon alle versies.</div>`
    },
    {
      title: "Goede use cases en het Entity Framework",
      body: `<p>Gebruik <code>AS OF</code> wanneer je moet weten <strong>hoe iets er op een bepaald moment uitzag</strong>:</p>
<ul>
<li>Naar welk adres is het pakket destijds verstuurd?</li>
<li>Welke kredietlimiet had de klant toen de order werd goedgekeurd?</li>
<li>Audit: wie had welke status op de peildatum?</li>
</ul>
<p>Temporal tables zijn <em>niet</em> bedoeld voor rechten, valuta-omrekening of tekencodering.</p>
<p><strong>Entity Framework</strong>: in de lesstof (EF6) zit nog geen ondersteuning voor temporal queries. Je lost dat op met ad-hoc SQL, een stored procedure of een functie. (EF Core 6+ ondersteunt het wel met <code>TemporalAsOf()</code>.)</p>
<pre><code class="sql">// EF6
var klanten = context.Customers.SqlQuery(
    "SELECT * FROM Sales.Customers FOR SYSTEM_TIME AS OF {0} WHERE CustomerID = 1",
    peilmoment);</code></pre>`
    }
  ],
  keyPoints: [
    "Een temporal table bestaat fysiek uit een <strong>huidige tabel</strong> en een <strong>history table</strong>.",
    "Twee tabellen omdat de huidige data veel vaker bevraagd wordt: dat levert performance op.",
    "Periodekolommen: DATETIME2, <code>GENERATED ALWAYS AS ROW START/END</code>, NOT NULL, gemarkeerd met <code>PERIOD FOR SYSTEM_TIME</code>.",
    "Bij bestaande data krijgen de periodekolommen een default op begin en eind der tijden.",
    "Aanzetten met <code>SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = ...))</code>.",
    "DELETE: de rij verdwijnt uit de huidige tabel en komt in de history met als einddatum het moment van verwijderen.",
    "De history table is read-only: wijzigen geeft een fout.",
    "<code>FOR SYSTEM_TIME AS OF</code> geeft de data die op dat moment van kracht was.",
    "<code>BETWEEN</code> kan meerdere versies van dezelfde PK teruggeven; die komen allemaal terug.",
    "In de huidige tabel verschilt ValidFrom per rij; ValidTo is voor alle rijen 9999-12-31."
  ],
  pitfalls: [
    { wrong: "Historie en huidige data staan in één tabel met een kolom IsCurrent.", right: "Ze staan in twee fysieke tabellen; zo blijft de veelgebruikte huidige tabel snel." },
    { wrong: "Om historie én huidige data te zien, doe je zelf een UNION ALL van beide tabellen.", right: "Gebruik <code>FOR SYSTEM_TIME</code> (AS OF, BETWEEN, ALL, ...); SQL Server combineert ze voor je." },
    { wrong: "Bij een DELETE wordt een kolom Deleted op 1 gezet.", right: "De rij verdwijnt uit de huidige tabel en de laatste versie komt in de history met ValidTo = moment van verwijderen." },
    { wrong: "Met de juiste optie kun je rijen in de history table aanpassen.", right: "Zolang system versioning aan staat is de history read-only; elke wijziging geeft een fout." },
    { wrong: "Bij BETWEEN krijg je per primary key alleen de meest recente versie.", right: "Je krijgt alle versies die in de periode actief waren, ook als de PK vaker voorkomt." },
    { wrong: "Een lege (NULL) ValidTo betekent dat de rij nog actief is.", right: "Periodekolommen zijn NOT NULL; een actieve rij heeft ValidTo = 9999-12-31 23:59:59." }
  ],
  flashcards: [
    { front: "Uit hoeveel fysieke tabellen bestaat een temporal table?", back: "Twee: de huidige tabel en de history table." },
    { front: "Waarom twee tabellen?", back: "De huidige data wordt veel vaker bevraagd; apart houden levert performance op." },
    { front: "Eisen aan de periodekolommen", back: "DATETIME2, GENERATED ALWAYS AS ROW START/END, NOT NULL, gemarkeerd als PERIOD FOR SYSTEM_TIME (bij bestaande data met defaults op begin/eind der tijden)." },
    { front: "Hoe zet je versiebeheer aan?", back: "<code>ALTER TABLE ... SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = ...))</code>" },
    { front: "Wat geeft <code>FOR SYSTEM_TIME AS OF @t</code>?", back: "De data die op moment @t van kracht was." },
    { front: "Wat gebeurt er bij een DELETE?", back: "Rij weg uit de huidige tabel, laatste versie in de history met ValidTo = moment van verwijderen." },
    { front: "Kun je de history table wijzigen?", back: "Nee, die is read-only zolang system versioning aan staat." },
    { front: "BETWEEN en meerdere versies met dezelfde PK?", back: "Die worden allemaal teruggegeven." },
    { front: "ValidFrom/ValidTo in de huidige tabel", back: "ValidFrom = insert of laatste wijziging (verschilt per rij); ValidTo = 9999-12-31 voor alle rijen." },
    { front: "Goede use case voor AS OF", back: "Bijv.: naar welk adres is het pakket destijds verstuurd?" },
    { front: "Nadeel van temporal tables", back: "De database kan sterk groeien; en in EF6 geen directe ondersteuning." }
  ],
  quiz: [
    {
      q: "Een tabel heeft 50.000 actuele rijen en 5 miljoen oude versies. Waarom merkt een gewone SELECT daar weinig van?",
      options: [
        "SQL Server comprimeert oude versies weg",
        "De oude versies staan in een aparte history table; de huidige tabel blijft klein",
        "Een gewone SELECT negeert rijen met een ValidTo in het verleden via een index",
        "Oude versies worden na 30 dagen automatisch verwijderd"
      ],
      answer: 1,
      explain: "De actuele data wordt het vaakst gevraagd. Door historie apart te bewaren blijft de huidige tabel klein en snel; alleen een FOR SYSTEM_TIME-query raakt de history."
    },
    {
      q: "Je wilt zowel actuele als historische versies van een klant zien. Hoe doe je dat het best?",
      options: [
        "UNION ALL van Customers en CustomersHistory",
        "LEFT JOIN van Customers op CustomersHistory",
        "Alleen uit CustomersHistory selecteren",
        "<code>FOR SYSTEM_TIME</code> gebruiken op Customers"
      ],
      answer: 3,
      explain: "FOR SYSTEM_TIME (ALL, BETWEEN, AS OF, ...) combineert de huidige tabel en de history voor je. De history bevat de huidige versie niet."
    },
    {
      q: "Wat retourneert <code>SELECT * FROM Sales.Customers FOR SYSTEM_TIME AS OF '2025-02-01'</code>?",
      options: [
        "De klantgegevens zoals ze op 1 februari 2025 van kracht waren",
        "Alle klanten die op 1 februari 2025 zijn gewijzigd",
        "Alle klanten die na 1 februari 2025 zijn aangemaakt",
        "Alle klanten, maar met 1 februari 2025 als ValidFrom"
      ],
      answer: 0,
      explain: "AS OF geeft de versie die op dat moment geldig was: per klant maximaal één rij."
    },
    {
      q: "Een klant is in maart drie keer gewijzigd. Je vraagt <code>FOR SYSTEM_TIME BETWEEN '2025-03-01' AND '2025-03-31'</code> op. Wat krijg je voor deze klant?",
      options: [
        "Alleen de meest recente versie",
        "Een foutmelding wegens dubbele primary keys",
        "Alle versies die in maart actief waren",
        "Alle versies, met een extra kolom VersionNumber"
      ],
      answer: 2,
      explain: "BETWEEN geeft elke versie die in de periode geldig was. Dezelfde PK mag vaker voorkomen; er komt geen extra kolom bij."
    },
    {
      q: "Een beheerder probeert met een UPDATE een typfout in <code>Sales.CustomersHistory</code> te corrigeren terwijl system versioning aan staat. Wat gebeurt er?",
      options: [
        "Het lukt, want het is gewoon een tabel",
        "Het lukt alleen als de history met READ_WRITE is aangemaakt",
        "Alleen DELETE is toegestaan op een history table",
        "Hij krijgt een foutmelding: de history table is read-only"
      ],
      answer: 3,
      explain: "Zolang system versioning aan staat kan niemand de history wijzigen. Zo blijft de geschiedenis betrouwbaar."
    },
    {
      q: "Klant 12 is gisteren om 14:00 verwijderd uit een temporal tabel. Met welke query vind je hem nog terug?",
      options: [
        "<code>SELECT * FROM Sales.Customers WHERE CustomerID = 12</code>",
        "<code>SELECT * FROM Sales.Customers FOR SYSTEM_TIME AS OF '&lt;gisteren 13:59&gt;' WHERE CustomerID = 12</code>",
        "Niet meer: een DELETE wist ook de historie",
        "<code>SELECT * FROM Sales.Customers WITH (NOLOCK) WHERE CustomerID = 12</code>"
      ],
      answer: 1,
      explain: "Bij een DELETE verhuist de laatste versie naar de history, met als ValidTo het moment van verwijderen. Een AS OF-query op een moment daarvoor geeft hem terug."
    },
    {
      q: "<code>ALTER TABLE Warehouse.Colors ADD ValidFrom datetime2 NULL, ValidTo datetime2 NULL;</code> en daarna <code>SYSTEM_VERSIONING = ON</code> mislukt. Wat ontbreekt er?",
      options: [
        "Een index op ValidFrom",
        "De kolommen moeten NOT NULL zijn, GENERATED ALWAYS AS ROW START/END, met defaults (voor de bestaande rijen) en opgenomen in PERIOD FOR SYSTEM_TIME",
        "Een trigger die ValidTo vult",
        "De tabel moet eerst leeggemaakt worden"
      ],
      answer: 1,
      explain: "SQL Server vult de periodekolommen zelf. Daarvoor moeten ze als ROW START/END gegenereerd worden, NOT NULL zijn en samen de PERIOD vormen. Bij een gevulde tabel geven defaults de bestaande rijen een geldige begin- en eindwaarde."
    },
    {
      q: "Je voert <code>SELECT CustomerID, ValidFrom, ValidTo FROM Sales.Customers</code> uit op een temporal table. Wat zie je?",
      options: [
        "Alle rijen hebben dezelfde ValidFrom en ValidTo",
        "ValidFrom is per rij het insertmoment; ValidTo verschilt ook per rij",
        "ValidFrom is per rij het moment van insert of laatste wijziging; ValidTo is voor alle rijen gelijk",
        "Beide kolommen zijn NULL; ze worden pas in de history gevuld"
      ],
      answer: 2,
      explain: "Elke actuele rij is geldig tot het eind der tijden (9999-12-31), maar is op een eigen moment voor het laatst gewijzigd."
    },
    {
      q: "Welke vraag beantwoord je het best met <code>FOR SYSTEM_TIME AS OF</code>?",
      options: [
        "Welke kredietlimiet had deze klant op het moment dat zijn order werd goedgekeurd?",
        "Heeft deze klant de juiste rechten in de database?",
        "Hoe toon ik de prijs in de valuta van de klant?",
        "Welke index gebruikt deze query?"
      ],
      answer: 0,
      explain: "AS OF draait om 'hoe zag het er op dat moment uit'. Rechten, valuta en indexes hebben er niets mee te maken."
    },
    {
      q: "Welk statement zet versiebeheer aan op een tabel waarvan de periodekolommen al bestaan?",
      options: [
        "<code>ALTER TABLE Sales.Customers ENABLE HISTORY</code>",
        "<code>CREATE TRIGGER TR_Customers_History ...</code>",
        "<code>ALTER DATABASE SET TEMPORAL ON</code>",
        "<code>ALTER TABLE Sales.Customers SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = Sales.CustomersHistory))</code>"
      ],
      answer: 3,
      explain: "SYSTEM_VERSIONING = ON koppelt de history table. Triggers heb je juist níet meer nodig."
    },
    {
      q: "Wat is een reëel nadeel van temporal tables?",
      options: [
        "Je kunt geen UPDATE meer doen op de huidige tabel",
        "De database kan flink groeien bij tabellen die vaak wijzigen",
        "Primary keys zijn niet meer toegestaan",
        "Queries op de huidige tabel worden altijd trager"
      ],
      answer: 1,
      explain: "Elke wijziging bewaart een oude versie. De huidige tabel blijft juist snel, omdat de historie apart staat."
    },
    {
      q: "Hoe vraag je in EF6 (zoals in de lesstof) temporal data op?",
      options: [
        "Met <code>.Include(x => x.History)</code>",
        "Dat gaat automatisch zodra system versioning aan staat",
        "Met ad-hoc SQL, een stored procedure of een functie",
        "Door de history table als aparte DbSet te mappen en zelf te joinen"
      ],
      answer: 2,
      explain: "EF6 kent FOR SYSTEM_TIME niet. Je gebruikt bijvoorbeeld SqlQuery met FOR SYSTEM_TIME AS OF, of een procedure/functie."
    }
  ]
});
