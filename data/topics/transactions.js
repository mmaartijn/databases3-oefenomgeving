DB3.registerTopic({
  id: "transactions",
  intro: "Transacties zijn het werkpaard achter ACID: ze bundelen wijzigingen tot één eenheid en bepalen met locks wie wat mag zien. Wie snapt wanneer iets gecommit, teruggedraaid of geblokkeerd wordt, voorkomt halve data en 'hangende' queries.",
  sections: [
    {
      title: "Wat is een transactie?",
      body: `<p>Een transactie is een <strong>single unit of work</strong>: een groep wijzigingen die als geheel slaagt of als geheel mislukt. Je sluit een transactie altijd af met:</p>
<ul>
<li><code>COMMIT</code> – maak alle wijzigingen definitief</li>
<li><code>ROLLBACK</code> – maak alle wijzigingen ongedaan</li>
</ul>
<pre><code class="sql">BEGIN TRAN;   -- of BEGIN TRANSACTION
    UPDATE Warehouse.StockItemHoldings
    SET    QuantityOnHand = QuantityOnHand - 10
    WHERE  StockItemID = 220;

    INSERT INTO Warehouse.StockItemTransactions (StockItemID, Quantity, TransactionOccurredWhen)
    VALUES (220, -10, SYSDATETIME());
COMMIT;       -- of COMMIT TRAN / COMMIT TRANSACTION</code></pre>
<p>Transacties zijn hét mechanisme waarmee <strong>atomicity</strong> wordt afgedwongen. In de praktijk verpak je zo'n transactie vaak in een <strong>stored procedure</strong>, zodat een complete bedrijfshandeling (bestelling plaatsen, voorraad boeken) altijd als één geheel wordt uitgevoerd. Daarom zeggen we: atomicity dwing je vooral af met <strong>transacties en stored procedures</strong>.</p>`
    },
    {
      title: "Impliciete versus expliciete transacties",
      body: `<p><strong>Elke query zit in SQL Server automatisch in een (impliciete) transactie</strong>, ook als je geen <code>BEGIN TRAN</code> schrijft. Waarom? Om de ACID-principes te kunnen borgen: één UPDATE op 1000 rijen moet ook alles-of-niets zijn, geïsoleerd van anderen en duurzaam opgeslagen. Zo'n losse statement wordt na afloop automatisch gecommit (<em>autocommit</em>).</p>
<p>Belangrijk gevolg: een <strong>script</strong> met meerdere losse statements is <strong>niet</strong> automatisch één transactie. Elk statement is zijn eigen transactie.</p>
<pre><code class="sql">-- Script zonder BEGIN TRAN
INSERT INTO Application.Cities (CityName, StateProvinceID) VALUES ('Zwolle', 12);  -- slaagt, autocommit
INSERT INTO Application.Cities (CityName, StateProvinceID) VALUES ('Kampen', 9999); -- FK-fout</code></pre>
<p>Hier blijft 'Zwolle' gewoon in de tabel staan: dat statement was al afgerond en gecommit. Wil je dat beide samen slagen of falen, dan gebruik je een <strong>expliciete transactie</strong>:</p>
<pre><code class="sql">BEGIN TRY
    BEGIN TRAN;
        INSERT INTO Application.Cities (CityName, StateProvinceID) VALUES ('Zwolle', 12);
        INSERT INTO Application.Cities (CityName, StateProvinceID) VALUES ('Kampen', 9999);
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT &gt; 0 ROLLBACK;
    THROW;
END CATCH;</code></pre>
<div class="callout exam"><strong>Toetstip</strong> Impliciet = per statement. Een script of batch bundelt níet vanzelf alles in één transactie, en resultaten worden ook niet "aan het eind van het script" pas verwerkt.</div>`
    },
    {
      title: "Isolation levels en locking",
      body: `<p>Tijdens een transactie zet SQL Server <strong>locks</strong> op de rijen die je wijzigt. Andere sessies die dezelfde data willen lezen of wijzigen moeten (afhankelijk van het isolation level) wachten.</p>
<pre><code class="sql">SET TRANSACTION ISOLATION LEVEL READ COMMITTED;</code></pre>
<table>
<thead><tr><th>Level</th><th>Betekenis</th><th>Risico / kosten</th></tr></thead>
<tbody>
<tr><td>READ UNCOMMITTED</td><td>Lees alles uit alle transacties (<em>dirty read</em>)</td><td>Je ziet mogelijk data die door een ROLLBACK nooit in de database terechtkomt</td></tr>
<tr><td><strong>READ COMMITTED</strong> (default)</td><td>Je benadert alleen data waarvan de transacties zijn afgerond</td><td>Je wacht op openstaande transacties die jouw data raken</td></tr>
<tr><td>REPEATABLE READ</td><td>Zolang jij leest, kunnen anderen de gelezen rijen niet updaten</td><td>Meer blokkades</td></tr>
<tr><td>SNAPSHOT</td><td>Lees de data zoals die was vóór lopende transacties begonnen</td><td>Moet op de database ingeschakeld zijn; kost geheugen voor rijversies</td></tr>
</tbody>
</table>
<p><strong>Waarom wordt READ UNCOMMITTED afgeraden?</strong> Omdat je wijzigingen leest die nog niet definitief zijn. Wordt die andere transactie teruggedraaid, dan heb je beslissingen genomen op data die nooit heeft bestaan.</p>
<pre><code class="sql">-- Sessie 1
BEGIN TRAN;
UPDATE Sales.Customers SET CreditLimit = 50000 WHERE CustomerID = 10;
-- (nog geen COMMIT)

-- Sessie 2
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT CreditLimit FROM Sales.Customers WHERE CustomerID = 10;  -- ziet 50000

-- Sessie 1
ROLLBACK;   -- 50000 heeft officieel nooit bestaan</code></pre>
<div class="callout warn"><strong>Let op</strong> Dirty reads hebben niets te maken met permissies of check constraints: data die je leest heeft de constraints al doorstaan, en je rechten worden gewoon gecontroleerd. Het probleem is puur dat de data nog teruggedraaid kan worden.</div>`
    },
    {
      title: "Vergeten COMMIT: openstaande transacties en hangende queries",
      body: `<p>Begin je een transactie en sluit je hem niet af met COMMIT of ROLLBACK, dan krijg je <strong>geen foutmelding</strong>. De transactie blijft gewoon <strong>open staan</strong> en de gewijzigde data <strong>blijft gelocked</strong>, net zo lang tot je alsnog commit/rollbackt of je verbinding verbreekt (dan volgt een rollback). Er is geen automatische time-out van een paar seconden en geen "pauze"-keyword.</p>
<p>Het typische symptoom zie je bij een collega: zijn SELECT blijft eindeloos op <em>Executing query...</em> staan. Onder READ COMMITTED wacht zijn query namelijk op jouw uncommitted wijziging van dezelfde data.</p>
<pre><code class="sql">-- Venster A (vergeten te committen)
BEGIN TRAN;
UPDATE Purchasing.Suppliers SET PaymentDays = 14 WHERE SupplierID = 7;

-- Venster B: blijft 'hangen'
SELECT * FROM Purchasing.Suppliers WHERE SupplierID = 7;

-- Openstaande transacties opsporen
SELECT @@TRANCOUNT;          -- in venster A: 1
DBCC OPENTRAN;               -- oudste actieve transactie in de database</code></pre>
<div class="callout tip"><strong>Tip</strong> Hangt een query? Denk eerst aan een openstaande transactie die dezelfde rijen heeft gewijzigd, niet aan rechten (die geven direct een fout) of constraints (die spelen bij een SELECT geen rol).</div>`
    },
    {
      title: "Triggers horen bij de transactie",
      body: `<p>Een trigger wordt uitgevoerd <strong>binnen</strong> de transactie van het statement dat hem afvuurt. De wijzigingen die de trigger doet horen dus bij dezelfde actie. Gevolgen:</p>
<ul>
<li>Gaat er in de trigger iets mis (of roept de trigger <code>ROLLBACK</code> aan), dan wordt <strong>alles</strong> teruggedraaid: het oorspronkelijke statement én de triggerwijzigingen.</li>
<li>Roep je na het afgaan van de triggers zelf <code>ROLLBACK</code> aan, dan worden <strong>alle wijzigingen inclusief die van de triggers</strong> ongedaan gemaakt.</li>
<li>De trigger kan gewoon bij de gelockte data, want hij draait in dezelfde transactie.</li>
</ul>
<pre><code class="sql">CREATE TRIGGER TR_OrderLines_I ON Sales.OrderLines
AFTER INSERT
AS
BEGIN
    UPDATE h
    SET    h.QuantityOnHand = h.QuantityOnHand - i.Quantity
    FROM   Warehouse.StockItemHoldings h
    INNER JOIN inserted i ON i.StockItemID = h.StockItemID;
END;
GO

BEGIN TRAN;
    INSERT INTO Sales.OrderLines (OrderID, StockItemID, Quantity) VALUES (500, 45, 3);
    -- trigger heeft de voorraad al verlaagd
ROLLBACK;  -- orderregel én voorraadverlaging zijn weg</code></pre>
<div class="callout exam"><strong>Toetstip</strong> Triggers worden niet "na de commit" uitgevoerd en maken een transactie ook niet definitief. Zolang er niet gecommit is, kun je alles terugdraaien.</div>`
    },
    {
      title: "Stroomuitval midden in een transactie",
      body: `<p>Valt de server uit terwijl een transactie nog loopt (dus vóór de COMMIT), dan voert SQL Server bij het opstarten een <strong>recovery</strong> uit met het transaction log:</p>
<ul>
<li>Gecommitte transacties worden zo nodig opnieuw doorgevoerd (durability).</li>
<li>Niet-gecommitte transacties worden <strong>volledig teruggedraaid</strong> (atomicity).</li>
</ul>
<p>Het resultaat: de database is precies in de toestand van vóór die transactie. De al verwerkte rijen zijn níet terug te vinden, en de transactie wordt ook niet automatisch hervat of opnieuw geprobeerd. Dat moet je applicatie zelf doen.</p>`
    }
  ],
  keyPoints: [
    "Een transactie is een <strong>single unit of work</strong>, afgesloten met <code>COMMIT</code> (definitief) of <code>ROLLBACK</code> (ongedaan).",
    "Atomicity dwing je vooral af met <strong>transacties en stored procedures</strong>.",
    "<strong>Elke query</strong> zit in een impliciete transactie, om ACID te kunnen borgen.",
    "Een script met losse statements is géén transactie: faalt statement 2, dan blijft statement 1 gewoon staan.",
    "<code>READ COMMITTED</code> (default): je benadert alleen data waarvan de transacties afgerond zijn.",
    "<code>READ UNCOMMITTED</code> wordt afgeraden: je kunt data zien die door een rollback nooit in de database komt (dirty read).",
    "Geen COMMIT/ROLLBACK = transactie blijft open en de data blijft <strong>gelocked</strong>.",
    "Een eindeloos 'hangende' SELECT wijst meestal op een <strong>uncommitted transactie</strong> op dezelfde data.",
    "Triggers draaien <strong>binnen</strong> de transactie; een ROLLBACK draait ook de triggerwijzigingen terug.",
    "Stroomuitval midden in een transactie: na recovery is de database zoals vóór de transactie."
  ],
  pitfalls: [
    { wrong: "Alle statements in één script zitten automatisch in dezelfde transactie.", right: "Zonder BEGIN TRAN is elk statement een eigen (impliciete) transactie die direct gecommit wordt. Eerdere geslaagde statements blijven staan." },
    { wrong: "Als je vergeet te committen, krijg je een foutmelding of wordt de transactie na korte tijd automatisch teruggedraaid.", right: "De transactie blijft gewoon open staan en houdt zijn locks vast tot COMMIT, ROLLBACK of het verbreken van de verbinding." },
    { wrong: "Triggers worden pas na de COMMIT uitgevoerd, dus hun wijzigingen kun je niet meer terugdraaien.", right: "Triggers draaien binnen de transactie. Een ROLLBACK maakt ook de wijzigingen van de triggers ongedaan." },
    { wrong: "READ UNCOMMITTED is gevaarlijk omdat je data ziet waar je geen rechten op hebt.", right: "Het probleem is de dirty read: je leest wijzigingen die nog teruggedraaid kunnen worden en dus nooit definitief in de database komen." },
    { wrong: "Na stroomuitval zijn de al verwerkte rijen van een lopende transactie bewaard.", right: "Niet-gecommitte transacties worden bij het opstarten volledig teruggedraaid. De database staat zoals vóór de transactie." },
    { wrong: "Een SELECT die blijft hangen komt door ontbrekende rechten.", right: "Ontbrekende rechten geven direct een foutmelding. Wachten wijst op een lock van een openstaande transactie." },
    { wrong: "Je hoeft geen impliciete transacties te hebben; die bestaan alleen omdat losse queries geen BEGIN TRAN kunnen bevatten.", right: "Impliciete transacties bestaan om ACID ook voor één los statement te garanderen." }
  ],
  flashcards: [
    { front: "Wat is een transactie?", back: "Een single unit of work: alle wijzigingen slagen samen of worden samen ongedaan gemaakt." },
    { front: "Twee manieren om een transactie af te sluiten", back: "<code>COMMIT</code> (definitief maken) of <code>ROLLBACK</code> (ongedaan maken)." },
    { front: "Je wilt dat een app een bestelling altijd in één geheel vastlegt. Welke twee databasemiddelen combineer je?", back: "Een transactie, verpakt in een stored procedure die de app aanroept." },
    { front: "Een UPDATE op 10.000 rijen zonder BEGIN TRAN faalt bij rij 9.000. Hoeveel rijen zijn gewijzigd?", back: "Nul. Elk statement is op zich al een (autocommit-)transactie, dus het gaat helemaal of niet door." },
    { front: "Script: insert 1 slaagt, insert 2 faalt (geen BEGIN TRAN). Wat met insert 1?", back: "Die blijft staan: elk statement was een eigen, al gecommitte transactie." },
    { front: "Onder welk isolation level kan een SELECT nooit een half afgemaakte wijziging van een ander tonen, maar moet hij soms wachten?", back: "<code>READ COMMITTED</code>, het standaardniveau." },
    { front: "Wat is een dirty read?", back: "Het lezen van niet-gecommitte data (READ UNCOMMITTED) die nog teruggedraaid kan worden." },
    { front: "Een rapport toont een order van € 5.000 die even later niet blijkt te bestaan. Welk isolation level gebruikte het rapport waarschijnlijk?", back: "<code>READ UNCOMMITTED</code>: het las een wijziging die daarna is teruggedraaid (dirty read)." },
    { front: "Je voert in SSMS BEGIN TRAN + UPDATE uit en gaat lunchen. Wat merken collega's?", back: "Hun queries op die rijen hangen: jouw open transactie houdt de locks vast." },
    { front: "Waarmee spoor je op welke sessie een open transactie heeft die jou blokkeert?", back: "<code>DBCC OPENTRAN</code> of <code>sp_who2</code> / Activity Monitor (kolom BlkBy)." },
    { front: "Een AFTER INSERT-trigger schrijft een logregel. Daarna faalt de transactie. Staat de logregel er nog?", back: "Nee. De trigger draaide in dezelfde transactie, dus de logregel wordt mee teruggedraaid." },
    { front: "BEGIN TRAN; UPDATE (een trigger past 3 andere tabellen aan); ROLLBACK. Wat blijft er over?", back: "Niets: de update én alle triggerwijzigingen zijn weg." },
    { front: "Stroom valt uit midden in een transactie. Toestand daarna?", back: "Exact zoals vóór de transactie (rollback tijdens recovery)." },
    { front: "Hoe zie je of je sessie een open transactie heeft?", back: "<code>SELECT @@TRANCOUNT</code> (&gt; 0 = open), of <code>DBCC OPENTRAN</code>." },
    { front: "Welke isolation levels moeten op de database ingeschakeld worden?", back: "SNAPSHOT (volgens de slides ook REPEATABLE READ)." }
  ],
  quiz: [
    {
      q: "Je voert dit script uit zonder BEGIN TRAN. Het UPDATE-statement faalt op een CHECK-constraint. Wat is de stand van zaken?",
      code: "DELETE FROM Sales.SpecialDeals WHERE EndDate < '2015-01-01';\nUPDATE Sales.SpecialDeals SET DiscountPercentage = 150 WHERE SpecialDealID = 3;",
      options: [
        "Beide statements worden teruggedraaid",
        "De verwijderde deals zijn echt weg, de update is niet uitgevoerd",
        "De DELETE wordt gemarkeerd en pas verwerkt als de UPDATE slaagt",
        "Niets is uitgevoerd, want het script wordt pas aan het eind verwerkt"
      ],
      answer: 1,
      explain: "Elk los statement is een eigen impliciete transactie met autocommit. De DELETE was al afgerond. Alleen met een expliciete transactie (en rollback) zou hij teruggedraaid worden."
    },
    {
      q: "Wat is de belangrijkste reden dat SQL Server ook een enkel UPDATE-statement in een (impliciete) transactie uitvoert?",
      options: [
        "Zodat het statement in de profiler gelogd kan worden",
        "Zodat de optimizer de juiste index kan kiezen",
        "Zodat ACID ook voor dat ene statement gegarandeerd is",
        "Omdat een losse query geen BEGIN TRAN mag bevatten"
      ],
      answer: 2,
      explain: "Ook één statement op veel rijen moet alles-of-niets, geïsoleerd en duurzaam zijn. Logging en indexkeuze staan los van transacties."
    },
    {
      q: "Een collega meldt: 'Mijn SELECT op Warehouse.StockItems staat al vijf minuten te draaien, terwijl hij normaal in een seconde klaar is.' Wat is de meest waarschijnlijke oorzaak?",
      options: [
        "Iemand heeft rijen uit die tabel gewijzigd in een transactie die nog niet gecommit is",
        "Zijn SELECT-recht op de tabel is ingetrokken",
        "Er staan te veel CHECK-constraints op de tabel",
        "Het isolation level staat op READ UNCOMMITTED"
      ],
      answer: 0,
      explain: "Onder READ COMMITTED wacht een lezer op locks van een openstaande schrijftransactie. Ontbrekende rechten geven direct een fout; READ UNCOMMITTED zou juist nooit wachten."
    },
    {
      q: "Je voert in SSMS <code>BEGIN TRAN</code> en een UPDATE uit en gaat koffie halen zonder te committen. Wat is er ondertussen aan de hand?",
      options: [
        "SQL Server geeft een fout omdat COMMIT ontbreekt",
        "Na een korte time-out wordt de update automatisch teruggedraaid",
        "De update is al definitief, COMMIT is alleen een formaliteit",
        "De transactie staat open en de gewijzigde rijen blijven gelocked"
      ],
      answer: 3,
      explain: "Een open transactie blijft bestaan met al zijn locks tot COMMIT, ROLLBACK of het verbreken van de verbinding. Er is geen standaard time-out."
    },
    {
      q: "Welk risico loop je met <code>SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED</code>?",
      options: [
        "Je leest rijen die nooit door de constraints zijn gecontroleerd",
        "Je beslist op basis van waarden die later door een ROLLBACK verdwijnen",
        "Je omzeilt de permissies van de database",
        "Je verbinding blijft open, waardoor alles trager wordt"
      ],
      answer: 1,
      explain: "Dirty reads: je ziet niet-gecommitte wijzigingen. Wordt die transactie teruggedraaid, dan heb je data gelezen die nooit definitief bestond. Constraints en rechten blijven gewoon gelden."
    },
    {
      q: "Sessie A heeft een rij gewijzigd maar nog niet gecommit. Sessie B leest die rij onder READ COMMITTED. Wat klopt?",
      options: [
        "B leest de nieuwe, nog niet gecommitte waarde",
        "B krijgt direct een foutmelding",
        "B wacht tot A commit of terugdraait",
        "B leest de oude waarde uit een rijversie"
      ],
      answer: 2,
      explain: "Onder READ COMMITTED lees je alleen afgeronde wijzigingen. Zolang A de rij vasthoudt, wacht B. Een oude rijversie lezen gebeurt pas met SNAPSHOT of READ_COMMITTED_SNAPSHOT."
    },
    {
      q: "Een AFTER INSERT-trigger op <code>Sales.Invoices</code> schrijft een regel naar een logtabel. Daarna wordt de transactie met ROLLBACK afgesloten. Wat staat er nog?",
      options: [
        "Niets: zowel de factuur als de logregel zijn teruggedraaid",
        "Alleen de logregel, want de trigger was al uitgevoerd",
        "Alleen de factuur, want ROLLBACK raakt alleen het eigen statement",
        "Allebei, want een trigger maakt de transactie definitief"
      ],
      answer: 0,
      explain: "De trigger draait binnen dezelfde transactie, dus een ROLLBACK maakt ook zijn wijzigingen ongedaan."
    },
    {
      q: "Waarom kan een trigger bij data die net door het afvurende statement is gewijzigd en dus gelocked is?",
      options: [
        "Triggers negeren locks altijd",
        "De trigger draait pas nadat de transactie gecommit is",
        "De trigger gebruikt automatisch READ UNCOMMITTED",
        "De trigger draait binnen dezelfde transactie die de locks heeft"
      ],
      answer: 3,
      explain: "Locks blokkeren andere transacties, niet de eigen transactie. Omdat de trigger onderdeel is van die transactie, kan hij bij de data."
    },
    {
      q: "Tijdens een grote batch-update van 200.000 rijen in één transactie valt de stroom uit na 120.000 rijen. Hoe ziet de tabel eruit na het opstarten?",
      options: [
        "De eerste 120.000 rijen zijn bijgewerkt",
        "Precies zoals vóór de transactie",
        "De update wordt automatisch hervat bij rij 120.001",
        "De tabel is corrupt en moet uit een backup komen"
      ],
      answer: 1,
      explain: "Tijdens recovery wordt de niet-gecommitte transactie volledig teruggedraaid via het transaction log. Er is geen automatische hervatting."
    },
    {
      q: "Welke combinatie zorgt er volgens de cursus vooral voor dat een complete bedrijfshandeling 'alles of niets' wordt uitgevoerd?",
      options: [
        "Indexes en de profiler",
        "Check constraints",
        "Transacties en stored procedures",
        "Triggers"
      ],
      answer: 2,
      explain: "Atomicity draait om transacties; door ze in een stored procedure te verpakken voer je een handeling altijd als één geheel uit. Check constraints horen bij consistency."
    },
    {
      q: "Wat geeft deze code terug als de sessie nog één open transactie heeft?",
      code: "SELECT @@TRANCOUNT;",
      options: ["0", "1", "NULL", "Een foutmelding omdat de transactie open staat"],
      answer: 1,
      explain: "@@TRANCOUNT telt het aantal actieve transacties in de sessie. Na elke BEGIN TRAN gaat hij omhoog, COMMIT verlaagt hem en ROLLBACK zet hem op 0."
    },
    {
      q: "Je wilt dat twee INSERTs samen slagen of samen falen. Welke aanpak is juist?",
      options: [
        "Ze onder elkaar in hetzelfde script zetten",
        "Ze scheiden met GO",
        "Het isolation level op SERIALIZABLE zetten",
        "Ze tussen BEGIN TRAN en COMMIT zetten, met een ROLLBACK bij een fout"
      ],
      answer: 3,
      explain: "Alleen een expliciete transactie bundelt meerdere statements. Een script of batch doet dat niet en een isolation level regelt zichtbaarheid, geen atomicity."
    },
    {
      q: "Wat is de default isolation level van SQL Server?",
      options: ["READ COMMITTED", "READ UNCOMMITTED", "REPEATABLE READ", "SNAPSHOT"],
      answer: 0,
      explain: "READ COMMITTED is de standaard: je leest alleen gecommitte data en wacht zo nodig op openstaande transacties."
    },
    {
      q: "Welke bewering over een openstaande (niet afgesloten) transactie is juist?",
      options: [
        "Je kunt hem pauzeren en later hervatten met een speciaal keyword",
        "Hij wordt automatisch gecommit zodra een andere sessie dezelfde data leest",
        "Hij blijft locks vasthouden waardoor andere sessies kunnen moeten wachten",
        "Hij kan niet meer worden teruggedraaid na een paar seconden"
      ],
      answer: 2,
      explain: "Een open transactie houdt zijn locks vast. Andere sessies wachten; er wordt niets automatisch gecommit of gepauzeerd."
    },
    {
      q: "Een INSTEAD OF- of AFTER-trigger gooit een fout op. Wat gebeurt er met het INSERT-statement dat de trigger afvuurde?",
      options: [
        "De insert blijft staan; alleen de trigger faalt",
        "De insert wordt mee teruggedraaid, omdat hij in dezelfde transactie zit",
        "De insert wordt opnieuw geprobeerd zonder trigger",
        "De insert blijft gelocked tot een beheerder hem goedkeurt"
      ],
      answer: 1,
      explain: "De trigger maakt deel uit van de transactie van het statement. Een fout in de trigger draait de hele actie terug."
    }
  ]
});
