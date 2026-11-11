DB3.registerTopic({
  id: "storedprocs",
  intro: "Een stored procedure is een benoemd, gecompileerd stuk T-SQL op de server. Anders dan een functie mag een procedure wél data wijzigen, en hij kan meerdere statements als één logisch geheel uitvoeren. Ideaal om dezelfde datalogica voor alle applicaties gelijk te houden.",
  sections: [
    {
      title: "Wat is een stored procedure?",
      body: `<p>Een stored procedure (naamgeving: <code>USP_{Naam}</code>, User Stored Procedure) is herbruikbare logica op de server, net als een functie. Het verschil:</p>
<table>
<thead><tr><th></th><th>Function (UDF)</th><th>Stored procedure</th></tr></thead>
<tbody>
<tr><td>Data wijzigen</td><td>Nee</td><td><strong>Ja</strong></td></tr>
<tr><td>In een SELECT gebruiken</td><td>Ja</td><td>Nee</td></tr>
<tr><td>Aanroepen met</td><td>In een query: <code>dbo.UDF_x(1)</code></td><td><code>EXEC</code></td></tr>
<tr><td>Teruggeven</td><td>Altijd een waarde of tabel</td><td>Optioneel: resultsets, OUTPUT-parameters, return code, of niets</td></tr>
<tr><td>Meerdere statements</td><td>Ja, maar alleen lezend</td><td>Ja, inclusief INSERT/UPDATE/DELETE en transacties</td></tr>
</tbody>
</table>
<p><strong>Voordelen</strong> ten opzichte van losse ad-hoc queries:</p>
<ul>
<li><strong>Gecompileerd</strong>: het uitvoeringsplan wordt hergebruikt, dus de query hoeft niet steeds opnieuw geïnterpreteerd te worden.</li>
<li><strong>Logica afgeschermd</strong> voor de applicatie: alle applicaties (web, WPF, rapportage) gebruiken dezelfde procedure, dus het datagedrag is overal gelijk.</li>
<li>Meerdere queries als <strong>één logische bulk</strong> uitvoeren.</li>
</ul>
<div class="callout warn"><strong>Let op</strong> "Gecompileerd" betekent hergebruik van het plan. Een procedure maakt geen indexes aan, krijgt geen extra CPU en zet geen data klaar. Een slechte query blijft in een procedure een slechte query.</div>`
    },
    {
      title: "Maken en aanroepen",
      body: `<pre><code class="sql">CREATE PROCEDURE Sales.USP_GetCustomersWithOutstandings
    @OutstandingsThreshold DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.CustomerName,
           SUM(ct.OutstandingBalance) AS Openstaand
    FROM   Sales.Customers c
    JOIN   Sales.CustomerTransactions ct ON ct.CustomerID = c.CustomerID
    GROUP BY c.CustomerName
    HAVING SUM(ct.OutstandingBalance) &gt; @OutstandingsThreshold;
END;
GO

EXEC Sales.USP_GetCustomersWithOutstandings @OutstandingsThreshold = 5000;</code></pre>
<ul>
<li>Je voert een procedure uit met <strong><code>EXEC</code></strong> (of <code>EXECUTE</code>), bij voorkeur met <strong>benoemde parameters</strong>: <code>@Naam = waarde</code>.</li>
<li><code>SELECT * FROM USP_...</code> of <code>USP_...(1, 2)</code> werkt niet.</li>
<li><strong><code>BEGIN ... END</code></strong> markeert de body. Omdat een procedure vaak meerdere statements bevat, weet SQL Server (en de lezer) zo wat er bij de procedure hoort. BEGIN/END is géén transactie.</li>
</ul>`
    },
    {
      title: "Wie kan een procedure aanroepen?",
      body: `<table>
<thead><tr><th>Aanroeper</th><th>Kan EXEC doen?</th></tr></thead>
<tbody>
<tr><td>Een los SQL-statement / ad-hoc batch</td><td>Ja</td></tr>
<tr><td>Een andere stored procedure</td><td>Ja (nesten)</td></tr>
<tr><td>Een trigger</td><td>Ja</td></tr>
<tr><td>De applicatie (ADO.NET, Entity Framework)</td><td>Ja</td></tr>
<tr><td><strong>Een functie</strong></td><td><strong>Nee</strong>: een functie mag geen bijwerkingen hebben en dus geen procedure starten</td></tr>
</tbody>
</table>
<p>Parameters kunnen <strong>scalar</strong> zijn, maar ook <strong>table valued</strong> (een tabeltype, READONLY) en <strong>OUTPUT</strong>-parameters om waarden terug te geven. Een procedure hoeft niets terug te geven.</p>`
    },
    {
      title: "Meerdere tabellen consistent wijzigen",
      body: `<p>Het sterkste argument voor een procedure: <strong>meerdere datamodificaties in één keer, correct en volledig</strong>. Denk aan een order met orderregels: twee tabellen, die allebei gevuld moeten worden.</p>
<pre><code class="sql">CREATE PROCEDURE Sales.USP_PlaatsOrder
    @CustomerID  INT,
    @StockItemID INT,
    @Quantity    INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO Sales.Orders (CustomerID, OrderDate, ...)
        VALUES (@CustomerID, GETDATE(), ...);

        INSERT INTO Sales.OrderLines (OrderID, StockItemID, Quantity, ...)
        VALUES (SCOPE_IDENTITY(), @StockItemID, @Quantity, ...);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT &gt; 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;</code></pre>
<p>Een procedure kan zelf een transactie starten, maar kan ook <strong>opgenomen worden in een transactie</strong> van de aanroeper.</p>
<table>
<thead><tr><th>Situatie</th><th>Beste keuze</th></tr></thead>
<tbody>
<tr><td>Data over meerdere tabellen consistent bewerken, niet met één statement te doen</td><td><strong>Stored procedure</strong></td></tr>
<tr><td>Automatisch reageren op een wijziging in één tabel</td><td>Trigger</td></tr>
<tr><td>Regel binnen één rij</td><td>CHECK-constraint</td></tr>
<tr><td>Herbruikbare berekening in een SELECT</td><td>Function</td></tr>
</tbody>
</table>`
    },
    {
      title: "Stored procedures in het Entity Framework",
      body: `<p>Zowel functies als stored procedures kun je vanuit het Entity Framework aanroepen en <strong>mappen</strong>. Voordeel: parameters en resultaten worden <strong>sterk getypeerd</strong>, zodat je fouten al tijdens het compileren ziet in plaats van pas bij het uitvoeren.</p>
<pre><code class="sql">// EF6 (database first): Import function, daarna:
IEnumerable&lt;Customer&gt; result = context.USP_GetCustomersWithOutstandings(5000m);

// EF Core:
var klanten = context.Customers
    .FromSqlInterpolated($"EXEC Sales.USP_GetCustomersWithOutstandings {drempel}")
    .ToList();</code></pre>
<p>Je hoeft niet alle procedures te mappen; je applicatie crasht niet als je dat niet doet. Mappen is gewoon de nette, typeveilige manier.</p>`
    }
  ],
  keyPoints: [
    "Een stored procedure mag, anders dan een functie, <strong>wél data wijzigen</strong>.",
    "Aanroepen met <code>EXEC USP_Naam @Param = waarde</code>; niet in een SELECT.",
    "Snel omdat hij <strong>gecompileerd</strong> is: het plan wordt hergebruikt.",
    "Reden om procedures te gebruiken: <strong>datagedrag gelijk houden over meerdere applicaties</strong>.",
    "Meerdere datamodificaties (order + orderregels) correct en volledig? Gebruik een stored procedure, met een transactie.",
    "<code>BEGIN ... END</code> markeert welke statements bij de procedure horen; het is geen transactie.",
    "Een procedure kan worden aangeroepen door een statement, een andere procedure en een trigger, maar <strong>niet door een functie</strong>.",
    "Een procedure kan in een transactie worden opgenomen, meerdere queries bevatten en hoeft niets terug te geven.",
    "Parameters: scalar, table valued (READONLY) en OUTPUT.",
    "Map procedures in het Entity Framework voor getypeerde parameters/resultaten en compile-time fouten."
  ],
  pitfalls: [
    { wrong: "Een stored procedure is snel omdat hij automatisch indexes aanmaakt.", right: "Hij is sneller omdat het uitvoeringsplan gecompileerd en hergebruikt wordt. Indexes moet je zelf maken." },
    { wrong: "Je roept een procedure aan met <code>SELECT * FROM USP_X</code>.", right: "Gebruik <code>EXEC USP_X @Param = ...</code>." },
    { wrong: "BEGIN en END maken van de procedure één transactie.", right: "BEGIN/END begrenst alleen het codeblok. Voor een transactie schrijf je BEGIN TRANSACTION ... COMMIT." },
    { wrong: "Een functie kan een stored procedure aanroepen om data op te slaan.", right: "Functies mogen geen data wijzigen en geen procedures starten." },
    { wrong: "Een stored procedure mag maar één query bevatten en moet altijd data teruggeven.", right: "Hij mag veel statements bevatten en hoeft niets terug te geven." },
    { wrong: "Je kiest een trigger als je een order en orderregels samen moet opslaan.", right: "Dat is precies de use case van een stored procedure: meerdere tabellen in één logische actie." }
  ],
  flashcards: [
    { front: "Naamgevingsconventie stored procedure", back: "<code>USP_{Naam}</code>" },
    { front: "Roep <code>Sales.USP_PlaatsOrder</code> aan voor klant 42 met 3 stuks product 7, met benoemde parameters.", back: "<code>EXEC Sales.USP_PlaatsOrder @CustomerID = 42, @StockItemID = 7, @Quantity = 3;</code>" },
    { front: "Belangrijkste verschil met een functie", back: "Een procedure mag data wijzigen; een functie niet. Een functie kan wel in een SELECT." },
    { front: "Dezelfde zoekopdracht draait 1000× per minuut. Wat bespaar je als je hem in een procedure zet in plaats van steeds ad-hoc te sturen?", back: "Het compileren: het uitvoeringsplan ligt klaar en wordt hergebruikt." },
    { front: "Wat kan een procedure NIET aanroepen?", back: "Een functie kan geen procedure aanroepen (trigger, procedure en losse statements wel)." },
    { front: "Een procedure bevat een UPDATE, een INSERT en een SELECT. Wat markeren <code>BEGIN</code> en <code>END</code> hier?", back: "De grens van de procedurebody: alles ertussen hoort bij de procedure." },
    { front: "Kan een procedure in een transactie worden opgenomen?", back: "Ja." },
    { front: "Wanneer procedure i.p.v. trigger?", back: "Als één logische actie in meerdere tabellen moet schrijven (bijv. order + orderregels) en dat niet in één statement past." },
    { front: "Je C#-code roept een procedure aan met een losse SQL-string en een typfout in een parameternaam. Wanneer merk je dat, en hoe voorkom je het?", back: "Pas tijdens het draaien. Map de procedure in EF; dan zijn parameters en resultaat getypeerd en ziet de compiler de fout." },
    { front: "Strategisch voordeel van procedures", back: "Datagedrag is gelijk voor alle applicaties die de database gebruiken." },
    { front: "Welke soorten parameters kan een procedure hebben?", back: "Scalar, table valued (READONLY) en OUTPUT." }
  ],
  quiz: [
    {
      q: "Welke aanroep van een stored procedure is correct?",
      options: [
        "<code>SELECT * FROM USP_ZoekKlant @Naam = 'Tailspin'</code>",
        "<code>USP_ZoekKlant('Tailspin')</code>",
        "<code>EXEC USP_ZoekKlant @Naam = 'Tailspin'</code>",
        "<code>CALL FUNCTION USP_ZoekKlant 'Tailspin'</code>"
      ],
      answer: 2,
      explain: "Een procedure start je met EXEC(UTE), bij voorkeur met benoemde parameters."
    },
    {
      q: "Een collega wil binnen <code>dbo.UDF_Prijs</code> de procedure <code>USP_LogAanroep</code> uitvoeren. Wat gebeurt er?",
      options: [
        "Dat werkt gewoon",
        "Dat werkt alleen met EXEC AS OWNER",
        "Dat mag niet: vanuit een functie kun je geen procedure uitvoeren",
        "Dat werkt, maar de logregel wordt teruggedraaid"
      ],
      answer: 2,
      explain: "Functies mogen geen bijwerkingen hebben en dus geen procedures aanroepen. Vanuit triggers, batches en andere procedures kan het wel."
    },
    {
      q: "Een webshop, een kassa-app en een rapportagetool moeten allemaal op exact dezelfde manier een retour verwerken. Wat is hier het belangrijkste argument voor een stored procedure?",
      options: [
        "Het datagedrag is dan gelijk voor alle applicaties",
        "Gebruikers krijgen dan automatisch meer rechten",
        "De profiler laat dan meer details zien",
        "Triggers gaan dan in een vaste volgorde af"
      ],
      answer: 0,
      explain: "De logica staat één keer in de database en alle applicaties roepen dezelfde procedure aan."
    },
    {
      q: "Wat maakt een stored procedure sneller dan dezelfde losse query die steeds opnieuw verstuurd wordt?",
      options: [
        "De gebruikte tabellen worden automatisch geïndexeerd",
        "Het plan is gecompileerd en wordt hergebruikt",
        "Procedures krijgen voorrang op de CPU",
        "De resultaten worden bij het aanmaken alvast klaargezet"
      ],
      answer: 1,
      explain: "Hergebruik van het gecompileerde plan bespaart het opnieuw parsen en optimaliseren. Indexes en data-preparatie gebeuren niet vanzelf."
    },
    {
      q: "Wat doet <code>BEGIN ... END</code> in <code>CREATE PROCEDURE ... AS BEGIN ... END</code>?",
      options: [
        "Het start een transactie",
        "Het groepeert de statements die samen de procedure vormen",
        "Het bepaalt welk resultaat teruggegeven wordt",
        "Het zorgt ervoor dat de procedure gecompileerd wordt"
      ],
      answer: 1,
      explain: "BEGIN/END is alleen een blok: het markeert welke statements bij de procedure horen. Een transactie start je apart met BEGIN TRAN."
    },
    {
      q: "Voorraad verplaatsen van magazijn A naar B: één UPDATE verlaagt A, één UPDATE verhoogt B. Apps mogen dit nooit half doen. Wat bied je de apps aan?",
      options: [
        "Een CHECK-constraint op de voorraadtabel",
        "Een view over beide magazijnen",
        "Een stored procedure die beide updates in een transactie uitvoert",
        "Row Level Security per magazijn"
      ],
      answer: 2,
      explain: "Een procedure bundelt de stappen; de transactie erin maakt ze atomair. Apps roepen alleen de procedure aan."
    },
    {
      q: "Welke bewering over stored procedures is juist?",
      options: [
        "Een procedure kan onderdeel zijn van een transactie van de aanroeper",
        "Een procedure mag maximaal één query bevatten",
        "Een procedure moet altijd een resultset teruggeven",
        "Een procedure kan alleen scalar parameters ontvangen"
      ],
      answer: 0,
      explain: "Een procedure kan binnen een transactie worden aangeroepen, mag veel statements bevatten, hoeft niets terug te geven en kent ook table valued parameters."
    },
    {
      q: "Wanneer kies je eerder voor een stored procedure dan voor een trigger?",
      options: [
        "Als één rij aan meerdere voorwaarden moet voldoen",
        "Als data over meerdere tabellen samenhangend bewerkt moet worden en één statement op één tabel niet volstaat",
        "Als er bij elke INSERT automatisch een logregel moet ontstaan",
        "Als het Entity Framework de validatie moet overslaan"
      ],
      answer: 1,
      explain: "Een trigger reageert op één tabel; een procedure orkestreert bewust meerdere wijzigingen. Automatisch loggen bij elke INSERT is juist triggerwerk."
    },
    {
      q: "Een C#-team roept procedures aan via <code>FromSqlRaw(\"EXEC USP_...\")</code>. Wat winnen ze door de procedures in het Entity Framework te mappen?",
      options: [
        "De procedures draaien dan in de applicatie in plaats van in de database",
        "Fouten in parameters en resultaatkolommen vallen al op tijdens het bouwen",
        "Ze hebben dan geen database-rechten meer nodig",
        "EF zet de procedure om naar een view"
      ],
      answer: 1,
      explain: "Met een mapping zijn parameters en resultaten getypeerd. Een verkeerde naam of type geeft een compile-fout in plaats van een fout tijdens het draaien."
    },
    {
      q: "Je wilt in één actie de voorraad verlagen, een mutatieregel wegschrijven en de orderstatus aanpassen. Waarom valt een user defined function hier af?",
      options: [
        "Functies kunnen geen parameters krijgen",
        "Functies mogen geen data wijzigen; een stored procedure wel",
        "Functies zijn alleen voor JSON",
        "Functies werken niet binnen een transactie"
      ],
      answer: 1,
      explain: "Een functie mag niets aan de data veranderen. Voor meerdere wijzigingen in één aanroep gebruik je een stored procedure, eventueel met een transactie erin."
    },
    {
      q: "Wat hoort NIET bij de voordelen van een stored procedure ten opzichte van ad-hoc queries?",
      options: [
        "De logica is afgeschermd voor de applicatie",
        "Meerdere statements in één logische eenheid",
        "Hergebruik van het gecompileerde plan",
        "De procedure kan rechtstreeks in de WHERE van een SELECT gebruikt worden"
      ],
      answer: 3,
      explain: "In een SELECT kun je alleen functies gebruiken, geen procedures."
    },
    {
      q: "Welke parameter-definitie is geldig voor een stored procedure die een lijst met order-ID's moet ontvangen?",
      options: [
        "<code>@Orders dbo.OrderIdLijst READONLY</code> (een zelfgedefinieerd tabeltype)",
        "<code>@Orders TABLE</code> zonder type",
        "<code>@Orders ARRAY(INT)</code>",
        "Dat kan niet; procedures accepteren alleen scalar waarden"
      ],
      answer: 0,
      explain: "Table valued parameters gebruiken een tabeltype dat je met CREATE TYPE ... AS TABLE maakt, en ze zijn READONLY."
    }
  ]
});
