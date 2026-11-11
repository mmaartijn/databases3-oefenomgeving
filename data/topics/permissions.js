DB3.registerTopic({
  id: "permissions",
  intro: "Wie mag wat in je database? SQL Server werkt met een duidelijke hiërarchie van logins, users, rollen en schema's. Wie die lagen snapt, kan rechten top-down regelen in plaats van per gebruiker per tabel te knutselen.",
  sections: [
    {
      title: "De hiërarchie: login, user, rol",
      body: `<p>Rechten in SQL Server zijn in twee niveaus opgebouwd:</p>
<table>
<thead><tr><th>Niveau</th><th>Object</th><th>Waarvoor</th></tr></thead>
<tbody>
<tr><td><strong>Server</strong></td><td>Login</td><td>Toegang tot de <em>server</em>. Kan een Windows-identiteit zijn (Windows Authentication) of een SQL Server-login met wachtwoord.</td></tr>
<tr><td>Server</td><td>Server role</td><td>Groep rechten op serverniveau, bijv. <code>sysadmin</code> of <code>dbcreator</code>.</td></tr>
<tr><td><strong>Database</strong></td><td>Database user</td><td>Toegang tot één <em>database</em>. Meestal gekoppeld aan een login.</td></tr>
<tr><td>Database</td><td>Database role</td><td>Groep rechten binnen een database, bijv. <code>db_datareader</code> of een eigen rol als <code>Far West Sales</code>.</td></tr>
</tbody>
</table>
<p>Kort: de <strong>login hoort bij de server, de user bij één database</strong>. Eén login kan in meerdere databases een user hebben.</p>
<pre><code class="sql">-- Serverniveau
CREATE LOGIN Fenna WITH PASSWORD = 'S3cure!pass';

-- Databaseniveau
USE WideWorldImporters;
CREATE USER Fenna FOR LOGIN Fenna;</code></pre>
<div class="callout warn"><strong>Let op</strong> Een user hoeft <em>niet</em> altijd aan een login gekoppeld te zijn. Er bestaan ook users zonder login (<code>CREATE USER Robot WITHOUT LOGIN</code>) en users in een <em>contained database</em> met een eigen wachtwoord. Daarom is "een user hoort altijd bij een login" een onjuiste bewering.</div>`
    },
    {
      title: "GRANT, DENY en REVOKE",
      body: `<p>Met drie statements regel je rechten:</p>
<pre><code class="sql">GRANT  SELECT ON Sales.Orders     TO Fenna;          -- geef dit specifieke recht
DENY   DELETE ON Sales.Orders     TO Fenna;          -- verbied expliciet
REVOKE SELECT ON Sales.Orders     FROM Fenna;        -- haal een eerdere GRANT/DENY weg
GRANT  SELECT ON SCHEMA::Sales    TO [SalesPersons]; -- in één keer op een heel schema</code></pre>
<ul>
<li><strong>GRANT</strong> geeft precies het genoemde recht (SELECT, INSERT, UPDATE, DELETE, EXECUTE, ...) op het genoemde object, niet "alle rechten".</li>
<li><strong>DENY</strong> wint altijd van een GRANT. Zo kun je op userniveau een recht afpakken dat iemand via een rol had gekregen.</li>
<li><strong>REVOKE</strong> is de "reset": het verwijdert een eerder gegeven GRANT of DENY.</li>
</ul>
<div class="callout tip"><strong>Tip</strong> Werk <strong>top-down</strong>: geef rechten aan rollen en op schema's, zo min mogelijk aan individuele users op losse objecten.</div>`
    },
    {
      title: "Rollen: rechten bundelen",
      body: `<p>Moeten meerdere mensen hetzelfde mogen? Maak dan een <strong>rol</strong>, geef de rol de rechten en maak de users lid. Er bestaat geen "kopieer user"-commando; een rol is dé manier om rechten gelijk te trekken.</p>
<pre><code class="sql">CREATE ROLE Magazijn;
GRANT SELECT, UPDATE ON SCHEMA::Warehouse TO Magazijn;

ALTER ROLE Magazijn ADD MEMBER Fenna;
ALTER ROLE Magazijn ADD MEMBER Joris;</code></pre>
<p>Een user kan lid zijn van <strong>meerdere rollen</strong>; de rechten tellen dan bij elkaar op (behalve waar een DENY staat). Handige ingebouwde databaserollen:</p>
<table>
<thead><tr><th>Rol</th><th>Mag</th></tr></thead>
<tbody>
<tr><td><code>db_datareader</code></td><td>SELECT op alle tabellen en views</td></tr>
<tr><td><code>db_datawriter</code></td><td>INSERT, UPDATE, DELETE op alle tabellen</td></tr>
<tr><td><code>db_owner</code></td><td>Alles binnen de database</td></tr>
</tbody>
</table>
<div class="callout exam"><strong>Toetstip</strong> Symptoom: een user ziet in de Object Explorer wél welke tabellen er zijn, maar elke <code>SELECT</code> faalt met "permission denied". Dan heeft hij wel toegang tot de database, maar <strong>geen leesrechten</strong>: hij mist bijvoorbeeld <code>db_datareader</code> of een SELECT-grant.</div>`
    },
    {
      title: "Schema's: objecten groeperen",
      body: `<p>Een <strong>schema</strong> is een map voor database-objecten: <code>Sales.Orders</code>, <code>Warehouse.StockItems</code>, <code>Application.Cities</code>. Schema's hebben twee doelen:</p>
<ol>
<li>Data <strong>functioneel scheiden</strong> (verkoop, magazijn, applicatie).</li>
<li><strong>Rechten op een hele groep objecten</strong> in één keer geven: <code>GRANT SELECT ON SCHEMA::Sales TO ...</code>. Nieuwe tabellen in dat schema vallen er automatisch onder.</li>
</ol>
<p>Schema's hebben niets te maken met indexes, en foreign keys mogen gewoon over schema's heen verwijzen (<code>Sales.Orders</code> → <code>Application.People</code>).</p>
<p><strong>Rechten via een view</strong>: als een view en de onderliggende tabel dezelfde eigenaar hebben (de normale situatie), dan controleert SQL Server alleen de rechten op de <em>view</em>. Dat heet <em>ownership chaining</em>. Je kunt gebruikers dus SELECT geven op een view, zonder dat ze de tabel zelf mogen lezen.</p>
<pre><code class="sql">GRANT SELECT ON Sales.VW_OpenOrders TO Klantenservice;
-- Klantenservice kan nu de view lezen, maar níet direct Sales.Orders</code></pre>`
    },
    {
      title: "Wie ben ik? EXECUTE AS, IS_MEMBER en USER_NAME",
      body: `<p>Testen of je rechten kloppen doe je door tijdelijk iemand anders te <em>worden</em>:</p>
<pre><code class="sql">EXECUTE AS USER = 'Hendrik';     -- vanaf nu draai je als Hendrik
SELECT * FROM Sales.Orders;      -- werkt dit met zíjn rechten?
REVERT;                          -- terug naar jezelf</code></pre>
<p>Binnen queries kun je vragen wie de huidige gebruiker is en welke rollen hij heeft:</p>
<table>
<thead><tr><th>Functie</th><th>Geeft</th><th>Typisch gebruik</th></tr></thead>
<tbody>
<tr><td><code>USER_NAME()</code></td><td>Naam van de huidige database user</td><td>Vastleggen <em>wie</em> een rij heeft ingevoegd of gewijzigd</td></tr>
<tr><td><code>IS_MEMBER('rol')</code></td><td>1 als je lid bent van de rol, anders 0</td><td>Filteren op jouw rol (basis voor row level security)</td></tr>
</tbody>
</table>
<pre><code class="sql">-- Alleen de provincies uit mijn eigen sales-gebied
SELECT sp.StateProvinceName
FROM   Application.StateProvinces sp
WHERE  IS_MEMBER(sp.SalesTerritory + ' Sales') = 1;

-- Audit-kolom vullen bij een insert
INSERT INTO Sales.Notes (OrderID, NoteText, CreatedBy)
VALUES (73001, 'Klant gebeld', USER_NAME());</code></pre>
<div class="callout tip"><strong>Tip</strong> Er bestaat geen tabel met "de laatst ingelogde gebruiker" die je kunt bevragen. Gebruik altijd de systeemfuncties.</div>`
    }
  ],
  keyPoints: [
    "Een <strong>login</strong> geeft toegang tot de server, een <strong>user</strong> tot één database.",
    "Een login kan een Windows-identiteit of een SQL-login zijn; een user hoeft niet altijd aan een login gekoppeld te zijn.",
    "<code>GRANT</code> geeft het genoemde recht op het genoemde object; <code>DENY</code> verbiedt en wint van GRANT; <code>REVOKE</code> haalt een eerdere GRANT/DENY weg.",
    "Zelfde rechten voor meerdere mensen? Maak een <strong>rol</strong> en maak ze lid.",
    "Een user kan lid zijn van meerdere rollen; met DENY op userniveau pak je een geërfd recht weer af.",
    "Schema's scheiden data functioneel en laten je rechten op een groep objecten geven.",
    "Voor SELECT op een view heb je alleen rechten op de view nodig (ownership chaining).",
    "<code>EXECUTE AS USER</code> laat je een query uitvoeren alsof je die user bent; <code>REVERT</code> zet het terug.",
    "<code>USER_NAME()</code> = wie ben ik; <code>IS_MEMBER('rol')</code> = heb ik deze rol.",
    "Tabellen zien maar geen rijen kunnen lezen = je mist leesrechten zoals <code>db_datareader</code>."
  ],
  pitfalls: [
    { wrong: "Een login en een user zijn hetzelfde, alleen heet het in SSMS anders.", right: "Een login hoort bij de server, een user bij een database. Eén login kan in meerdere databases een user hebben." },
    { wrong: "GRANT SELECT geeft iemand alle rechten op de tabel.", right: "GRANT geeft precies het recht dat je noemt. Voor INSERT of DELETE heb je aparte grants nodig." },
    { wrong: "Om iemand dezelfde rechten te geven als een collega kopieer je de rijen uit een permissietabel.", right: "Maak een rol met de juiste rechten en maak beide users lid van die rol." },
    { wrong: "Wie uit een view wil lezen, heeft ook leesrechten op de tabel eronder nodig.", right: "Bij dezelfde eigenaar volstaat SELECT op de view. Juist daardoor kun je met views data afschermen." },
    { wrong: "Schema's zijn er om indexes per groep tabellen op te slaan.", right: "Schema's groeperen objecten functioneel en maken het mogelijk rechten op een hele groep te geven." },
    { wrong: "Je kunt de huidige gebruiker vinden met de laatste rij uit een login-tabel.", right: "Gebruik <code>USER_NAME()</code> (of <code>SUSER_SNAME()</code> voor de login)." }
  ],
  flashcards: [
    { front: "Jan kan inloggen op de server, maar krijgt bij het openen van WideWorldImporters een fout. Wat ontbreekt er waarschijnlijk?", back: "Een user in die database voor zijn login. De login geeft toegang tot de server, de user geeft toegang tot een database." },
    { front: "Twee soorten logins", back: "Windows Authentication (je Windows-identiteit) en SQL Server-logins met eigen wachtwoord." },
    { front: "Schrijf de opdracht: rol <code>Inkoop</code> mag orders lezen en toevoegen.", back: "<code>GRANT SELECT, INSERT ON Purchasing.PurchaseOrders TO Inkoop;</code>" },
    { front: "<code>DENY</code> vs. <code>REVOKE</code>", back: "DENY verbiedt expliciet (en wint van GRANT). REVOKE haalt een eerdere GRANT of DENY weg." },
    { front: "Beste manier om twee users dezelfde rechten te geven?", back: "Een rol maken met die rechten en beide users lid maken." },
    { front: "Team Magazijn moet alles in het magazijndeel kunnen lezen, ook tabellen die later bijkomen. Hoe doe je dat met één GRANT?", back: "<code>GRANT SELECT ON SCHEMA::Warehouse TO Magazijn;</code>" },
    { front: "Welke rechten heb je nodig om uit een view te selecteren?", back: "Alleen SELECT op de view (dankzij ownership chaining)." },
    { front: "Wat doet <code>EXECUTE AS USER = 'x'</code>?", back: "Je voert queries uit alsof je user x bent. Terug met <code>REVERT</code>." },
    { front: "Een view moet alleen voor managers de salariskolom tonen. Welke functie gebruik je in de CASE?", back: "<code>IS_MEMBER('Managers')</code>: 1 als de huidige gebruiker in die rol zit." },
    { front: "Hoe leg je vast wie een rij heeft gewijzigd?", back: "Met <code>USER_NAME()</code> in je INSERT/UPDATE." },
    { front: "Je ziet tabellen maar kunt niets selecteren. Oorzaak?", back: "Je mist leesrechten, bijv. de rol <code>db_datareader</code>." },
    { front: "Kan een user meerdere rollen hebben?", back: "Ja. De rechten tellen op; een DENY gaat altijd voor." }
  ],
  quiz: [
    {
      q: "Een student maakt een SQL-login aan, maar kan daarna nog steeds niets in de database <code>WideWorldImporters</code>. Wat ontbreekt er waarschijnlijk?",
      options: [
        "Een server role sysadmin",
        "Een database user die aan die login gekoppeld is",
        "Een REVOKE op de database",
        "Een schema met dezelfde naam als de login"
      ],
      answer: 1,
      explain: "De login geeft alleen toegang tot de server. Toegang tot een database loopt via een user in die database."
    },
    {
      q: "Je maakt een database user aan voor een rapportagedienst die nooit zelf inlogt. Wat klopt?",
      options: [
        "Dat kan niet; zonder bijbehorende login kun je geen user maken",
        "Alleen een Windows-login kan zo'n user krijgen",
        "Met CREATE USER ... WITHOUT LOGIN kan het; je gebruikt hem dan via EXECUTE AS",
        "Dan moet je eerst een serverrol aanmaken"
      ],
      answer: 2,
      explain: "Users kunnen ook zonder login bestaan (WITHOUT LOGIN, of in een contained database). Zo'n user gebruik je om rechten te testen of om code onder een vaste identiteit te laten draaien."
    },
    {
      q: "Wat gebeurt er na <code>GRANT INSERT ON Sales.Orders TO Fenna</code>?",
      options: [
        "Fenna mag rijen toevoegen aan Sales.Orders",
        "Fenna mag alles met Sales.Orders, ook verwijderen",
        "Constraints op Sales.Orders worden voor Fenna overgeslagen",
        "Alle inserts van Fenna worden automatisch in een transactie gezet"
      ],
      answer: 0,
      explain: "GRANT geeft precies het genoemde recht (INSERT) op het genoemde object. Het schakelt geen constraints uit en zegt niets over transacties."
    },
    {
      q: "Tien medewerkers van de klantenservice moeten exact dezelfde rechten krijgen, en straks komen er nog meer bij. Wat is de beste aanpak?",
      options: [
        "Voor elke medewerker dezelfde GRANT-statements herhalen",
        "Eén login maken die alle medewerkers delen",
        "De rechten van de eerste medewerker kopiëren met een INSERT in de systeemtabellen",
        "Een rol maken met de rechten en de medewerkers lid maken"
      ],
      answer: 3,
      explain: "Een rol bundelt rechten. Nieuwe medewerkers voeg je toe met ALTER ROLE ... ADD MEMBER. Een gedeelde login maakt auditing onmogelijk."
    },
    {
      q: "Een user zit in een rol die SELECT heeft op het schema Sales. Je wilt dat juist deze user Sales.CustomerTransactions níet kan lezen. Wat doe je?",
      options: [
        "REVOKE SELECT op de rol",
        "DENY SELECT op Sales.CustomerTransactions voor deze user",
        "De tabel naar een ander schema verplaatsen",
        "Een CHECK-constraint op de tabel zetten"
      ],
      answer: 1,
      explain: "DENY wint van een GRANT die via een rol binnenkomt. Een REVOKE op de rol zou het recht voor iedereen in de rol weghalen."
    },
    {
      q: "WideWorldImporters verdeelt tabellen over Sales, Warehouse en Purchasing. Wat levert dat vooral op?",
      options: [
        "Om indexes per groep tabellen sneller op te halen",
        "Om foreign keys mogelijk te maken; die werken alleen binnen één schema",
        "Een indeling per bedrijfsonderdeel waarop je in één keer rechten kunt toekennen",
        "Om elke gebruiker een eigen kopie van de tabellen te geven"
      ],
      answer: 2,
      explain: "Schema's zijn functionele mappen en een handige eenheid voor rechten (GRANT ... ON SCHEMA::Sales). Foreign keys mogen over schema's heen verwijzen."
    },
    {
      q: "Een user heeft SELECT-rechten op de view <code>Sales.VW_OpenOrders</code>, maar géén rechten op <code>Sales.Orders</code> waar de view uit leest. Beide hebben dezelfde eigenaar. Wat gebeurt er bij <code>SELECT * FROM Sales.VW_OpenOrders</code>?",
      options: [
        "Foutmelding: rechten op de tabel ontbreken",
        "De view geeft lege resultaten terug",
        "Alleen de kolommen zonder NOT NULL worden getoond",
        "De query werkt; alleen rechten op de view zijn nodig"
      ],
      answer: 3,
      explain: "Door ownership chaining controleert SQL Server bij gelijke eigenaar alleen de rechten op de view. Zo kun je met views data afschermen."
    },
    {
      q: "Je wilt testen of de nieuwe user Hendrik écht alleen zijn eigen regio kan zien. Welk statement helpt je daarbij?",
      options: [
        "<code>EXECUTE AS USER = 'Hendrik'</code>",
        "<code>SET SHOWPLAN_ALL ON</code>",
        "<code>GRANT IMPERSONATE TO PUBLIC</code>",
        "<code>BEGIN TRAN Hendrik</code>"
      ],
      answer: 0,
      explain: "Met EXECUTE AS voer je de volgende queries uit met Hendriks rechten. Met REVERT ben je weer jezelf."
    },
    {
      q: "In de tabel <code>Sales.Notes</code> wil je bij elke INSERT automatisch vastleggen wélke database user de notitie heeft gemaakt. Wat gebruik je in de query?",
      options: [
        "<code>SELECT TOP(1) name FROM sys.users ORDER BY create_date DESC</code>",
        "<code>USER_NAME()</code>",
        "<code>CURRENT_ROLE()</code>",
        "<code>@@IDENTITY</code>"
      ],
      answer: 1,
      explain: "USER_NAME() geeft de huidige database user. De laatst aangemaakte user in sys.users zegt niets over wie nú de query uitvoert."
    },
    {
      q: "Met welke query kun je controleren of jij lid bent van de rol <code>Far West Sales</code>?",
      options: [
        "<code>SELECT * FROM sys.Roles WHERE Name = 'Far West Sales'</code>",
        "<code>EXEC sp_who 'Far West Sales'</code>",
        "<code>SELECT IS_MEMBER('Far West Sales')</code>",
        "<code>SELECT ROLE_OF(USER_NAME())</code>"
      ],
      answer: 2,
      explain: "IS_MEMBER geeft 1 als de huidige gebruiker lid is van de rol en 0 als dat niet zo is. Het is de basis voor rolgebaseerd filteren."
    },
    {
      q: "Een collega meldt: 'Ik zie in SSMS alle tabellen staan, maar bij elke SELECT krijg ik een permissiefout.' Wat is de meest waarschijnlijke oorzaak?",
      options: [
        "Zijn login heeft nog geen wachtwoord",
        "Hij heeft geen user in de database",
        "De tabellen zitten in een transactie die nog niet gecommit is",
        "Hij mist leesrechten, bijvoorbeeld de rol db_datareader"
      ],
      answer: 3,
      explain: "Hij is de database dus binnengekomen (hij heeft een user), maar heeft geen SELECT-rechten. db_datareader of een gerichte GRANT SELECT lost dat op."
    },
    {
      q: "Welke volgorde beschrijft de hiërarchie van 'buiten' naar 'binnen' correct?",
      options: [
        "Login → database user → database role",
        "Database user → login → server role",
        "Database role → login → database user",
        "Schema → login → database user"
      ],
      answer: 0,
      explain: "Je logt in op de server (login), wordt in een database een user, en die user kan lid zijn van databaserollen."
    }
  ]
});
