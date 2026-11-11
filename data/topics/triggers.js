DB3.registerTopic({
  id: "triggers",
  intro: "Een trigger is code die automatisch afgaat bij een INSERT, UPDATE of DELETE. Krachtig voor regels die een CHECK-constraint niet aankan, zoals controles over meerdere rijen of tabellen. Maar ook verraderlijk, dus je moet precies weten wanneer en hoe vaak hij draait.",
  sections: [
    {
      title: "Wat is een trigger?",
      body: `<p>Een trigger is een stukje T-SQL dat aan een tabel (of view) hangt en <strong>automatisch</strong> uitgevoerd wordt bij een datamodificatie. Je roept hem nooit zelf aan; hij gaat ook af als de wijziging uit een stored procedure, het Entity Framework of een ad-hoc query komt.</p>
<pre><code class="sql">CREATE TRIGGER TR_Customers_UD
ON Sales.Customers
AFTER UPDATE, DELETE
AS
BEGIN
    INSERT INTO Sales.CustomerHistory (CustomerID, CustomerName, ChangedAt)
    SELECT CustomerID, CustomerName, SYSDATETIME()
    FROM   deleted;          -- de oude versie van de rijen
END;</code></pre>
<ul>
<li>Je kunt abonneren op <strong>elke combinatie</strong> van INSERT, UPDATE en DELETE.</li>
<li>Er mogen meerdere triggers op dezelfde tabel en hetzelfde event staan. De <strong>volgorde waarin ze afgaan ligt niet vast</strong>; reken er dus niet op.</li>
<li>Naamgeving: <code>TR_{Tabelnaam}_{Wanneer}</code>, bijv. <code>TR_Customers_IU</code> (Insert/Update).</li>
</ul>
<div class="callout warn"><strong>Let op</strong> Triggers zijn "onzichtbare" logica en worden vaak afgeraden. Gebruik ze waar het écht nodig is, bijvoorbeeld voor regels over meerdere rijen, historie of views die je wilt kunnen vullen.</div>`
    },
    {
      title: "Eén keer per statement, niet per rij",
      body: `<p>Dit is de belangrijkste valkuil: een trigger gaat <strong>één keer per statement</strong> af, ongeacht hoeveel rijen dat statement raakt. Een UPDATE op 500 rijen = één trigger-aanroep met 500 rijen in de pseudo-tabellen. Een UPDATE die 0 rijen raakt, start de trigger ook één keer.</p>
<p>Schrijf je trigger dus altijd <strong>set-based</strong> (met joins op <code>inserted</code>/<code>deleted</code>), nooit alsof er precies één rij is:</p>
<pre><code class="sql">-- FOUT: werkt alleen als er toevallig één rij is
DECLARE @id INT = (SELECT CustomerID FROM inserted);

-- GOED: werkt voor 0, 1 of duizend rijen
UPDATE c
SET    c.LastEditedWhen = SYSDATETIME()
FROM   Sales.Customers c
JOIN   inserted i ON i.CustomerID = c.CustomerID;</code></pre>`
    },
    {
      title: "De pseudo-tabellen inserted en deleted",
      body: `<p>In een trigger heb je twee tijdelijke tabellen met dezelfde kolommen als de tabel:</p>
<table>
<thead><tr><th>Event</th><th><code>inserted</code></th><th><code>deleted</code></th></tr></thead>
<tbody>
<tr><td>INSERT</td><td>de nieuwe rijen</td><td>leeg</td></tr>
<tr><td>UPDATE</td><td>de rijen <strong>na</strong> de wijziging</td><td>de rijen <strong>vóór</strong> de wijziging</td></tr>
<tr><td>DELETE</td><td>leeg</td><td>de verwijderde rijen</td></tr>
</tbody>
</table>
<p>Er bestaat dus geen tabel <code>updated</code>, <code>old</code> of <code>new</code>. Wil je weten wat er precies veranderd is bij een UPDATE, dan <strong>join je inserted met deleted</strong> op de primary key en vergelijk je de kolommen:</p>
<pre><code class="sql">SELECT d.CustomerID, d.CreditLimit AS Oud, i.CreditLimit AS Nieuw
FROM   inserted i
JOIN   deleted  d ON d.CustomerID = i.CustomerID
WHERE  ISNULL(d.CreditLimit, -1) &lt;&gt; ISNULL(i.CreditLimit, -1);</code></pre>
<p>Zo kun je ook <strong>statusovergangen</strong> controleren. Voorbeeld: een bestelling mag alleen naar <code>Verzonden</code> als hij nu <code>Betaald</code> is. Een CHECK-constraint ziet alleen de nieuwe waarde; een trigger ziet oud én nieuw.</p>
<pre><code class="sql">IF EXISTS (SELECT 1
           FROM inserted i JOIN deleted d ON d.OrderID = i.OrderID
           WHERE i.Status = 'Verzonden' AND d.Status &lt;&gt; 'Betaald')
    THROW 50001, 'Alleen betaalde orders mogen verzonden worden.', 1;</code></pre>`
    },
    {
      title: "AFTER vs. INSTEAD OF",
      body: `<p>SQL Server kent twee soorten DML-triggers (er bestaat geen <code>BEFORE</code>):</p>
<table>
<thead><tr><th></th><th>AFTER (= FOR)</th><th>INSTEAD OF</th></tr></thead>
<tbody>
<tr><td>Wanneer</td><td>Ná de wijziging (constraints zijn al gecontroleerd)</td><td><em>In plaats van</em> de wijziging; de oorspronkelijke actie gebeurt niet</td></tr>
<tr><td>Op</td><td>Tabellen</td><td>Tabellen en views</td></tr>
<tr><td>Aantal</td><td>Meerdere per event</td><td><strong>Maximaal één</strong> per event per tabel/view</td></tr>
<tr><td>Typisch</td><td>Historie, extra controles over rijen heen</td><td>Een view over meerdere tabellen insertbaar maken</td></tr>
</tbody>
</table>
<pre><code class="sql">CREATE TRIGGER TR_VW_Geolocation_IOI
ON Application.VW_Geolocation
INSTEAD OF INSERT
AS
BEGIN
    -- 1. Land toevoegen als het nog niet bestaat
    -- 2. Provincie toevoegen als die nog niet bestaat
    -- 3. Stad toevoegen
    INSERT INTO Application.Cities (CityName, StateProvinceID, LastEditedBy)
    SELECT i.CityName, sp.StateProvinceID, 1
    FROM   inserted i
    JOIN   Application.StateProvinces sp ON sp.StateProvinceName = i.StateProvinceName;
END;</code></pre>
<p>Doet de INSTEAD OF-trigger zelf een INSERT in een tabel, dan worden de constraints van die tabel daarbij gewoon gecontroleerd.</p>
<div class="callout warn"><strong>Klassieke fout</strong> In een <em>AFTER INSERT</em>-trigger de rijen uit <code>inserted</code> nog een keer in dezelfde tabel inserten. De rij staat er dan dubbel in. Wil je de nieuwe rij aanpassen, doe dan een <code>UPDATE ... JOIN inserted</code>.</div>`
    },
    {
      title: "Fouten en transacties",
      body: `<p>Een trigger draait <strong>binnen dezelfde transactie</strong> als het statement dat hem afvuurde. Gaat er in de trigger iets mis (een error, of je roept zelf <code>THROW</code>/<code>ROLLBACK</code> aan), dan wordt <strong>de hele transactie teruggedraaid</strong>, inclusief de oorspronkelijke INSERT/UPDATE/DELETE. Er komt niets in een wachtrij en er blijft geen half resultaat achter.</p>
<p>Dat maakt een trigger geschikt om regels af te dwingen die een CHECK-constraint niet kan uitdrukken:</p>
<table>
<thead><tr><th>Regel</th><th>Oplossing</th></tr></thead>
<tbody>
<tr><td>Kolomwaarde binnen één rij (prijs &gt; 0, einddatum na begindatum)</td><td>CHECK-constraint</td></tr>
<tr><td>Over meerdere rijen in dezelfde tabel (max. één declaratie per medewerker per dag)</td><td>UNIQUE-constraint of <strong>trigger</strong></td></tr>
<tr><td>Over meerdere tabellen (totaal orderregels ≤ kredietlimiet klant)</td><td><strong>Trigger</strong></td></tr>
<tr><td>Oud vs. nieuw (statusovergang)</td><td><strong>Trigger</strong></td></tr>
</tbody>
</table>`
    }
  ],
  keyPoints: [
    "Triggers gaan <strong>automatisch</strong> af bij INSERT, UPDATE en/of DELETE, ook vanuit stored procedures.",
    "Een trigger draait <strong>één keer per statement</strong>, niet per rij: schrijf hem set-based.",
    "Beschikbare pseudo-tabellen: <code>inserted</code> en <code>deleted</code>. Bij een UPDATE heb je ze allebei.",
    "Wat er gewijzigd is vind je door <code>inserted</code> te joinen met <code>deleted</code>.",
    "Alle combinaties van INSERT, UPDATE en DELETE zijn mogelijk in één trigger.",
    "AFTER-triggers mogen meervoudig zijn; INSTEAD OF maximaal één per event per tabel/view.",
    "De volgorde van meerdere triggers ligt niet vast.",
    "INSTEAD OF gebruik je vooral om een view over meerdere tabellen insertbaar te maken.",
    "Een fout in een trigger draait de <strong>hele transactie</strong> terug.",
    "Kies een trigger boven een CHECK-constraint bij regels over meerdere rijen/tabellen of oud-vs-nieuw."
  ],
  pitfalls: [
    { wrong: "Een trigger gaat af voor elke rij die geraakt wordt.", right: "Een trigger gaat één keer per statement af; <code>inserted</code>/<code>deleted</code> kunnen dus 0, 1 of veel rijen bevatten." },
    { wrong: "Bij een UPDATE-trigger heb je de tabel <code>updated</code> (of old/new).", right: "Je hebt <code>inserted</code> (nieuwe waarden) en <code>deleted</code> (oude waarden)." },
    { wrong: "In een AFTER INSERT-trigger pas je de nieuwe rij aan door hem opnieuw te inserten.", right: "Dan staat de rij er dubbel in. Gebruik een UPDATE met een JOIN op <code>inserted</code>." },
    { wrong: "Als de trigger faalt, blijft de oorspronkelijke wijziging toch staan.", right: "De trigger zit in dezelfde transactie; alles wordt teruggedraaid." },
    { wrong: "Triggers worden op alfabetische volgorde of op volgorde van aanmaken uitgevoerd.", right: "Er is geen gegarandeerde volgorde. Bouw nooit logica die daarop rekent." },
    { wrong: "Je kiest een trigger zodra je ook bij een UPDATE wilt valideren.", right: "Een CHECK-constraint valideert ook bij UPDATE. Een trigger kies je voor controles over rijen of tabellen heen, of voor oud-vs-nieuw." },
    { wrong: "Je hebt een BEFORE-trigger nodig om data te kunnen wijzigen.", right: "SQL Server kent geen BEFORE-triggers, alleen AFTER en INSTEAD OF." }
  ],
  flashcards: [
    { front: "Op welke events kan een DML-trigger reageren?", back: "INSERT, UPDATE, DELETE, in elke combinatie." },
    { front: "Hoe vaak gaat een trigger af bij een UPDATE op 300 rijen?", back: "Eén keer (per statement)." },
    { front: "In een UPDATE-trigger wil je de oude prijs naast de nieuwe zetten. Waar vind je welke?", back: "Oude waarde in <code>deleted</code>, nieuwe waarde in <code>inserted</code>; join ze op de primary key." },
    { front: "Hoe zie je wat er veranderd is bij een UPDATE?", back: "Join <code>inserted</code> met <code>deleted</code> op de primary key en vergelijk de kolommen." },
    { front: "Twee soorten DML-triggers in SQL Server", back: "AFTER (= FOR) en INSTEAD OF. Geen BEFORE." },
    { front: "Hoeveel INSTEAD OF INSERT-triggers kan een tabel hebben?", back: "Eén." },
    { front: "Typische use case voor INSTEAD OF", back: "Een view over meerdere (gejoinde) tabellen toch kunnen vullen met INSERT." },
    { front: "Een AFTER UPDATE-trigger gooit een fout met <code>THROW</code>. Wat blijft er over van de UPDATE die hem startte?", back: "Niets: de fout breekt de hele transactie af, inclusief de oorspronkelijke UPDATE." },
    { front: "In welke volgorde gaan meerdere triggers af?", back: "Niet vastgelegd: geen gegarandeerde volgorde." },
    { front: "Trigger of CHECK-constraint voor 'status mag alleen van Gehuwd naar Gescheiden'?", back: "Trigger, want je moet de oude waarde vergelijken met de nieuwe." },
    { front: "Naamgevingsconventie", back: "<code>TR_{Tabelnaam}_{Wanneer}</code>, bijv. <code>TR_Customers_UD</code>." },
    { front: "Moet je een trigger zelf aanroepen?", back: "Nee, hij gaat automatisch af, ook bij wijzigingen vanuit stored procedures." }
  ],
  quiz: [
    {
      q: "Een UPDATE-statement wijzigt 250 rijen in Sales.Orders. Er staat één AFTER UPDATE-trigger op die tabel. Hoe vaak wordt de trigger uitgevoerd?",
      options: ["250 keer", "Eén keer", "Eén keer per transactie, ongeacht het aantal statements", "Pas wanneer de server tijd heeft"],
      answer: 1,
      explain: "Een trigger gaat één keer per statement af. De 250 rijen staan samen in inserted en deleted."
    },
    {
      q: "Je wilt in een UPDATE-trigger loggen wat de oude én de nieuwe kredietlimiet van een klant was. Hoe kom je daaraan?",
      options: [
        "De oude waarde staat nog in de tabel, de nieuwe in inserted",
        "Via de pseudo-tabel updated",
        "Door inserted te joinen met deleted op CustomerID",
        "Dat kan niet; een trigger ziet alleen de nieuwe waarde"
      ],
      answer: 2,
      explain: "deleted bevat de rijen vóór de update, inserted erna. Op het moment dat een AFTER-trigger draait, staat de nieuwe waarde al in de tabel."
    },
    {
      q: "In een DELETE-trigger wil je de verwijderde klanten archiveren. Welke query hoort in de trigger?",
      options: [
        "<code>INSERT INTO Archief SELECT * FROM inserted</code>",
        "<code>INSERT INTO Archief SELECT * FROM deleted</code>",
        "<code>INSERT INTO Archief SELECT * FROM old</code>",
        "<code>INSERT INTO Archief SELECT * FROM Sales.Customers</code>"
      ],
      answer: 1,
      explain: "Bij een DELETE staan de weggehaalde rijen in deleted; inserted is dan leeg. Pseudo-tabellen met de namen old of new bestaan in SQL Server niet."
    },
    {
      q: "<code>CREATE TRIGGER TR_Orders_I ON Sales.Orders AFTER INSERT AS BEGIN INSERT INTO Sales.Orders SELECT * FROM inserted END</code>. Wat is het probleem?",
      options: [
        "AFTER moet BEFORE zijn",
        "Je mag niet uit inserted selecteren",
        "Een trigger mag geen BEGIN/END bevatten",
        "Elke nieuwe order komt dubbel in de tabel"
      ],
      answer: 3,
      explain: "Bij een AFTER-trigger staat de rij er al. Nog eens inserten maakt een kopie (en kan de trigger zelfs opnieuw starten)."
    },
    {
      q: "Je probeert op Sales.Orders een tweede INSTEAD OF INSERT-trigger aan te maken naast een bestaande. Wat gebeurt er?",
      options: [
        "Beide triggers draaien, in volgorde van aanmaken",
        "De nieuwe vervangt de oude automatisch",
        "SQL Server weigert dat: per tabel of view is er maar één INSTEAD OF-trigger per actie",
        "Het mag alleen als de tweede trigger een andere naam heeft"
      ],
      answer: 2,
      explain: "Van AFTER-triggers mag je er meerdere hebben, van INSTEAD OF maar één per actie (INSERT, UPDATE of DELETE) per object."
    },
    {
      q: "<code>VW_KlantMetStad</code> joint Customers en Cities. Een INSERT op de view geeft een fout. Wat laat de INSERT toch werken?",
      options: [
        "Een AFTER INSERT-trigger op Customers",
        "Een CHECK-constraint op de view",
        "Een INSTEAD OF INSERT-trigger op de view die zelf in beide tabellen schrijft",
        "SCHEMABINDING op de view"
      ],
      answer: 2,
      explain: "Een INSERT op een view over meerdere tabellen kan SQL Server niet zelf verdelen. Een INSTEAD OF-trigger neemt die actie over en schrijft de juiste rijen."
    },
    {
      q: "Er staan drie AFTER INSERT-triggers op dezelfde tabel. In welke volgorde gaan ze af?",
      options: [
        "Op volgorde van aanmaken",
        "Alfabetisch op naam",
        "Van kleinste naar grootste trigger",
        "Daar is geen vaste volgorde voor"
      ],
      answer: 3,
      explain: "De volgorde is niet gegarandeerd. Ontwerp je triggers zo dat ze onafhankelijk van elkaar werken."
    },
    {
      q: "In een AFTER UPDATE-trigger wordt een fout gegooid. Wat is de toestand daarna?",
      options: [
        "De update is opgeslagen, alleen het werk van de trigger niet",
        "Alles is teruggedraaid: de update én het werk van de trigger",
        "De update staat in een wachtrij om later opnieuw te proberen",
        "Alleen de eerste rij van de update is opgeslagen"
      ],
      answer: 1,
      explain: "Trigger en statement zitten in dezelfde transactie. Een fout in de trigger draait alles terug."
    },
    {
      q: "Welke regel kun je NIET met een CHECK-constraint afdwingen en heb je dus een trigger (of iets anders) voor nodig?",
      options: [
        "De einddatum ligt na de begindatum",
        "Een korting ligt tussen 0 en 50 procent",
        "Een order mag alleen op 'Verzonden' als de vorige status 'Betaald' was",
        "Een postcode bestaat uit 4 cijfers en 2 letters"
      ],
      answer: 2,
      explain: "Een CHECK ziet alleen de nieuwe rij. Voor een statusovergang moet je de oude waarde kennen, en die staat in deleted."
    },
    {
      q: "Op welke combinaties van events kan één trigger reageren?",
      options: [
        "Alleen op één event per trigger",
        "INSERT en UPDATE samen, maar DELETE altijd apart",
        "UPDATE en DELETE samen, maar INSERT altijd apart",
        "Op elke combinatie van INSERT, UPDATE en DELETE"
      ],
      answer: 3,
      explain: "Je mag bijvoorbeeld AFTER INSERT, UPDATE, DELETE in één trigger zetten. Met inserted/deleted zie je welke actie het was."
    },
    {
      q: "Een stored procedure doet een INSERT in een tabel waar een AFTER INSERT-trigger op staat. Wat gebeurt er met de trigger?",
      options: [
        "Hij gaat gewoon af",
        "Hij gaat niet af, want stored procedures slaan triggers over",
        "Hij gaat alleen af als de procedure hem expliciet aanroept",
        "Hij gaat pas af na de COMMIT van de procedure"
      ],
      answer: 0,
      explain: "Triggers zijn gekoppeld aan de tabel. Het maakt niet uit waar de INSERT vandaan komt."
    },
    {
      q: "Welke regel kun je wel met een CHECK afdwingen en heb je dus GEEN trigger voor nodig?",
      options: [
        "Een klant mag maximaal drie openstaande orders hebben",
        "De einddatum van een contract ligt na de begindatum",
        "De totaalprijs van een order is de som van de regels",
        "Een prijs mag per wijziging hooguit 10% stijgen"
      ],
      answer: 1,
      explain: "Begin- en einddatum staan in dezelfde rij, dus een CHECK volstaat. De andere regels kijken naar andere rijen of naar de oude waarde, en daarvoor heb je een trigger nodig."
    }
  ]
});
