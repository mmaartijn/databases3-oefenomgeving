DB3.registerTopic({
  id: "acid",
  intro: "ACID is de belofte die een relationele database je doet: je data klopt, blijft kloppen en raakt niet kwijt. Wie de vier letters écht snapt, begrijpt waarom transacties, constraints en isolation levels bestaan.",
  sections: [
    {
      title: "Waarom ACID?",
      body: `<p>Een database wordt tegelijk door tientallen gebruikers en applicaties gebruikt, servers kunnen crashen en queries kunnen halverwege fout gaan. Het ACID-principe is in het leven geroepen om je in al die situaties <strong>zekerheden over je data</strong> te geven. Het gaat dus niet om snelheid, normaliseren of versiebeheer, maar om betrouwbaarheid.</p>
<table>
<thead><tr><th>Letter</th><th>Betekenis</th><th>In één zin</th><th>Belangrijkste mechanisme in SQL Server</th></tr></thead>
<tbody>
<tr><td><strong>A</strong></td><td>Atomicity</td><td>Alles of niets</td><td>Transacties</td></tr>
<tr><td><strong>C</strong></td><td>Consistency</td><td>Alle regels blijven van kracht</td><td>Constraints (CHECK, FOREIGN KEY, NOT NULL, UNIQUE, PK), triggers</td></tr>
<tr><td><strong>I</strong></td><td>Isolation</td><td>Tijdens uitvoeren geen bijeffecten voor anderen</td><td>Locking en isolation levels</td></tr>
<tr><td><strong>D</strong></td><td>Durability</td><td>Wijzigingen zijn definitief</td><td>Transaction log en datafiles op disk</td></tr>
</tbody>
</table>
<div class="callout exam"><strong>Toetstip</strong> Koppel elke letter aan het mechanisme dat hem waarborgt. Atomicity = transacties, Consistency = constraints. Indexes, de profiler en temporal tables zijn handig, maar waarborgen geen ACID-eigenschap.</div>`
    },
    {
      title: "Atomicity: alles of niets",
      body: `<p>Een transactie is één ondeelbare eenheid werk. Óf alle wijzigingen worden doorgevoerd, óf geen enkele. Dat geldt voor een reeks statements binnen <code>BEGIN TRAN ... COMMIT</code>, maar ook voor <strong>één enkel statement dat meerdere rijen raakt</strong>.</p>
<pre><code class="sql">-- Verhoog de prijs van alle producten van leverancier 4 met 10%
UPDATE Warehouse.StockItems
SET    UnitPrice = UnitPrice * 1.10
WHERE  SupplierID = 4;</code></pre>
<p>Stel dat er een CHECK-constraint is die zegt dat <code>UnitPrice &lt;= 1000</code> moet zijn, en één van de 30 producten zou boven die grens uitkomen. Dan worden <strong>niet</strong> de 29 geldige rijen opgeslagen: het hele statement faalt en <em>geen enkele</em> rij wordt gewijzigd. Pas als álle geraakte rijen geldig zijn, wordt de update uitgevoerd.</p>
<p>Voor meerdere statements gebruik je een expliciete transactie:</p>
<pre><code class="sql">BEGIN TRANSACTION;
    INSERT INTO Sales.Invoices (CustomerID, InvoiceDate) VALUES (105, GETDATE());
    INSERT INTO Sales.InvoiceLines (InvoiceID, StockItemID, Quantity)
    VALUES (SCOPE_IDENTITY(), 12, 3);
COMMIT TRANSACTION;</code></pre>
<p>Een factuur zonder regels (of regels zonder factuur) kan zo nooit ontstaan.</p>
<div class="callout warn"><strong>Let op</strong> Atomicity is geen instelling die je "aanzet" en heeft niets te maken met het aantal rijen dat je mag wijzigen of met het loggen naar een versietabel. Het is een standaardgarantie.</div>`
    },
    {
      title: "Consistency: regels blijven altijd waar",
      body: `<p>Consistency betekent dat de database na elke transactie weer aan <strong>alle regels</strong> voldoet. Die regels leg je vast met constraints. Een goede constraint dwingt een <em>continue waarheid</em> af: op elk moment, na elke INSERT én UPDATE, moet de regel kloppen.</p>
<pre><code class="sql">ALTER TABLE Sales.OrderLines
ADD CONSTRAINT CK_OrderLines_Quantity_Positief CHECK (Quantity &gt; 0);

INSERT INTO Sales.OrderLines (OrderID, StockItemID, Quantity)
VALUES (73001, 12, -5);   -- geweigerd: constraint wordt geschonden</code></pre>
<table>
<thead><tr><th>Constraint</th><th>Continue waarheid?</th><th>Waarom</th></tr></thead>
<tbody>
<tr><td>CHECK</td><td>Ja</td><td>Gecontroleerd bij elke insert en update</td></tr>
<tr><td>FOREIGN KEY</td><td>Ja</td><td>Een verwijzing moet altijd naar een bestaande rij wijzen</td></tr>
<tr><td>NOT NULL</td><td>Ja</td><td>De kolom mag nooit leeg zijn, ook niet na een update</td></tr>
<tr><td>UNIQUE / PRIMARY KEY</td><td>Ja</td><td>Er mogen nooit dubbele waarden zijn</td></tr>
<tr><td><strong>DEFAULT</strong></td><td><strong>Nee</strong></td><td>Vult alleen een beginwaarde in bij een INSERT als je niets opgeeft. Daarna mag je de waarde gewoon wijzigen in iets anders.</td></tr>
</tbody>
</table>
<div class="callout exam"><strong>Toetstip</strong> Een DEFAULT is een "beginwaarde", geen "regel". Hij is de uitzondering in het rijtje constraints, omdat hij niets blijvend afdwingt.</div>`
    },
    {
      title: "Isolation: niet bij elkaar in de weg zitten",
      body: `<p>Isolation zorgt dat gelijktijdige transacties geen last van elkaar hebben: jij ziet niet de halve wijzigingen van een ander. SQL Server regelt dat met <strong>locks</strong> en laat je de strengheid kiezen met een isolation level:</p>
<pre><code class="sql">SET TRANSACTION ISOLATION LEVEL READ COMMITTED;</code></pre>
<table>
<thead><tr><th>Level</th><th>Wat lees je?</th><th>Gevolg</th></tr></thead>
<tbody>
<tr><td>READ UNCOMMITTED</td><td>Alles, ook nog niet gecommitte wijzigingen (<em>dirty read</em>)</td><td>Je wacht nooit, maar ziet mogelijk data die later wordt teruggedraaid</td></tr>
<tr><td><strong>READ COMMITTED</strong> (default)</td><td>Alleen gecommitte data</td><td>Raakt jouw query data die een andere transactie aan het wijzigen is, dan <strong>wacht je</strong> tot die transactie klaar is</td></tr>
<tr><td>REPEATABLE READ</td><td>Gecommitte data, en zolang je leest blijft die gelijk</td><td>Anderen kunnen de rijen die jij gelezen hebt niet updaten tot jouw transactie klaar is</td></tr>
<tr><td>SNAPSHOT</td><td>De gecommitte versie van vóór andere lopende transacties</td><td>Geen wachten, wel extra geheugen/opslag voor rijversies. Moet op de database ingeschakeld zijn</td></tr>
</tbody>
</table>
<p>Waarom moet SNAPSHOT eerst aan? SQL Server moet dan van elke gewijzigde rij een oude versie bewaren (in <code>tempdb</code>). Dat <strong>kost geheugen en opslag en heeft impact op de performance</strong>, daarom is het opt-in:</p>
<pre><code class="sql">ALTER DATABASE WideWorldImporters SET ALLOW_SNAPSHOT_ISOLATION ON;</code></pre>
<div class="callout warn"><strong>Let op</strong> Bij READ COMMITTED wacht de <em>lezer</em> op een openstaande <em>schrijf</em>-transactie. Het is níet zo dat schrijvers moeten wachten tot jij klaar bent met lezen (dat is meer REPEATABLE READ), en queries worden ook niet tussentijds "alvast gecommit".</div>`
    },
    {
      title: "Durability: wat gecommit is, blijft",
      body: `<p>Krijg je in een ACID-database een succesmelding na een wijziging, dan weet je: <strong>alle wijzigingen zijn doorgevoerd en opgeslagen</strong>. Niet "ze staan in een wachtrij" of "ze worden straks verwerkt", maar definitief vastgelegd. SQL Server schrijft eerst naar het transaction log op disk voordat de commit wordt bevestigd.</p>
<p>Wat staat er standaard duurzaam op disk?</p>
<ul>
<li>Alle <strong>rijen</strong> (de tabelvulling)</li>
<li>Alle <strong>metadata</strong>: tabellen, views, stored procedures, indexes, triggers, constraints</li>
<li>Alle <strong>logins en users</strong> (in de master- resp. gebruikersdatabase)</li>
</ul>
<p>Wat staat er <strong>niet</strong> standaard op disk? De <strong>queries</strong> die je uitvoert en de resultaten van je SELECTs. Die zijn vluchtig; wil je queries bewaren, dan heb je extra tooling nodig (bijv. Query Store of een trace/profiler).</p>
<p>Gevolg: herstart je SQL Server (of valt de stroom uit), dan zijn je <strong>databasestructuur én je tabelvulling</strong> er gewoon nog. Alleen niet-gecommitte transacties worden bij het opstarten teruggedraaid.</p>
<div class="callout tip"><strong>Tip</strong> Onthoud: durability gaat over <em>gecommitte data en structuur</em>, niet over de geschiedenis van wat er gevraagd is.</div>`
    },
    {
      title: "Alles samen: één bestelling door ACID heen",
      body: `<p>Een webshop plaatst een bestelling: order + orderregels + voorraad verlagen.</p>
<pre><code class="sql">BEGIN TRANSACTION;
    INSERT INTO Sales.Orders (CustomerID, OrderDate) VALUES (832, GETDATE());
    DECLARE @OrderID INT = SCOPE_IDENTITY();

    INSERT INTO Sales.OrderLines (OrderID, StockItemID, Quantity)
    VALUES (@OrderID, 45, 2);

    UPDATE Warehouse.StockItemHoldings
    SET    QuantityOnHand = QuantityOnHand - 2
    WHERE  StockItemID = 45;      -- CHECK QuantityOnHand &gt;= 0 bewaakt de voorraad
COMMIT TRANSACTION;</code></pre>
<ul>
<li><strong>A</strong>: faalt de voorraadupdate, dan verdwijnen ook de order en de regel.</li>
<li><strong>C</strong>: de CHECK voorkomt negatieve voorraad, de FOREIGN KEY een regel zonder order.</li>
<li><strong>I</strong>: een collega die tegelijk de voorraad opvraagt (READ COMMITTED) ziet óf de oude óf de nieuwe stand, nooit iets halfs.</li>
<li><strong>D</strong>: na de COMMIT overleeft de bestelling een crash.</li>
</ul>`
    }
  ],
  keyPoints: [
    "ACID bestaat om <strong>zekerheden over je data</strong> te geven, niet voor performance.",
    "<strong>Atomicity</strong> = alles of niets; gewaarborgd door <strong>transacties</strong>.",
    "Een UPDATE op meerdere rijen slaagt alleen als <strong>alle</strong> geraakte rijen geldig zijn; anders wordt er niets gewijzigd.",
    "<strong>Consistency</strong> = alle regels blijven gelden; gewaarborgd door <strong>constraints</strong> (CHECK, FK, NOT NULL, UNIQUE).",
    "Een <code>DEFAULT</code> dwingt geen continue waarheid af: het is alleen een beginwaarde bij INSERT.",
    "<strong>Isolation</strong> regel je met locks en isolation levels; <code>READ COMMITTED</code> is de default en laat je wachten op openstaande transacties.",
    "<code>SNAPSHOT</code> moet op de database ingeschakeld worden omdat rijversies geheugen kosten en performance beïnvloeden.",
    "<strong>Durability</strong>: een succesmelding betekent dat de wijziging is doorgevoerd én opgeslagen.",
    "Rijen, metadata en users staan op disk; uitgevoerde queries niet.",
    "Na een herstart van SQL Server zijn structuur én data er nog."
  ],
  pitfalls: [
    { wrong: "Bij een UPDATE op 50 rijen worden de geldige rijen opgeslagen en de ongeldige overgeslagen.", right: "Atomicity: één ongeldige rij laat het hele statement mislukken. Er wordt dan geen enkele rij gewijzigd." },
    { wrong: "ACID is bedoeld om de database sneller te maken.", right: "ACID gaat over betrouwbaarheid en zekerheid. Strengere isolatie kost juist vaak performance." },
    { wrong: "Een DEFAULT-constraint bewaakt net als een CHECK continu de waarde van een kolom.", right: "Een DEFAULT vult alleen een waarde in bij een INSERT zonder opgegeven waarde. Daarna mag de kolom alles worden wat andere regels toestaan." },
    { wrong: "Een succesmelding betekent dat je query goedgekeurd is en de data binnenkort verwerkt wordt.", right: "In een ACID-database betekent een succesmelding dat alles al definitief doorgevoerd en opgeslagen is (durability)." },
    { wrong: "Durability betekent dat ook alle uitgevoerde queries bewaard blijven.", right: "Durability geldt voor data, metadata en users. Queries en SELECT-resultaten worden standaard niet op disk bewaard." },
    { wrong: "SNAPSHOT moet ingeschakeld worden omdat je er speciale rechten voor nodig hebt.", right: "Het moet aan omdat het bijhouden van rijversies geheugen/opslag kost en de performance beïnvloedt." },
    { wrong: "Indexes of temporal tables zorgen voor consistency.", right: "Consistency wordt geborgd door constraints zoals CHECK en FOREIGN KEY. Indexes zijn voor snelheid, temporal tables voor historie." }
  ],
  flashcards: [
    { front: "Waar staan de letters van ACID voor?", back: "Atomicity, Consistency, Isolation, Durability" },
    { front: "Een bank en een webshop kiezen allebei een ACID-database. Wat kopen ze daarmee?", back: "Garanties: wat de database bevestigt, klopt en blijft bewaard, ook bij gelijktijdig gebruik en storingen." },
    { front: "Atomicity in één zin", back: "Alles of niets: alle wijzigingen van een transactie gaan door, of geen enkele." },
    { front: "Je boekt een order én verlaagt de voorraad. Wat zet je eromheen zodat het nooit half gebeurt?", back: "<code>BEGIN TRAN</code> … <code>COMMIT</code>, met <code>ROLLBACK</code> als er iets misgaat." },
    { front: "Welk mechanisme waarborgt consistency?", back: "Constraints, zoals CHECK, FOREIGN KEY en NOT NULL." },
    { front: "Welke constraint dwingt GEEN continue waarheid af?", back: "<code>DEFAULT</code>: alleen een beginwaarde bij INSERT." },
    { front: "Isolation in één zin", back: "Tijdens het uitvoeren heeft een transactie geen bijeffecten voor anderen." },
    { front: "Wat is het default isolation level in SQL Server?", back: "<code>READ COMMITTED</code>" },
    { front: "Collega Ans wijzigt een orderregel en is nog niet klaar. Jij leest die regel onder het standaardniveau. Wat merk je?", back: "Je query staat te wachten op haar lock tot ze commit of terugdraait." },
    { front: "Wat moet SQL Server extra doen zodra SNAPSHOT aanstaat, en waarom is het daarom opt-in?", back: "Oude rijversies bewaren (in tempdb). Dat kost ruimte en snelheid, dus de beheerder kiest er bewust voor." },
    { front: "Durability in één zin", back: "Gecommitte wijzigingen zijn definitief, ook na een crash of herstart." },
    { front: "Je app krijgt 'OK' terug op een COMMIT en direct daarna crasht de server. Is de wijziging er nog?", back: "Ja. Een bevestigde commit staat al in het transaction log en overleeft de crash (durability)." },
    { front: "Wat wordt standaard NIET duurzaam op disk bewaard?", back: "De uitgevoerde queries (en resultaten van SELECTs)." },
    { front: "Welke ACID-letter belooft dat een herstart van de server niets van je gecommitte werk kwijtmaakt?", back: "De D van Durability: tabellen én hun inhoud zijn er na de herstart gewoon nog." }
  ],
  quiz: [
    {
      q: "Een DELETE-statement probeert 12 klanten te verwijderen. Bij 1 klant staat een FOREIGN KEY in de weg. Wat is het resultaat?",
      options: [
        "11 klanten worden verwijderd, 1 blijft staan",
        "De eerste klanten tot aan de foutieve worden verwijderd",
        "Er wordt geen enkele klant verwijderd",
        "Alle 12 worden verwijderd en de foreign key wordt tijdelijk uitgeschakeld"
      ],
      answer: 2,
      explain: "Atomicity geldt ook voor één statement: faalt één rij, dan faalt het hele statement en wordt er niets verwijderd. 'Alleen de geldige rijen' is precies wat atomicity voorkomt."
    },
    {
      q: "Welke ACID-eigenschap wordt vooral geschonden als een overboeking het geld wel van rekening A afhaalt, maar door een fout niet op rekening B bijschrijft?",
      options: ["Atomicity", "Consistency", "Isolation", "Durability"],
      answer: 0,
      explain: "Een half uitgevoerde reeks wijzigingen is een schending van 'alles of niets' (atomicity). Transacties lossen dit op."
    },
    {
      q: "Welk hulpmiddel zet je in om te voorkomen dat er een orderregel met een negatieve hoeveelheid wordt opgeslagen?",
      options: ["Een index op Quantity", "Een CHECK-constraint", "Een temporal table", "Isolation level SNAPSHOT"],
      answer: 1,
      explain: "Het afdwingen van regels hoort bij consistency en dat doe je met constraints. Een index versnelt alleen zoeken, een temporal table bewaart historie."
    },
    {
      q: "Een kolom <code>Status</code> heeft een DEFAULT 'Nieuw'. Wat garandeert dat?",
      options: [
        "Dat Status altijd 'Nieuw' is",
        "Dat Status nooit NULL kan worden",
        "Dat Status alleen gewijzigd kan worden door de eigenaar",
        "Dat Status 'Nieuw' krijgt als je bij een INSERT geen waarde opgeeft"
      ],
      answer: 3,
      explain: "Een DEFAULT is een beginwaarde bij INSERT, geen blijvende regel. Een latere UPDATE mag de waarde gewoon veranderen (en zelfs NULL maken als NOT NULL ontbreekt)."
    },
    {
      q: "Welke constraint is de vreemde eend in de bijt als het gaat om het continu afdwingen van een regel?",
      options: ["UNIQUE", "FOREIGN KEY", "DEFAULT", "CHECK"],
      answer: 2,
      explain: "UNIQUE, FOREIGN KEY en CHECK worden bij elke insert én update gecontroleerd. DEFAULT doet alleen iets op het moment van invoegen."
    },
    {
      q: "Je applicatie krijgt na een INSERT de melding '1 row affected' (transactie gecommit). Direct daarna crasht de server. Wat geldt er na het opstarten?",
      options: [
        "De rij staat in de tabel",
        "De rij moet opnieuw ingevoegd worden omdat hij in het geheugen stond",
        "De rij staat in een wachtrij en wordt opnieuw verwerkt",
        "Het is onzeker; dat hangt af van het isolation level"
      ],
      answer: 0,
      explain: "Durability: na een succesvolle commit is de wijziging definitief opgeslagen (eerst in het transaction log). Een crash maakt dat niet ongedaan."
    },
    {
      q: "Welke van deze zaken bewaart SQL Server standaard NIET duurzaam op disk?",
      options: [
        "De definitie van een stored procedure",
        "De SELECT-queries die gebruikers die dag hebben uitgevoerd",
        "De database users",
        "De rijen in Sales.Customers"
      ],
      answer: 1,
      explain: "Data, metadata (zoals procedures) en users zijn duurzaam. Uitgevoerde queries worden standaard niet bewaard; daarvoor heb je extra tooling nodig."
    },
    {
      q: "Je herstart de SQL Server-service. Wat tref je daarna aan?",
      options: [
        "Lege tabellen, maar de structuur is er nog",
        "Alleen de data die in de cache stond",
        "Alleen de tabellen die je expliciet hebt opgeslagen",
        "Structuur en data, behalve wijzigingen uit transacties die niet gecommit waren"
      ],
      answer: 3,
      explain: "Structuur en gecommitte data blijven bestaan (durability). Alleen openstaande, niet-gecommitte transacties worden bij het opstarten teruggedraaid."
    },
    {
      q: "Onder READ COMMITTED start jij een SELECT op Sales.Invoices, terwijl een collega in een openstaande transactie een factuur heeft gewijzigd die jouw query raakt. Wat gebeurt er?",
      options: [
        "Je ziet de gewijzigde, nog niet gecommitte waarde",
        "Je query wacht tot de transactie van je collega is afgerond",
        "De transactie van je collega wordt automatisch gecommit",
        "Je query geeft direct een permissiefout"
      ],
      answer: 1,
      explain: "READ COMMITTED leest alleen afgeronde data, dus je wacht op de lock. Het zien van niet-gecommitte data is READ UNCOMMITTED (dirty read)."
    },
    {
      q: "Waarom staat isolation level SNAPSHOT niet standaard aan op een database?",
      options: [
        "Omdat daarmee transacties niet meer teruggedraaid kunnen worden",
        "Omdat alleen sysadmins snapshots mogen lezen",
        "Omdat het bijhouden van oude rijversies geheugen kost en de performance raakt",
        "Omdat er dan maar één gebruiker tegelijk kan werken"
      ],
      answer: 2,
      explain: "SNAPSHOT bewaart versies van gewijzigde rijen, wat resources kost. Daarom is het opt-in. Rollback blijft gewoon mogelijk en het heeft niets met rechten te maken."
    },
    {
      q: "Welke ACID-eigenschap regel je met <code>SET TRANSACTION ISOLATION LEVEL</code>?",
      options: ["Atomicity", "Consistency", "Durability", "Isolation"],
      answer: 3,
      explain: "Isolation levels bepalen in hoeverre gelijktijdige transacties elkaars wijzigingen zien en op elkaar wachten."
    },
    {
      q: "Welke uitspraak over het doel van ACID is juist?",
      options: [
        "Het geeft garanties dat je data betrouwbaar en correct blijft",
        "Het zorgt ervoor dat tabellen automatisch genormaliseerd worden",
        "Het houdt automatisch een versiegeschiedenis van rijen bij",
        "Het maakt queries sneller door ze te parallelliseren"
      ],
      answer: 0,
      explain: "ACID draait om zekerheid over je data. Normaliseren is een ontwerpkeuze, versiegeschiedenis doen temporal tables en snelheid hoort bij performance."
    },
    {
      q: "Welke combinatie van ACID-eigenschap en mechanisme klopt?",
      options: [
        "Atomicity – indexes",
        "Consistency – profiler",
        "Atomicity – transacties",
        "Durability – CHECK-constraints"
      ],
      answer: 2,
      explain: "Transacties maken een reeks wijzigingen ondeelbaar (atomicity). CHECK-constraints horen bij consistency, niet bij durability."
    },
    {
      q: "Een UPDATE verhoogt het salaris van alle medewerkers in een afdeling. Er bestaat een CHECK dat het salaris maximaal 8000 mag zijn. Bij geen enkele medewerker wordt die grens overschreden. Wat gebeurt er?",
      options: [
        "De update faalt omdat een CHECK altijd een expliciete transactie vereist",
        "Alle rijen worden bijgewerkt",
        "Alleen de eerste rij wordt bijgewerkt",
        "De update wordt in de wachtrij gezet tot de CHECK opnieuw is gevalideerd"
      ],
      answer: 1,
      explain: "Als alle geraakte rijen geldig zijn, wordt de update in zijn geheel uitgevoerd. Een los statement zit al in een impliciete transactie."
    },
    {
      q: "Welke bewering over READ COMMITTED is ONJUIST?",
      options: [
        "Het is het standaard isolation level in SQL Server",
        "Je leest geen data uit nog openstaande transacties",
        "Je kunt moeten wachten tot een andere transactie klaar is",
        "Queries binnen een transactie worden tussentijds alvast gecommit"
      ],
      answer: 3,
      explain: "READ COMMITTED gaat over wat jij mag lezen. Het commit niets tussentijds; een transactie wordt pas definitief bij COMMIT."
    }
  ]
});
