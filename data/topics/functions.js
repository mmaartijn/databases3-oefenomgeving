DB3.registerTopic({
  id: "functions",
  intro: "Functies bundelen herbruikbare logica die je midden in een SELECT kunt gebruiken. Het belangrijkste verschil met een stored procedure: een functie leest en rekent, maar wijzigt geen data. Samen met een security policy vormen functies de basis van Row Level Security.",
  sections: [
    {
      title: "Wat is een user defined function?",
      body: `<p>Een <strong>UDF</strong> (<em>User Defined Function</em>) is een functie die jij zelf in de database definieert, naast de ingebouwde functies als <code>GETDATE()</code>, <code>LEN()</code> of <code>IS_MEMBER()</code>. Naamgeving: <code>UDF_{Naam}</code>.</p>
<ul>
<li>Voert <strong>herbruikbare logica</strong> uit op de server (bijv. prijs inclusief btw berekenen).</li>
<li>Accepteert <strong>nul of meer</strong> parameters.</li>
<li>Geeft <strong>één waarde</strong> of <strong>een tabel</strong> terug.</li>
<li>Is te gebruiken <strong>in een SELECT</strong>: in de kolomlijst, de WHERE, een JOIN of de FROM.</li>
</ul>
<p>Van alle database-objecten (procedure, trigger, transactie, functie) is de functie de enige die je rechtstreeks in een SELECT-statement kunt aanroepen.</p>
<div class="callout exam"><strong>Toetstip</strong> De grote beperking: een functie mag <strong>geen data modificeren</strong>. Geen INSERT, UPDATE of DELETE op tabellen, en ook geen stored procedure aanroepen. Wil je data wijzigen, dan heb je een stored procedure nodig.</div>`
    },
    {
      title: "Scalar valued functions",
      body: `<p>Een <strong>scalar valued function</strong> geeft precies <strong>één enkelvoudige waarde</strong> terug (een INT, DECIMAL, VARCHAR, ...). Je gebruikt hem zoals een ingebouwde functie.</p>
<pre><code class="sql">CREATE FUNCTION Sales.UDF_PrijsInclBtw (@Prijs DECIMAL(18,2), @BtwPct DECIMAL(5,2))
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN @Prijs * (1 + @BtwPct / 100);
END;
GO

SELECT StockItemName,
       UnitPrice,
       Sales.UDF_PrijsInclBtw(UnitPrice, TaxRate) AS PrijsInclBtw
FROM   Warehouse.StockItems
WHERE  Sales.UDF_PrijsInclBtw(UnitPrice, TaxRate) &gt; 100;</code></pre>
<p>Een scalar function aggregeert géén groep rijen (dat doen <code>SUM</code>, <code>AVG</code>, ...) en draait niet als eigen transactie.</p>`
    },
    {
      title: "Table valued functions en tabelparameters",
      body: `<p>Een <strong>table valued function</strong> (TVF) geeft een <strong>tabel</strong> terug. Je gebruikt hem in de FROM of in een JOIN, als een soort view met parameters:</p>
<pre><code class="sql">CREATE FUNCTION Application.UDF_CityIdsForUserRole()
RETURNS TABLE
AS
RETURN
(
    SELECT c.CityID
    FROM   Application.Cities c
    JOIN   Application.StateProvinces sp ON sp.StateProvinceID = c.StateProvinceID
    WHERE  IS_MEMBER(sp.SalesTerritory + ' Sales') = 1
);
GO

SELECT cus.CustomerName, city.CityName
FROM   Sales.Customers cus
JOIN   Application.Cities city                       ON city.CityID = cus.PostalCityID
JOIN   Application.UDF_CityIdsForUserRole() ids     ON ids.CityID  = city.CityID;</code></pre>
<p>Een functie kan als input krijgen: <strong>geen parameters</strong>, <strong>scalar parameters</strong> én <strong>table valued parameters</strong>. Voor dat laatste maak je eerst een tabeltype; de parameter is altijd <code>READONLY</code>:</p>
<pre><code class="sql">CREATE TYPE dbo.IdLijst AS TABLE (Id INT PRIMARY KEY);
GO
CREATE FUNCTION Sales.UDF_TotaalVoorKlanten (@Klanten dbo.IdLijst READONLY)
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN (SELECT SUM(TransactionAmount)
            FROM   Sales.CustomerTransactions t
            JOIN   @Klanten k ON k.Id = t.CustomerID);
END;</code></pre>`
    },
    {
      title: "Ingebouwde functies die je moet kennen",
      body: `<p>Veel vragen in dit vak draaien om functies die SQL Server al meelevert:</p>
<table>
<thead><tr><th>Functie</th><th>Wat</th></tr></thead>
<tbody>
<tr><td><code>IS_MEMBER('rol')</code></td><td>1 als de huidige gebruiker in de rol zit. Zo controleer je in een query of iemand een bepaalde rol heeft.</td></tr>
<tr><td><code>USER_NAME()</code></td><td>Naam van de huidige database user.</td></tr>
<tr><td><code>Location.STAsText()</code></td><td>Tekstuele (WKT) weergave van een geography/geometry-waarde. Een methode, dus ook een functie, niet een CAST.</td></tr>
<tr><td><code>JSON_VALUE()</code>, <code>OPENJSON()</code></td><td>Waarden uit JSON halen.</td></tr>
</tbody>
</table>
<p><strong>Voordelen</strong> van UDF's: herbruikbare logica op één plek, data filteren in een query, en ze zijn (net als procedures) gecompileerd. Wat een functie <strong>niet</strong> kan: <em>reageren</em> op datawijzigingen. Dat is het terrein van triggers.</p>`
    },
    {
      title: "Row Level Security (RLS)",
      body: `<p>Met <strong>Row Level Security</strong> filter je automatisch welke <em>rijen</em> een gebruiker ziet, zonder dat hij dat via een view hoeft te doen. Je hebt twee onderdelen nodig:</p>
<ol>
<li>Een <strong>inline table valued function</strong> (het predicaat) die per rij 1 teruggeeft als de rij zichtbaar mag zijn.</li>
<li>Een <strong>security policy</strong> die die functie als filter aan een tabel koppelt.</li>
</ol>
<pre><code class="sql">CREATE FUNCTION Security.UDF_MagProvincieZien (@StateProvinceID INT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS Toegestaan
    FROM   Application.StateProvinces sp
    WHERE  sp.StateProvinceID = @StateProvinceID
      AND  IS_MEMBER(sp.SalesTerritory + ' Sales') = 1;
GO

CREATE SECURITY POLICY Security.CityFilter
ADD FILTER PREDICATE Security.UDF_MagProvincieZien(StateProvinceID)
    ON Application.Cities
WITH (STATE = ON);</code></pre>
<p>Voert een verkoper nu <code>SELECT * FROM Application.Cities</code> uit, dan krijgt hij alleen de steden in zijn eigen gebied. De policy roept dus een <strong>functie</strong> aan, geen view, procedure of index.</p>`
    }
  ],
  keyPoints: [
    "UDF = <strong>User Defined Function</strong>.",
    "Een functie accepteert 0, scalar- of table valued parameters en geeft één waarde of een tabel terug.",
    "<strong>Scalar valued</strong> = één enkelvoudige waarde terug; <strong>table valued</strong> = een tabel terug.",
    "Functies kun je gebruiken in een SELECT (kolommen, WHERE, JOIN, FROM); procedures en triggers niet.",
    "Een functie mag <strong>geen data wijzigen</strong> en geen stored procedure aanroepen.",
    "Table valued parameters gaan via een zelfgedefinieerd tabeltype en zijn <code>READONLY</code>.",
    "<code>IS_MEMBER('rol')</code> controleert of de huidige gebruiker een rol heeft.",
    "De tekst van een geography haal je op met de methode <code>STAsText()</code>.",
    "Voordelen: herbruikbaarheid, filteren in queries, gecompileerd. Reageren op wijzigingen kan een functie niet.",
    "Row Level Security = security policy met een filterpredicaat dat een <strong>functie</strong> aanroept."
  ],
  pitfalls: [
    { wrong: "Met een table valued function kun je rijen in een tabel bijwerken.", right: "Geen enkele UDF mag data wijzigen. Daarvoor gebruik je een stored procedure." },
    { wrong: "Een functie kan geen tabel als parameter krijgen.", right: "Dat kan, via een table valued parameter (zelfgedefinieerd tabeltype, READONLY)." },
    { wrong: "Een scalar function vat een groep rijen samen tot één record.", right: "Dat doen aggregaatfuncties als SUM en AVG. Een scalar UDF geeft één enkelvoudige waarde terug." },
    { wrong: "Een stored procedure kun je net als een functie in een SELECT gebruiken.", right: "Alleen functies kun je in een SELECT gebruiken. Een procedure start je met EXEC." },
    { wrong: "Voor Row Level Security koppel je een view of index aan de tabel.", right: "Je maakt een security policy met een filterpredicaat dat een inline table valued function aanroept." },
    { wrong: "Een UDF kan automatisch reageren als er rijen worden toegevoegd.", right: "Reageren op datawijzigingen is de taak van een trigger. Een functie draait alleen als hij aangeroepen wordt." }
  ],
  flashcards: [
    { front: "Waar staat UDF voor?", back: "User Defined Function." },
    { front: "Wat geeft een scalar valued function terug?", back: "Eén enkelvoudige waarde (bijv. een INT of VARCHAR)." },
    { front: "Wat geeft een table valued function terug?", back: "Een tabel, die je in de FROM of een JOIN gebruikt." },
    { front: "Je wilt een complete lijst orderregels in één keer aan een functie meegeven. Kan dat, en hoe?", back: "Ja: met een table-valued parameter van een user-defined table type, gemarkeerd als <code>READONLY</code>. Functies zonder parameters of met scalars kunnen ook." },
    { front: "Grootste beperking van een functie", back: "Hij mag geen data in de database wijzigen." },
    { front: "Welk object kun je direct in een SELECT gebruiken: functie, procedure of trigger?", back: "De functie." },
    { front: "Hoe controleer je in een query of de huidige gebruiker een rol heeft?", back: "<code>IS_MEMBER('rolnaam')</code>" },
    { front: "Hoe krijg je de tekst van een geography-waarde?", back: "Met de functie/methode <code>.STAsText()</code>." },
    { front: "Wat heb je nodig voor Row Level Security?", back: "Een inline table valued function als predicaat + een SECURITY POLICY met FILTER PREDICATE." },
    { front: "Een collega wil dat een UDF vanzelf afgaat zodra er een order binnenkomt. Waarom kan dat niet, en wat gebruik je dan wel?", back: "Een functie draait alleen als je hem aanroept. Automatisch reageren op wijzigingen doet een trigger." },
    { front: "Hoe geef je een tabel mee aan een functie?", back: "Maak een tabeltype (<code>CREATE TYPE ... AS TABLE</code>) en declareer de parameter <code>READONLY</code>." }
  ],
  quiz: [
    {
      q: "Je wilt in een SELECT per product de prijs inclusief btw tonen via herbruikbare logica op de server. Welk object gebruik je?",
      options: ["Een trigger", "Een stored procedure", "Een scalar valued function", "Een transactie"],
      answer: 2,
      explain: "Een scalar function geeft één waarde terug en kun je per rij in de SELECT-lijst aanroepen. Een procedure kun je niet in een SELECT gebruiken."
    },
    {
      q: "Wat typeert een scalar valued function?",
      options: [
        "Hij geeft één enkelvoudige waarde terug",
        "Hij vat een groep rijen samen tot één rij",
        "Hij heeft altijd precies één parameter",
        "Hij wordt altijd als aparte transactie uitgevoerd"
      ],
      answer: 0,
      explain: "Scalar = één simpele waarde. Aggregeren is iets anders, en een scalar function mag 0 of meer parameters hebben."
    },
    {
      q: "Een collega wil met een table valued function bij elke aanroep ook een logregel in de tabel <code>dbo.AuditLog</code> schrijven. Wat zeg je?",
      options: [
        "Dat kan als de functie WITH SCHEMABINDING heeft",
        "Dat kan alleen met een scalar function",
        "Dat kan als je de logtabel als parameter meegeeft",
        "Dat kan niet: een functie mag geen data wijzigen"
      ],
      answer: 3,
      explain: "Geen enkele UDF mag INSERT/UPDATE/DELETE op tabellen doen. Gebruik een stored procedure."
    },
    {
      q: "Kun je een lijst met klant-ID's als tabel aan een functie meegeven?",
      options: [
        "Nee, functies accepteren alleen scalar parameters",
        "Ja, via een table valued parameter van een zelfgedefinieerd tabeltype",
        "Nee, een functie kan alleen tabellen teruggeven, niet ontvangen",
        "Ja, door de tabelnaam als VARCHAR mee te geven"
      ],
      answer: 1,
      explain: "Met CREATE TYPE ... AS TABLE maak je een tabeltype; de parameter declareer je als READONLY."
    },
    {
      q: "Welke van deze objecten kun je rechtstreeks in de FROM- of kolomlijst van een SELECT gebruiken?",
      options: ["Een trigger", "Een stored procedure", "Een transactie", "Een user defined function"],
      answer: 3,
      explain: "Functies (scalar of table valued) kun je in een SELECT gebruiken. Procedures roep je aan met EXEC; triggers gaan vanzelf af."
    },
    {
      q: "Welke van deze drie functiekoppen is geldig in SQL Server? (1) <code>dbo.UDF_Vandaag()</code> (2) <code>dbo.UDF_Btw(@bedrag money)</code> (3) <code>dbo.UDF_Totaal(@regels dbo.OrderRegelType READONLY)</code>",
      options: [
        "Alleen 2",
        "1 en 2, maar niet 3",
        "2 en 3, maar niet 1",
        "Alle drie"
      ],
      answer: 3,
      explain: "Een functie mag geen parameters hebben, scalar parameters hebben of een table-valued parameter (READONLY, van een user-defined table type) krijgen."
    },
    {
      q: "Een team wil een UDF voor drie taken inzetten. Bij welke taak is een UDF NIET het juiste middel?",
      options: [
        "Een kortingsberekening één keer vastleggen en in tien queries hergebruiken",
        "In een WHERE filteren op een berekende waarde",
        "Een logregel wegschrijven zodra iemand een klant wijzigt",
        "De rijen bepalen die een gebruiker mag zien (RLS-predicaat)"
      ],
      answer: 2,
      explain: "Reageren op een wijziging is het werk van een trigger; een functie draait alleen als iemand hem aanroept en mag bovendien geen data wijzigen."
    },
    {
      q: "Hoe controleer je binnen een query of de huidige gebruiker lid is van de rol <code>Sales Managers</code>?",
      options: [
        "<code>EXEC sp_helprolemember 'Sales Managers'</code>",
        "<code>IS_MEMBER('Sales Managers')</code>",
        "<code>SELECT * FROM sys.database_roles WHERE name = USER_NAME()</code>",
        "Via de SQL Server Profiler"
      ],
      answer: 1,
      explain: "IS_MEMBER is een ingebouwde functie die 1 of 0 teruggeeft en die je in een WHERE kunt gebruiken."
    },
    {
      q: "De kolom <code>Application.Cities.Location</code> is van type geography. Hoe krijg je er leesbare tekst als <code>POINT (-86.6 34.7)</code> uit?",
      options: [
        "<code>CAST(Location AS VARCHAR(100))</code>",
        "<code>EXEC sp_geotext Location</code>",
        "<code>Location.STAsText()</code>",
        "<code>SELECT * FROM sys.spatial_text</code>"
      ],
      answer: 2,
      explain: "STAsText() is een methode (functie) op het spatial type die de Well-Known Text teruggeeft."
    },
    {
      q: "Wat heeft een security policy voor Row Level Security minimaal nodig?",
      options: [
        "Een filterpredicaat dat een functie aanroept",
        "Een view die de tabel filtert",
        "Een stored procedure die de rijen teruggeeft",
        "Een nonclustered index op de filterkolom"
      ],
      answer: 0,
      explain: "Een security policy koppelt een inline table valued function als FILTER PREDICATE aan een tabel."
    },
    {
      q: "Je komt in een database de objecten <code>USP_Herprijs</code>, <code>VW_Klant</code> en <code>UDF_Marge</code> tegen. Wat voor object is <code>UDF_Marge</code>?",
      options: [
        "Een stored procedure die marges bijwerkt",
        "Een functie die de gebruiker zelf heeft gedefinieerd",
        "Een view met margekolommen",
        "Een tabel met unieke datavelden"
      ],
      answer: 1,
      explain: "Het voorvoegsel UDF staat voor user defined function. USP is een stored procedure en VW een view."
    },
    {
      q: "Een verkoper voert <code>SELECT * FROM Application.Cities</code> uit en ziet alleen steden uit zijn eigen sales-gebied, zonder dat er een WHERE in zijn query staat. Wat is hier waarschijnlijk ingericht?",
      options: [
        "Een INSTEAD OF SELECT-trigger",
        "Een CHECK-constraint op de tabel",
        "Isolation level SNAPSHOT",
        "Row Level Security met een security policy"
      ],
      answer: 3,
      explain: "RLS filtert automatisch per gebruiker. INSTEAD OF SELECT-triggers bestaan niet."
    }
  ]
});
