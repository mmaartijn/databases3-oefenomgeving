DB3.registerTopic({
  id: "constraints",
  intro: "Constraints bewaken je business rules zo dicht mogelijk bij de bron: in de database zelf. Of de data nu via je eigen app, een import of een andere applicatie binnenkomt, de regel geldt altijd. Weten wat een CHECK constraint wél en níet kan, is de kern van dit onderwerp.",
  sections: [
    {
      title: "Business rules en data-integriteit",
      body: `<p>Data heeft alleen waarde als ze <strong>valide</strong> is: ze voldoet aan de regels van de organisatie (de <em>business rules</em>). Een business requirement zegt wat het systeem moet kunnen ("je kunt een product toevoegen"); een business rule zegt welke regel daarbij geldt ("een productcode komt maar één keer voor").</p>
<p>Goede business rules zijn:</p>
<ul>
<li><strong>Continu waar</strong> – op elk moment moet je kunnen zeggen dat de regel klopt. "De verloopdatum ligt in de toekomst" is níet continu waar: morgen is hij misschien verlopen.</li>
<li><strong>Opgesplitst</strong> – één regel per controle, niet drie regels in één zin.</li>
<li><strong>Onderling consistent</strong> en <strong>helder</strong>.</li>
</ul>
<p>Je beschermt data zo dicht mogelijk bij de bron. Al gebruikt: <code>PRIMARY KEY</code>, <code>FOREIGN KEY</code>, datatypes, <code>NOT NULL</code>, <code>DEFAULT</code>, <code>UNIQUE</code>. Nieuw: <code>CHECK</code> constraints, triggers, views en stored procedures (in combinatie met permissions).</p>
<div class="callout tip"><strong>Tip</strong> Constraints horen bij de C van ACID (Consistency): ze worden gecontroleerd bij elke INSERT en UPDATE op de tabel. Is het resultaat ongeldig, dan volgt een foutmelding en wordt de wijziging teruggedraaid.</div>`
    },
    {
      title: "CHECK constraint: één rij, meerdere kolommen mag",
      body: `<p>Een <code>CHECK</code> constraint is een voorwaarde die voor <strong>elke afzonderlijke rij</strong> waar moet zijn. Binnen die rij mag je <strong>meerdere kolommen</strong> gebruiken en ze met elkaar vergelijken.</p>
<pre><code class="sql">-- Twee kolommen van dezelfde rij vergelijken
ALTER TABLE Sales.Orders
ADD CONSTRAINT CK_Orders_ExpectedDeliveryDate_AfterOrderDate
CHECK (ExpectedDeliveryDate &gt;= OrderDate);

-- Een optionele kolom: NULL is toegestaan, anders na de orderdatum
ALTER TABLE Sales.Orders
ADD CONSTRAINT CK_Orders_PickingCompletedWhen_AfterOrderDate
CHECK (PickingCompletedWhen IS NULL OR PickingCompletedWhen &gt;= OrderDate);</code></pre>
<p><strong>Waarom werkt dit ook als een kolom NULL is?</strong> Een vergelijking met NULL levert <em>UNKNOWN</em> op. Een CHECK constraint weigert alleen als de uitkomst <strong>FALSE</strong> is; UNKNOWN wordt doorgelaten. De kolommen hoeven dus niet allebei NOT NULL te zijn. Wil je NULL expliciet regelen, schrijf het dan zoals hierboven.</p>
<h4>Voorwaardelijke regels ("als X, dan moet Y")</h4>
<p>Een regel als "als de betaalmethode <code>'Overig'</code> is, moet de omschrijving gevuld zijn" schrijf je als: <em>óf het is niet die situatie, óf de voorwaarde is vervuld</em>.</p>
<pre><code class="sql">ALTER TABLE Payment
ADD CONSTRAINT CK_Payment_Method_Description_OtherNeedsText
CHECK (Method &lt;&gt; 'Overig' OR Description IS NOT NULL);</code></pre>
<div class="callout exam"><strong>Toetstip</strong> "Als A dan B" schrijf je in een CHECK als <code>NOT A OR B</code>. Dat is één constraint over meerdere kolommen; je hebt geen twee constraints nodig die naar elkaar verwijzen.</div>`
    },
    {
      title: "Formaten controleren met LIKE",
      body: `<p>T-SQL heeft geen reguliere expressies in een CHECK. Je gebruikt <code>LIKE</code> met <strong>patronen</strong>: <code>[0-9]</code> is één cijfer, <code>[A-Z]</code> één letter, en een gewone spatie of streepje moet letterlijk zo voorkomen.</p>
<pre><code class="sql">-- Nederlandse postcode: 4 cijfers + 2 letters
ALTER TABLE Address
ADD CONSTRAINT CK_Address_PostalCode_Format
CHECK (PostalCode LIKE '[0-9][0-9][0-9][0-9][A-Z][A-Z]');

-- Kenteken in de vorm 12-AB-34
ALTER TABLE Vehicle
ADD CONSTRAINT CK_Vehicle_LicensePlate_Format
CHECK (LicensePlate LIKE '[0-9][0-9]-[A-Z][A-Z]-[0-9][0-9]');</code></pre>
<p>Waarom niet anders?</p>
<ul>
<li><code>=</code> vergelijkt letterlijk; met <code>=</code> kun je geen patroon testen.</li>
<li><code>ISNUMERIC()</code> zegt alleen of iets als getal te lezen is, niets over de positie van spaties of streepjes (en accepteert ook dingen als <code>'1e5'</code>).</li>
<li>Casten naar <code>INT</code> faalt op spaties/letters en gooit voorloopnullen weg.</li>
</ul>`
    },
    {
      title: "Wat een CHECK níet kan",
      body: `<p>Een CHECK ziet alleen de <strong>nieuwe waarden van de huidige rij</strong>. Daardoor kan hij niet:</p>
<table>
<thead><tr><th>Regel</th><th>Waarom geen CHECK</th><th>Wat dan wel</th></tr></thead>
<tbody>
<tr><td>"Een klant mag maar één review per product plaatsen"</td><td>Gaat over rijen <em>onderling</em>; subqueries zijn in een CHECK niet toegestaan</td><td><code>UNIQUE (CustomerID, ProductID)</code></td></tr>
<tr><td>"De klant moet bestaan"</td><td>Lookup in een andere tabel</td><td><code>FOREIGN KEY</code></td></tr>
<tr><td>"Status mag alleen van Besteld naar Verzonden, niet terug"</td><td>Vergelijkt <em>oude</em> met <em>nieuwe</em> waarde; de CHECK kent de oude niet</td><td><code>TRIGGER</code> (inserted vs deleted)</td></tr>
<tr><td>"Totaal van alle regels ≤ kredietlimiet"</td><td>Meerdere rijen/tabellen</td><td><code>TRIGGER</code></td></tr>
</tbody>
</table>
<p>Ook stored procedures aanroepen of variabelen declareren kan niet in een CHECK: het is één booleaanse expressie.</p>
<pre><code class="sql">-- Een bezoeker mag zich maar één keer per evenement aanmelden
ALTER TABLE Registration
ADD CONSTRAINT UQ_Registration_VisitorID_EventID UNIQUE (VisitorID, EventID);</code></pre>
<div class="callout exam"><strong>Toetstip</strong> Het grootste verschil: <strong>UNIQUE</strong> kijkt naar de <strong>hele tabel</strong> (rijen onderling), <strong>CHECK</strong> naar <strong>één rij</strong>. Beide mogen meerdere kolommen bevatten en beide worden bij INSERT én UPDATE gecontroleerd.</div>`
    },
    {
      title: "Naamgeving en overbodige constraints",
      body: `<p>De cursusconventie is <code>CK_Tabel_Kolommen_Regel</code> (en <code>UQ_Tabel_Kolommen</code>). Waarom? Bij een overtreding noemt SQL Server de <strong>naam van de constraint</strong> in de foutmelding:</p>
<pre><code class="sql">The INSERT statement conflicted with the CHECK constraint
"CK_Address_PostalCode_Format". The conflict occurred in database ...</code></pre>
<p>Aan die naam zie je meteen welke tabel, welke kolom en welke regel er misging. Een automatisch gegenereerde naam als <code>CK__Address__Posta__5EBF139D</code> zegt niets.</p>
<h4>Overbodig = ongewenst</h4>
<p>Controleer niet met een CHECK wat de <strong>kolomdefinitie</strong> al regelt. Een maximale lengte stel je in met het datatype (<code>VARCHAR(10)</code>), niet met <code>CHECK (LEN(Code) &lt;= 10)</code>. En <code>... IS NULL OR ...</code> toevoegen is bij een nullable kolom vaak dubbelop, omdat NULL een CHECK toch al passeert.</p>
<pre><code class="sql">-- Onnodig: dit hoort in het datatype
CHECK (Nickname IS NULL OR LEN(Nickname) &lt;= 20)
-- Beter:
Nickname VARCHAR(20) NULL</code></pre>`
    },
    {
      title: "Constraints en kolommen toevoegen aan een bestaande tabel",
      body: `<p><strong>Een CHECK constraint toevoegen</strong> kan op elk moment met <code>ALTER TABLE ... ADD CONSTRAINT</code>, ook als de tabel al rijen bevat. SQL Server controleert dan alle bestaande rijen: dat lukt <strong>alleen als de huidige data aan de constraint voldoet</strong>. Is er één rij die de regel overtreedt, dan mislukt de ALTER TABLE. Ruim dus eerst de data op.</p>
<p><strong>Een kolom toevoegen</strong> geeft een fout als de nieuwe kolom <code>NOT NULL</code> is (zonder default) terwijl er al rijen zijn: die rijen hebben voor die kolom geen waarde. Daarom werkt de voorbeelduitwerking in drie stappen:</p>
<pre><code class="sql">ALTER TABLE Application.Cities ADD ValidFromDate DATETIME2 NULL;   -- 1. nullable toevoegen
UPDATE Application.Cities SET ValidFromDate = '19000101';          -- 2. bestaande rijen vullen
ALTER TABLE Application.Cities ALTER COLUMN ValidFromDate DATETIME2 NOT NULL; -- 3. NOT NULL maken</code></pre>
<div class="callout warn"><strong>Let op</strong> Een nieuwe kolom is bij bestaande rijen leeg (NULL), dus bestaande CHECK constraints op andere kolommen geven daarbij geen fout, en indexen of views zitten het toevoegen van een kolom niet in de weg.</div>`
    }
  ],
  keyPoints: [
    "Een <strong>CHECK</strong> geldt per <strong>rij</strong> en mag meerdere kolommen van die rij gebruiken en vergelijken (bv. <code>EndDate &gt;= StartDate</code>).",
    "\"Als A dan B\" schrijf je als <code>NOT A OR B</code> in één CHECK constraint.",
    "CHECK weigert alleen bij <strong>FALSE</strong>; NULL-vergelijkingen (UNKNOWN) worden doorgelaten.",
    "Geen subqueries, stored procedures, variabelen of lookups in andere tabellen in een CHECK.",
    "Uniek over rijen heen → <code>UNIQUE</code>; bestaan in andere tabel → <code>FOREIGN KEY</code>; oud vs nieuw of meerdere rijen/tabellen → <strong>trigger</strong>.",
    "<strong>UNIQUE</strong> = hele tabel, <strong>CHECK</strong> = één rij. Beide worden bij INSERT en UPDATE gecontroleerd.",
    "Formaten valideer je met <code>LIKE</code> en patronen als <code>[0-9]</code> en <code>[A-Z]</code>; T-SQL kent geen regex in een CHECK.",
    "Naam <code>CK_Tabel_Kolommen_Regel</code>: de naam staat in de foutmelding, zo zie je direct wat er mis is.",
    "Wat het datatype al regelt (zoals maximale lengte) zet je niet nog eens in een CHECK.",
    "Een CHECK toevoegen aan een gevulde tabel kan alleen als de <strong>bestaande data voldoet</strong>.",
    "Een <code>NOT NULL</code>-kolom (zonder default) toevoegen aan een tabel met rijen geeft een fout."
  ],
  pitfalls: [
    { wrong: "Een CHECK constraint kan maar naar één kolom kijken.", right: "Een CHECK mag alle kolommen van dezelfde rij gebruiken en combineren met AND/OR, en kolommen onderling vergelijken." },
    { wrong: "Om te controleren dat een combinatie maar één keer voorkomt, schrijf ik een subquery in de CHECK.", right: "Subqueries zijn niet toegestaan in een CHECK. Uniciteit over rijen heen regel je met een UNIQUE constraint." },
    { wrong: "Twee datums vergelijken in een CHECK lukt alleen als beide kolommen NOT NULL zijn.", right: "Dat werkt altijd. Is een van beide NULL, dan is de uitkomst UNKNOWN en laat de CHECK de rij door." },
    { wrong: "Een statusovergang (bv. alleen van 'Besteld' naar 'Verzonden') kun je in een CHECK vastleggen.", right: "Een CHECK kent alleen de nieuwe waarde. Voor oud-vs-nieuw heb je een trigger nodig die inserted met deleted vergelijkt." },
    { wrong: "Formaten controleer je met ISNUMERIC() of door naar INT te casten.", right: "Gebruik LIKE met patronen zoals '[0-9][0-9] [A-Z]'; alleen dan controleer je ook de positie van spaties en tekens." },
    { wrong: "Een CHECK kun je alleen in CREATE TABLE zetten, of alleen op een lege tabel.", right: "ALTER TABLE ... ADD CONSTRAINT mag altijd, mits de bestaande rijen aan de regel voldoen." },
    { wrong: "Extra CHECKs voor maximale lengte maken je database veiliger.", right: "Die zijn overbodig: de lengte leg je vast in het datatype, bv. VARCHAR(20)." }
  ],
  flashcards: [
    { front: "Waarover gaat een CHECK constraint?", back: "Over <strong>één rij</strong>: een booleaanse voorwaarde op de kolommen van die rij." },
    { front: "Waarover gaat een UNIQUE constraint?", back: "Over de <strong>hele tabel</strong>: geen twee rijen met dezelfde (combinatie van) waarde(n)." },
    { front: "Hoe schrijf je \"als A dan B\" in een CHECK?", back: "<code>CHECK (NOT A OR B)</code>, bv. <code>Method &lt;&gt; 'Overig' OR Description IS NOT NULL</code>." },
    { front: "Wanneer weigert een CHECK een rij?", back: "Alleen als de expressie <strong>FALSE</strong> is. UNKNOWN (door NULL) wordt doorgelaten." },
    { front: "Mag je in een CHECK een subquery gebruiken?", back: "Nee. Ook geen stored procedures, variabelen of lookups in andere tabellen." },
    { front: "Patroon voor een postcode als 1234AB", back: "<code>LIKE '[0-9][0-9][0-9][0-9][A-Z][A-Z]'</code>" },
    { front: "Naamconventie CHECK constraint", back: "<code>CK_Tabel_Kolommen_Regel</code>, want de naam verschijnt in de foutmelding." },
    { front: "Naamconventie UNIQUE constraint", back: "<code>UQ_Tabel_Kolommen</code>, bv. <code>UQ_Module_Naam_Schooljaar</code>" },
    { front: "Wanneer lukt ALTER TABLE ... ADD CONSTRAINT CK_...?", back: "Als alle <strong>bestaande rijen</strong> aan de voorwaarde voldoen." },
    { front: "<code>ALTER TABLE Sales.Customers ADD Segment varchar(20) NOT NULL;</code> faalt. Noem twee manieren om het te laten slagen.", back: "Een <code>DEFAULT</code> meegeven, of eerst nullable toevoegen, vullen en daarna NOT NULL maken." },
    { front: "Oude waarde vergelijken met nieuwe waarde: welk middel?", back: "Een <strong>trigger</strong> (deleted = oud, inserted = nieuw)." },
    { front: "Wanneer worden constraints gecontroleerd?", back: "Bij elke data-modificatie van de tabel (INSERT/UPDATE); bij een overtreding volgt een fout en rollback." },
    { front: "Wat is een business rule (vs. requirement)?", back: "Een regel die altijd geldt (\"een e-mailadres komt één keer voor\"); een requirement beschrijft wat het systeem doet." },
    { front: "Waarom geen CHECK voor maximale lengte?", back: "Dat regelt het datatype al (<code>VARCHAR(n)</code>), dus de CHECK is overbodig." }
  ],
  quiz: [
    {
      q: "Een webshop wil afdwingen dat de kortingsprijs van een product nooit hoger is dan de normale prijs (beide kolommen in dezelfde tabel; de kortingsprijs mag leeg zijn). Kan dat met een CHECK constraint?",
      options: [
        "Nee, een CHECK kan maar één kolom tegelijk controleren.",
        "Ja, maar alleen als beide kolommen NOT NULL zijn.",
        "Ja, bv. CHECK (DiscountPrice <= Price); een lege kortingsprijs wordt doorgelaten.",
        "Nee, daarvoor moet je een trigger gebruiken."
      ],
      answer: 2,
      explain: "Een CHECK mag kolommen van dezelfde rij met elkaar vergelijken. Is DiscountPrice NULL, dan is de uitkomst UNKNOWN en wordt de rij doorgelaten. Een trigger is hier niet nodig, want het gaat om één rij."
    },
    {
      q: "Bij een bibliotheek moet een uitlening met status <code>'Verloren'</code> altijd een vervangingsbedrag hebben. Welke CHECK past daarbij?",
      options: [
        "CHECK (Status = 'Verloren' AND ReplacementFee IS NOT NULL)",
        "CHECK (Status <> 'Verloren' OR ReplacementFee IS NOT NULL)",
        "CHECK (ReplacementFee IS NOT NULL)",
        "Dit kan niet: een CHECK kan niet lezen welke status er staat."
      ],
      answer: 1,
      explain: "'Als A dan B' = 'NOT A OR B'. De AND-variant zou ervoor zorgen dat élke uitlening de status Verloren moet hebben. Optie C verplicht het bedrag voor alle uitleningen."
    },
    {
      q: "Een sportclub wil dat een lid zich per training maar één keer kan inschrijven (tabel met LidId, TrainingId). Wat is de juiste oplossing?",
      options: [
        "Een UNIQUE constraint op (LidId, TrainingId).",
        "Een CHECK met een subquery die telt of de combinatie al bestaat.",
        "Een CHECK die een stored procedure aanroept.",
        "Een CHECK op LidId en een aparte CHECK op TrainingId."
      ],
      answer: 0,
      explain: "Dit gaat over rijen onderling, en dat kan een CHECK niet (geen subqueries of procedures). UNIQUE kijkt over de hele tabel."
    },
    {
      q: "Welke CHECK controleert dat een artikelcode bestaat uit drie hoofdletters, een streepje en vier cijfers (bv. <code>ABC-1234</code>)?",
      options: [
        "CHECK (ISNUMERIC(RIGHT(Code, 4)) = 1)",
        "CHECK (Code = '[A-Z]{3}-[0-9]{4}')",
        "CHECK (CAST(Code AS INT) > 0)",
        "CHECK (Code LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9][0-9]')"
      ],
      answer: 3,
      explain: "LIKE met tekenklassen per positie is de manier. '=' doet geen patroonherkenning, en de {3}-notatie is regex-syntax die T-SQL niet kent. ISNUMERIC controleert maar een deel."
    },
    {
      q: "Je krijgt deze fout: <code>conflicted with the CHECK constraint \"CK_Booking_EndDate_AfterStartDate\"</code>. Wat is het voordeel van de naamconventie hier?",
      options: [
        "SQL Server kan de constraint daardoor sneller uitvoeren.",
        "De constraint mag alleen kolommen gebruiken die in de naam staan.",
        "Je ziet direct welke tabel, kolom en regel overtreden zijn.",
        "SSMS sorteert de constraints daardoor alfabetisch."
      ],
      answer: 2,
      explain: "De naam staat in de foutmelding, dus een beschrijvende naam vertelt meteen wat er misging. De naam heeft geen invloed op wat de constraint mag gebruiken of op de snelheid."
    },
    {
      q: "Je wilt twee regels afdwingen: (1) een e-mailadres komt maar één keer voor, (2) een leeftijd ligt tussen 16 en 120. Welke combinatie past?",
      options: [
        "(1) CHECK, (2) UNIQUE",
        "(1) UNIQUE, want die vergelijkt met andere rijen; (2) CHECK, want die kijkt naar één rij",
        "Beide met een CHECK",
        "Beide met een UNIQUE"
      ],
      answer: 1,
      explain: "Uniek zijn kun je alleen beoordelen door naar de andere rijen te kijken: dat doet UNIQUE. Een bereik controleren gaat per rij: dat doet CHECK. Beide worden bij INSERT en UPDATE gecontroleerd."
    },
    {
      q: "Wat is ongewenst aan deze constraint op een kolom <code>Code VARCHAR(50) NULL</code>?",
      code: "ALTER TABLE Product\nADD CONSTRAINT CK_Product_Code_MaxLength CHECK (Code IS NULL OR LEN(Code) <= 8)",
      options: [
        "IS NULL moet = NULL zijn.",
        "OR moet AND zijn.",
        "Je moet hiervoor twee aparte constraints maken.",
        "Het is overbodig: de maximale lengte hoort in de kolomdefinitie (VARCHAR(8))."
      ],
      answer: 3,
      explain: "De lengte leg je vast in het datatype. 'IS NULL' is juist correct ('= NULL' werkt nooit), en de OR-combinatie mag gewoon in één constraint."
    },
    {
      q: "Je voert <code>ALTER TABLE Sales.Orders ADD CONSTRAINT CK_Orders_Quantity_Positive CHECK (Quantity &gt; 0)</code> uit op een tabel met duizenden orders. Wanneer lukt dit?",
      options: [
        "Nooit, een CHECK kan alleen bij CREATE TABLE.",
        "Alleen als de tabel leeg is.",
        "Als alle bestaande orders een Quantity groter dan 0 hebben.",
        "Altijd; de constraint geldt alleen voor nieuwe rijen."
      ],
      answer: 2,
      explain: "Een CHECK kun je altijd later toevoegen, maar SQL Server controleert dan de bestaande data. Voldoet één rij niet, dan mislukt het."
    },
    {
      q: "Welk statement geeft gegarandeerd een fout als de tabel <code>Customer</code> al rijen bevat?",
      options: [
        "ALTER TABLE Customer ADD LoyaltyPoints INT NOT NULL",
        "ALTER TABLE Customer ADD LoyaltyPoints INT NULL",
        "ALTER TABLE Customer ADD LoyaltyPoints INT NOT NULL DEFAULT 0",
        "ALTER TABLE Customer ADD Remarks VARCHAR(200) NULL"
      ],
      answer: 0,
      explain: "Bestaande rijen hebben geen waarde voor de nieuwe kolom. NOT NULL zonder default kan dus niet. Met een DEFAULT of als nullable kolom gaat het goed."
    },
    {
      q: "Een ticketsysteem mag de prioriteit alleen verhogen, nooit verlagen. Hoe dwing je dat af in de database?",
      options: [
        "Met een CHECK die Priority >= Priority controleert.",
        "Met een UPDATE-trigger die de nieuwe waarde (inserted) vergelijkt met de oude (deleted).",
        "Met een UNIQUE constraint op Priority.",
        "Met een index gesorteerd op Priority."
      ],
      answer: 1,
      explain: "Een CHECK ziet alleen de nieuwe rij en weet niet wat de vorige waarde was. In een trigger heb je zowel deleted (oud) als inserted (nieuw)."
    },
    {
      q: "Een CHECK <code>CHECK (EndTime &gt; StartTime)</code> staat op een tabel. Je voegt een rij in met <code>EndTime = NULL</code>. Wat gebeurt er?",
      options: [
        "De rij wordt geweigerd, omdat NULL niet groter is dan StartTime.",
        "SQL Server vult EndTime automatisch met StartTime.",
        "Je krijgt een syntaxfout.",
        "De rij wordt geaccepteerd, omdat de uitkomst UNKNOWN is en niet FALSE."
      ],
      answer: 3,
      explain: "Een CHECK weigert alleen als de uitkomst FALSE is. Een vergelijking met NULL geeft UNKNOWN en wordt dus doorgelaten. Wil je NULL verbieden, gebruik dan NOT NULL."
    },
    {
      q: "Welke business rule kun je met een CHECK constraint afdwingen?",
      options: [
        "Het geboortejaar van een lid ligt tussen 1900 en 2100.",
        "Een e-mailadres komt maar één keer voor in de tabel.",
        "De klant van een order bestaat in de tabel Customers.",
        "Het totaal van alle orderregels is niet hoger dan de kredietlimiet van de klant."
      ],
      answer: 0,
      explain: "Alleen A gaat over één rij. B is UNIQUE, C is een FOREIGN KEY en D gaat over meerdere rijen/tabellen (trigger)."
    },
    {
      q: "Waarom is \"De houdbaarheidsdatum ligt in de toekomst\" een slechte business rule voor een constraint?",
      options: [
        "Omdat datums niet in een CHECK mogen.",
        "Omdat de regel niet continu waar is: na verloop van tijd wordt hij vanzelf onwaar.",
        "Omdat hij uit twee regels bestaat.",
        "Omdat GETDATE() langzaam is."
      ],
      answer: 1,
      explain: "Een business rule moet altijd waar zijn. Deze regel klopt bij het invoeren, maar na een tijdje niet meer, zonder dat er iets aan de data is veranderd."
    },
    {
      q: "Je wilt vastleggen dat bij een bezorging óf een afhaalpunt óf een volledig adres (straat én plaats) is ingevuld. Hoeveel constraints heb je minimaal nodig?",
      options: [
        "Drie: één per kolom.",
        "Twee die naar elkaar verwijzen.",
        "Eén CHECK met een combinatie van AND en OR.",
        "Geen enkele, dit kan alleen in de applicatie."
      ],
      answer: 2,
      explain: "CHECK ((Street IS NOT NULL AND City IS NOT NULL) OR PickupPointID IS NOT NULL). Eén CHECK mag meerdere kolommen combineren, en constraints kunnen niet naar elkaar verwijzen."
    }
  ]
});
