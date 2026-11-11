DB3.registerTopic({
  id: "views",
  intro: "Een view is een opgeslagen SELECT die zich gedraagt als een tabel. Je gebruikt hem om data klaar te zetten voor gebruikers, je fysieke structuur te verbergen en, samen met permissions, data af te schermen.",
  sections: [
    {
      title: "Wat is een view en waarom?",
      body: `<p>Een view is een <strong>virtuele tabel</strong>: een benoemde SELECT-query. Er wordt (bij een gewone view) geen extra data opgeslagen; elke keer dat je de view bevraagt, draait de onderliggende query.</p>
<pre><code class="sql">CREATE VIEW Application.VW_Geolocation
AS
SELECT c.CityID, c.CityName,
       sp.StateProvinceName,
       co.CountryName
FROM   Application.Cities c
JOIN   Application.StateProvinces sp ON sp.StateProvinceID = c.StateProvinceID
JOIN   Application.Countries co      ON co.CountryID       = sp.CountryID;</code></pre>
<p>Goede redenen om een view te maken:</p>
<ul>
<li><strong>Data voorbereiden</strong> voor gebruikers, bijv. voorberekende velden als <code>FullName</code> uit voornaam + achternaam of een totaalbedrag.</li>
<li>Alleen je <strong>logische structuur</strong> tonen in plaats van alle tabellen en joins.</li>
<li><strong>Afschermen</strong>: gebruikers krijgen alleen rechten op de view, niet op de tabellen.</li>
</ul>
<p>Een view is <em>niet</em> bedoeld om invoer te valideren (dat doen constraints), om performance te analyseren (profiler en query plan) of om het aantal transacties te verminderen.</p>
<div class="callout tip"><strong>Naamgeving</strong> <code>VW_{FunctioneleNaam}</code>, bijvoorbeeld <code>VW_Geolocation</code> of <code>VW_OpenOrders</code>.</div>`
    },
    {
      title: "Een view gebruiken: net als een tabel",
      body: `<p>Je roept een view aan met een gewone <code>SELECT ... FROM</code>. Alles wat met een tabel kan in een SELECT, kan ook met een view:</p>
<pre><code class="sql">SELECT * FROM Application.VW_Geolocation;                       -- gewoon selecteren

SELECT g.StateProvinceName, COUNT(*) AS Orders                   -- joinen + groeperen
FROM   Sales.Orders o
JOIN   Sales.Customers cu        ON cu.CustomerID = o.CustomerID
JOIN   Application.VW_Geolocation g ON g.CityID   = cu.DeliveryCityID
GROUP BY g.StateProvinceName;

SELECT CityName FROM Application.VW_Geolocation                  -- UNION met een tabel
UNION ALL
SELECT CityName FROM Application.Cities_Archive;</code></pre>
<p>Wat <strong>niet</strong> kan: een view aanroepen als functie of procedure. <code>EXEC VW_Geolocation</code> of <code>SELECT VW_Geolocation(12)</code> bestaat niet, want een view heeft geen parameters. Wil je een parameter, dan heb je een (table valued) <em>function</em> nodig.</p>
<p>Een view mag ook uit <strong>een andere view</strong> selecteren. Dat kan altijd en heeft geen extra voorwaarden.</p>`
    },
    {
      title: "Regels bij het maken: geen ORDER BY",
      body: `<p>Een view beschrijft een <em>verzameling</em> rijen, en een verzameling heeft geen volgorde. Daarom mag je in een view <strong>geen ORDER BY</strong> gebruiken; de gebruiker bepaalt zelf de sortering bij het opvragen.</p>
<pre><code class="sql">CREATE VIEW Sales.VW_OmzetPerKlant
AS
SELECT CustomerID, SUM(TransactionAmount) AS Omzet
FROM   Sales.CustomerTransactions
GROUP BY CustomerID
ORDER BY Omzet DESC;   -- FOUT: ORDER BY is niet toegestaan in een view

-- Wel goed: sorteer bij het gebruik
SELECT * FROM Sales.VW_OmzetPerKlant ORDER BY Omzet DESC;</code></pre>
<p>Subqueries, joins, GROUP BY, functies en <code>SELECT *</code> mogen allemaal wél (al is <code>*</code> af te raden en bij SCHEMABINDING verboden).</p>
<div class="callout exam"><strong>Toetstip</strong> Zie je een CREATE VIEW die een foutmelding geeft, kijk dan eerst of er een ORDER BY in staat. (De enige uitzondering is i.c.m. TOP of OFFSET, maar dan garandeert de view nog steeds geen sortering.)</div>`
    },
    {
      title: "WITH SCHEMABINDING",
      body: `<p>Met <code>WITH SCHEMABINDING</code> koppel je de view aan de definities van de tabellen die hij gebruikt:</p>
<pre><code class="sql">CREATE VIEW Sales.VW_KlantContact
WITH SCHEMABINDING
AS
SELECT c.CustomerID, c.CustomerName, c.PhoneNumber
FROM   Sales.Customers c;        -- verplicht: tweedelige namen, geen SELECT *

ALTER TABLE Sales.Customers ALTER COLUMN PhoneNumber NVARCHAR(30) NOT NULL;
-- FOUT: de kolom wordt gebruikt door een schemagebonden view</code></pre>
<ul>
<li>Je krijgt een fout als je een <strong>gebruikte kolom</strong> wijzigt of verwijdert, of de tabel dropt.</li>
<li>Een nieuwe kolom toevoegen, rijen verwijderen of een trigger maken op de tabel mag gewoon.</li>
<li>Voordeel: problemen ontstaan bij het <em>aanpassen van het schema</em> (compile time) in plaats van later bij het <em>gebruiken van de view</em> (runtime).</li>
</ul>`
    },
    {
      title: "INSERT en UPDATE via een view",
      body: `<p>Je kunt data wijzigen via een view zolang SQL Server precies weet welke rij in welke tabel geraakt wordt:</p>
<table>
<thead><tr><th>Actie</th><th>Kan direct als...</th></tr></thead>
<tbody>
<tr><td>INSERT</td><td>de view geen <strong>JOIN</strong> en geen <strong>GROUP BY</strong>/aggregaten gebruikt, en alle <strong>NOT NULL-kolommen</strong> (zonder default) van de tabel in de view zitten</td></tr>
<tr><td>UPDATE</td><td>de kolommen die je wijzigt een <strong>directe mapping</strong> hebben op een kolom van de onderliggende tabel (dus geen berekend veld zoals <code>Voornaam + ' ' + Achternaam</code> of een <code>SUM</code>)</td></tr>
</tbody>
</table>
<p>Lukt het niet direct, bijvoorbeeld omdat de view meerdere tabellen joint? Dan definieer je een <strong>INSTEAD OF-trigger</strong> op de view, die zelf bepaalt in welke tabellen de data terechtkomt. Zie het onderwerp Triggers.</p>
<pre><code class="sql">CREATE VIEW Warehouse.VW_Kleuren AS
SELECT ColorID, ColorName, LastEditedBy FROM Warehouse.Colors;

INSERT INTO Warehouse.VW_Kleuren (ColorID, ColorName, LastEditedBy)
VALUES (99, 'Oker', 1);    -- werkt: één tabel, alle verplichte kolommen aanwezig</code></pre>
<div class="callout warn"><strong>Let op</strong> SCHEMABINDING of een index op de view maakt een view <em>niet</em> insertbaar. Het gaat erom of de wijziging eenduidig naar één tabel te vertalen is.</div>`
    },
    {
      title: "Views + permissions = afscherming",
      body: `<p>De echte kracht van views zit in de combinatie met rechten. Geef een rol alleen SELECT op de view; de tabel zelf blijft dicht. De gebruiker heeft dan <strong>alleen rechten op de view nodig</strong>.</p>
<pre><code class="sql">CREATE VIEW Application.VW_MijnProvincies
AS
SELECT sp.StateProvinceID, sp.StateProvinceName, sp.SalesTerritory
FROM   Application.StateProvinces sp
WHERE  IS_MEMBER(sp.SalesTerritory + ' Sales') = 1;   -- filtert op jouw rol

GRANT SELECT ON Application.VW_MijnProvincies TO [Far West Sales];</code></pre>
<p>Iedere verkoper ziet nu via dezelfde view alleen de provincies uit zijn eigen gebied.</p>`
    }
  ],
  keyPoints: [
    "Een view is een opgeslagen SELECT die je gebruikt als een tabel: <code>SELECT * FROM VW_Naam</code>.",
    "Views kun je joinen, groeperen, in een UNION gebruiken en op andere views bouwen.",
    "Een view heeft geen parameters: <code>EXEC</code> of <code>VW_Naam(1)</code> werkt niet.",
    "<strong>ORDER BY</strong> is niet toegestaan in een view; sorteren doe je bij het opvragen.",
    "<code>WITH SCHEMABINDING</code> geeft een fout als je een gebruikte kolomdefinitie of tabel wijzigt/verwijdert.",
    "INSERT via een view kan zonder JOIN/GROUP BY en als alle NOT NULL-kolommen in de view zitten.",
    "UPDATE via een view kan als de kolommen direct naar de tabel mappen, of via een INSTEAD OF-trigger.",
    "Voor SELECT op een view heb je alleen rechten op de view nodig.",
    "Goede reden voor een view: voorberekende velden (zoals volledige naam) en logische structuur aanbieden."
  ],
  pitfalls: [
    { wrong: "Een view roep je aan met EXEC, net als een stored procedure.", right: "Een view gebruik je in de FROM: <code>SELECT * FROM VW_Contacts</code>." },
    { wrong: "Een view mag niet uit een andere view selecteren.", right: "Dat mag altijd; je kunt views op views bouwen." },
    { wrong: "Met ORDER BY in de view zorg je dat gebruikers altijd gesorteerde data krijgen.", right: "ORDER BY in een view geeft een foutmelding. Sorteer in de query die de view gebruikt." },
    { wrong: "SCHEMABINDING verbiedt het toevoegen van kolommen of verwijderen van rijen in de onderliggende tabel.", right: "SCHEMABINDING blokkeert alleen wijzigingen aan definities die de view gebruikt (kolom wijzigen/droppen, tabel droppen)." },
    { wrong: "In een view kun je nooit inserten.", right: "Dat kan als de view één tabel zonder GROUP BY raakt en alle NOT NULL-kolommen bevat; anders via een INSTEAD OF-trigger." },
    { wrong: "Je gebruikt een view om te valideren dat een postcode het juiste formaat heeft.", right: "Validatie is een taak voor een CHECK-constraint. Een view leest en presenteert data." }
  ],
  flashcards: [
    { front: "Wat is een view?", back: "Een opgeslagen SELECT-query die je als virtuele tabel kunt bevragen." },
    { front: "Naamgevingsconventie van een view", back: "<code>VW_{FunctioneleNaam}</code>" },
    { front: "Toon de 10 nieuwste rijen uit view <code>Sales.VW_Bestellingen</code>.", back: "<code>SELECT TOP (10) * FROM Sales.VW_Bestellingen ORDER BY OrderDate DESC;</code>: precies zoals bij een tabel." },
    { front: "Welke clausule is verboden in een view?", back: "<code>ORDER BY</code> (sorteer bij het opvragen)." },
    { front: "Je bouwt <code>VW_OmzetPerRegio</code> bovenop <code>VW_OrderTotalen</code>. Mag dat?", back: "Ja, views mogen gestapeld worden. Let wel op leesbaarheid en performance." },
    { front: "Wat doet <code>WITH SCHEMABINDING</code>?", back: "Je krijgt een fout als je een tabel- of kolomdefinitie wijzigt die de view gebruikt." },
    { front: "Een view toont alleen <code>CityName</code> uit Application.Cities (zonder JOIN). Een INSERT via de view faalt toch. Wat is de waarschijnlijke reden?", back: "Een verplichte (NOT NULL) kolom zonder default zit niet in de view, dus die blijft leeg." },
    { front: "<code>UPDATE VW_Klanten SET Telefoon = '...'</code> lukt, maar het bijwerken van de berekende kolom VolledigeNaam niet. Waarom?", back: "Telefoon verwijst direct naar één tabelkolom; VolledigeNaam is een expressie. Wil je dat toch, dan schrijf je een INSTEAD OF UPDATE-trigger." },
    { front: "Welke rechten heb je nodig om uit een view te lezen?", back: "Alleen SELECT op de view." },
    { front: "De app plakt overal zelf <code>FirstName + ' ' + LastName</code> aan elkaar. Welk databaseobject lost dit centraal op?", back: "Een view die een kolom VolledigeNaam aanbiedt; de app selecteert die." },
    { front: "View met een JOIN vullen via INSERT?", back: "Maak een INSTEAD OF INSERT-trigger op de view." }
  ],
  quiz: [
    {
      q: "Je hebt een view <code>Sales.VW_Klanten</code>. Welke query is GEEN geldige manier om hem te gebruiken?",
      options: [
        "<code>SELECT CustomerName FROM Sales.VW_Klanten WHERE CustomerID = 5</code>",
        "<code>EXEC Sales.VW_Klanten</code>",
        "<code>SELECT k.*, o.OrderDate FROM Sales.VW_Klanten k JOIN Sales.Orders o ON o.CustomerID = k.CustomerID</code>",
        "<code>SELECT CustomerCategoryID, COUNT(*) FROM Sales.VW_Klanten GROUP BY CustomerCategoryID</code>"
      ],
      answer: 1,
      explain: "Een view gebruik je in de FROM van een SELECT. Joinen en groeperen mag gewoon. EXEC is voor stored procedures."
    },
    {
      q: "Waarom geeft deze definitie een fout? <code>CREATE VIEW VW_Top AS SELECT StockItemName, UnitPrice FROM Warehouse.StockItems ORDER BY UnitPrice DESC</code>",
      options: [
        "Een view mag geen ORDER BY bevatten",
        "Een view moet altijd een WHERE hebben",
        "UnitPrice is een berekende kolom",
        "De naam moet met USP_ beginnen"
      ],
      answer: 0,
      explain: "Een view beschrijft een verzameling zonder volgorde. Sorteren doe je pas bij het opvragen van de view."
    },
    {
      q: "Je maakt <code>VW_Regio</code> bovenop de bestaande view <code>VW_Geolocation</code>. Wat geldt?",
      options: [
        "Dat mag alleen als VW_Geolocation WITH SCHEMABINDING heeft",
        "Dat mag niet; views kunnen niet in andere objecten gebruikt worden",
        "Dat mag alleen als beide views uit dezelfde tabel lezen",
        "Dat mag gewoon"
      ],
      answer: 3,
      explain: "Een view kan altijd uit een andere view selecteren; er zijn geen extra voorwaarden."
    },
    {
      q: "Een view is gemaakt <code>WITH SCHEMABINDING</code> en gebruikt de kolom <code>PhoneNumber</code> uit <code>Sales.Customers</code>. Welke actie op Sales.Customers levert een fout op?",
      options: [
        "Een nieuwe kolom <code>Email</code> toevoegen",
        "Alle klanten uit 2013 verwijderen",
        "Het datatype van <code>PhoneNumber</code> wijzigen",
        "Een AFTER UPDATE-trigger toevoegen"
      ],
      answer: 2,
      explain: "SCHEMABINDING beschermt de definities die de view gebruikt. Het wijzigen van een gebruikte kolom wordt geblokkeerd; data wijzigen of kolommen toevoegen niet."
    },
    {
      q: "Wat is het voordeel van SCHEMABINDING?",
      options: [
        "De view wordt automatisch geïndexeerd",
        "Problemen ontstaan bij het aanpassen van het schema in plaats van pas bij het gebruik van de view",
        "Gebruikers hebben geen rechten meer nodig op de view",
        "De view mag dan wel een ORDER BY bevatten"
      ],
      answer: 1,
      explain: "Je verschuift fouten van runtime (de view breekt onverwacht) naar het moment dat iemand het schema wil wijzigen."
    },
    {
      q: "De view <code>VW_Producten</code> selecteert StockItemID, StockItemName en UnitPrice uit één tabel, zonder joins of GROUP BY. De tabel heeft nog een NOT NULL-kolom <code>SupplierID</code> zonder default die niet in de view zit. Lukt een INSERT via de view?",
      options: [
        "Ja, de ontbrekende kolom wordt NULL",
        "Ja, als de view WITH SCHEMABINDING heeft",
        "Ja, als de view geïndexeerd is",
        "Nee, want een verplichte kolom kan niet gevuld worden"
      ],
      answer: 3,
      explain: "Voor een INSERT via een view moeten alle NOT NULL-kolommen (zonder default) in de view zitten. Schemabinding of indexering verandert daar niets aan."
    },
    {
      q: "Een view toont <code>FirstName + ' ' + LastName AS FullName</code> en de kolom <code>Email</code>, allebei uit één tabel. Welke UPDATE via de view werkt zonder extra maatregelen?",
      options: [
        "Alleen de UPDATE op Email",
        "Alleen de UPDATE op FullName",
        "Beide",
        "Geen van beide; views zijn read-only"
      ],
      answer: 0,
      explain: "Email mapt direct op een tabelkolom. FullName is berekend, dus SQL Server weet niet hoe die terug te vertalen. Daarvoor heb je een INSTEAD OF UPDATE-trigger nodig."
    },
    {
      q: "Je wilt rijen kunnen invoegen in een view die Cities, StateProvinces en Countries joint. Wat heb je nodig?",
      options: [
        "WITH SCHEMABINDING op de view",
        "Een clustered index op de view",
        "Een INSTEAD OF INSERT-trigger op de view",
        "Een CHECK-constraint op de view"
      ],
      answer: 2,
      explain: "Bij een view over meerdere tabellen bepaal je in een INSTEAD OF-trigger zelf in welke tabellen de nieuwe data terechtkomt."
    },
    {
      q: "Lisa heeft SELECT op <code>Sales.VW_Omzet</code> maar geen enkel recht op de onderliggende tabellen. Alles is van eigenaar dbo. Wat gebeurt er als ze de view bevraagt?",
      options: [
        "Ze krijgt een permissiefout op de eerste tabel",
        "Ze krijgt de rijen te zien",
        "Ze ziet alleen de kolomnamen",
        "Het lukt alleen met EXECUTE AS OWNER"
      ],
      answer: 1,
      explain: "Door ownership chaining controleert SQL Server de tabellen niet opnieuw als ze dezelfde eigenaar hebben als de view. SELECT op de view is genoeg."
    },
    {
      q: "Bij welke situatie past het aanmaken van een view goed?",
      options: [
        "Je wilt rapportagegebruikers een kolom 'Adresregel' tonen die uit straat, huisnummer en plaats is samengesteld",
        "Je wilt afdwingen dat een e-mailadres een @ bevat",
        "Je wilt zien welke queries traag zijn",
        "Je wilt het aantal open transacties verlagen"
      ],
      answer: 0,
      explain: "Voorberekende, gebruiksvriendelijke velden aanbieden is een klassieke reden voor een view. Validatie is voor constraints, performance-analyse voor de profiler."
    },
    {
      q: "Je wilt dat iedere verkoper via dezelfde view alleen de klanten uit zijn eigen regio ziet. Wat zet je in de WHERE van de view?",
      options: [
        "<code>WHERE SalesTerritory = @Regio</code>",
        "<code>WHERE USER_NAME() IS NOT NULL</code>",
        "<code>WHERE IS_MEMBER(SalesTerritory + ' Sales') = 1</code>",
        "<code>ORDER BY SalesTerritory</code>"
      ],
      answer: 2,
      explain: "IS_MEMBER kijkt of de huidige gebruiker in de bijbehorende rol zit. Een view kent geen parameters, dus @Regio werkt niet."
    },
    {
      q: "Welke bewering over views is juist?",
      options: [
        "Een gewone view slaat een kopie van de data op die periodiek ververst wordt",
        "Een view kan een parameter meekrijgen",
        "Een view mag geen subquery bevatten",
        "Een view kan je in een UNION ALL met een tabel combineren"
      ],
      answer: 3,
      explain: "In een SELECT gedraagt een view zich als een tabel, dus UNION, JOIN en GROUP BY werken gewoon. Subqueries mogen ook; parameters niet."
    }
  ]
});
