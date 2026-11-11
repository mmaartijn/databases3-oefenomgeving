DB3.registerTopic({
  id: "spatial",
  intro: "SQL Server heeft ingebouwde datatypes voor punten, lijnen en vlakken. Daarmee kun je vragen stellen als: in welke staat ligt dit GPS-punt, hoe ver liggen deze steden uit elkaar, en welke steden vallen buiten de grens van hun provincie?",
  sections: [
    {
      title: "Geometry vs. geography",
      body: `<p>SQL Server kent twee <strong>spatial types</strong>:</p>
<table>
<thead><tr><th></th><th><code>geometry</code></th><th><code>geography</code></th></tr></thead>
<tbody>
<tr><td>Coördinatenstelsel</td><td>Plat X-Y-vlak</td><td>Op een <strong>bol</strong> (round earth): latitude/longitude</td></tr>
<tr><td>Afstanden</td><td><strong>Euclidisch</strong> (rechte lijn, Pythagoras)</td><td>Over het aardoppervlak (meestal in meters)</td></tr>
<tr><td>Goed voor</td><td>Tekeningen, plattegronden, games, architectuur</td><td>Echte locaties op aarde</td></tr>
</tbody>
</table>
<p>Het verschil zit dus in het coördinatensysteem: vlak versus bol. Het is géén verschil tussen 2D en 3D, tussen kilometers en centimeters of tussen metrisch en imperiaal.</p>
<p>Beide types kunnen dezelfde vormen opslaan: <strong>punten</strong> (POINT), <strong>lijnen</strong> (LINESTRING) en <strong>polygonen</strong> (POLYGON), plus verzamelingen daarvan.</p>
<pre><code class="sql">DECLARE @punt   geometry = geometry::STGeomFromText('POINT(3 4)', 0);
DECLARE @lijn   geometry = geometry::STGeomFromText('LINESTRING(0 0, 10 10)', 0);
DECLARE @vlak   geometry = geometry::STGeomFromText('POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))', 0);

DECLARE @utrecht geography = geography::Point(52.0907, 5.1214, 4326);  -- lat, long, SRID</code></pre>`
    },
    {
      title: "Waarom geen twee float-kolommen?",
      body: `<p>Je kunt een locatie ook opslaan als <code>Latitude FLOAT</code> + <code>Longitude FLOAT</code>, of als tekst. Maar dan mis je alles wat een spatial type biedt:</p>
<ul>
<li>Een spatial kolom is <strong>indexeerbaar</strong> met een spatial index, dus vragen als "welke punten liggen in dit gebied" zijn snel.</li>
<li>SQL Server kan er <strong>berekeningen</strong> op doen: afstand, snijpunt, ligt-binnen, overlap.</li>
</ul>
<p>Wil je later locatiegedreven informatie uit een kolom halen? Definieer hem dan als <strong>spatial type</strong> (<code>GEOMETRY</code>, of <code>GEOGRAPHY</code> voor GPS), niet als FLOAT, BINARY of VARCHAR.</p>
<p>In WideWorldImporters vind je onder andere <code>Application.Cities.Location</code> (punt), <code>Application.StateProvinces.Border</code> en <code>Application.Countries.Border</code> (polygonen).</p>`
    },
    {
      title: "Opslag: binair en WKT",
      body: `<p>Spatial waarden worden <strong>geëncodeerd (binair) opgeslagen</strong>. Dat is geen privacymaatregel en ook niet in de eerste plaats om ruimte te sparen; het is zo gedaan zodat de waarden <strong>goed te indexeren en snel op te zoeken</strong> zijn.</p>
<p>Wil je de waarde leesbaar zien, dan gebruik je <code>STAsText()</code>. Dat geeft de <strong>Well-Known Text (WKT)</strong>-weergave volgens het Open Geospatial Consortium:</p>
<pre><code class="sql">SELECT CityName,
       Location,               -- 0xE6100000010C... (binair)
       Location.STAsText()     -- POINT (-86.5861 34.7304)
FROM   Application.Cities
WHERE  CityName = 'Huntsville';

-- Of als berekende kolom
CREATE TABLE dbo.Plek (
    Id       INT IDENTITY PRIMARY KEY,
    Locatie  geography,
    LocTekst AS Locatie.STAsText()
);</code></pre>
<div class="callout warn"><strong>Let op</strong> In WKT staat <strong>longitude eerst</strong> (<code>POINT(lon lat)</code>), terwijl <code>geography::Point()</code> <strong>latitude eerst</strong> verwacht. Een klassieke bron van punten die in de oceaan belanden.</div>`
    },
    {
      title: "X, Y, Z en M",
      body: `<p>Een punt kan tot vier waarden hebben:</p>
<pre><code class="sql">DECLARE @g geometry = geometry::Parse('POINT(4 5 6 3.5)');
SELECT @g.STX AS X,   -- 4
       @g.STY AS Y,   -- 5
       @g.Z   AS Z,   -- 6   hoogte (elevation)
       @g.M   AS M;   -- 3.5 measure</code></pre>
<table>
<thead><tr><th>Waarde</th><th>Betekenis</th></tr></thead>
<tbody>
<tr><td>X / Y</td><td>Positie (bij geography: <code>Long</code> en <code>Lat</code>)</td></tr>
<tr><td>Z</td><td>Hoogte (elevation)</td></tr>
<tr><td><strong>M</strong></td><td><strong>Measure</strong>: een waarde die SQL Server zelf niet interpreteert. De gebruiker of applicatie bepaalt wat hij betekent, bijv. afgelegde kilometers langs een route of een tijdstip</td></tr>
</tbody>
</table>`
    },
    {
      title: "Methodes: afstand, snijpunt, ligt-binnen",
      body: `<table>
<thead><tr><th>Methode</th><th>Wat</th></tr></thead>
<tbody>
<tr><td><code>a.STDistance(b)</code></td><td>Afstand tussen twee objecten</td></tr>
<tr><td><code>a.STIntersection(b)</code></td><td>Het <strong>snijpunt/overlap</strong> van twee objecten (geeft een nieuw object)</td></tr>
<tr><td><code>a.STIntersects(b)</code></td><td>1 als ze elkaar raken of overlappen</td></tr>
<tr><td><code>a.STContains(b)</code></td><td>1 als b helemaal binnen a ligt</td></tr>
<tr><td><code>a.STWithin(b)</code></td><td>1 als a helemaal binnen b ligt</td></tr>
<tr><td><code>a.STDifference(b)</code></td><td>Het deel van a dat niet in b ligt</td></tr>
<tr><td><code>.Lat</code>, <code>.Long</code></td><td>Properties van een geography-punt</td></tr>
</tbody>
</table>
<p>Zoals elke functie kun je deze methodes gebruiken in de <strong>SELECT</strong>, de <strong>WHERE</strong> én in de <strong>ON van een JOIN</strong>:</p>
<pre><code class="sql">-- In welke staat ligt dit GPS-punt?
DECLARE @p geography = geography::Point(40.7128, -74.0060, 4326);
SELECT StateProvinceName
FROM   Application.StateProvinces
WHERE  Border.STContains(@p) = 1;

-- Steden die buiten de grens van hun eigen staat vallen
SELECT sp.StateProvinceName, COUNT(*) AS BuitenGrens
FROM   Application.Cities c
JOIN   Application.StateProvinces sp
       ON  sp.StateProvinceID = c.StateProvinceID
       AND sp.Border.STContains(c.Location) = 0
GROUP BY sp.StateProvinceName
ORDER BY BuitenGrens DESC;</code></pre>
<p>Ligt het Vaticaan in Italië? Haal beide vormen op en roep <code>Italie.STContains(Vaticaan)</code> aan.</p>
<div class="callout tip"><strong>Niet verwarren</strong> <code>NEAR</code> hoort bij Full Text Search (woorden dicht bij elkaar), niet bij spatial queries. Voor "in de buurt" gebruik je <code>STDistance</code>.</div>`
    }
  ],
  keyPoints: [
    "<strong>geometry</strong> = plat vlak, Euclidische afstanden; <strong>geography</strong> = coördinaten op een bol (lat/long).",
    "Beide slaan punten, lijnen en polygonen op.",
    "Een spatial type is indexeerbaar en SQL Server kan ermee rekenen; twee float-kolommen niet.",
    "Locatiegedreven kolom? Definieer hem als GEOMETRY/GEOGRAPHY, niet als FLOAT of VARCHAR.",
    "Spatial data wordt geëncodeerd opgeslagen zodat het goed indexeerbaar en snel doorzoekbaar is.",
    "<code>STAsText()</code> geeft de tekstuele (WKT) weergave.",
    "In een punt staat <strong>M</strong> voor <strong>measure</strong>: een waarde die de applicatie zelf interpreteert.",
    "<code>STContains</code>: ligt het ene object binnen het andere? <code>STIntersection</code>: het snijpunt van twee objecten.",
    "Spatial methodes kun je in SELECT, WHERE én JOIN-condities gebruiken."
  ],
  pitfalls: [
    { wrong: "Geography is 3D en geometry is 2D.", right: "Het verschil is het coördinatensysteem: geography rekent op een bol, geometry in een plat vlak." },
    { wrong: "Locaties sla je het handigst op als twee FLOAT-kolommen.", right: "Een spatial type is indexeerbaar en biedt ingebouwde berekeningen zoals STDistance en STContains." },
    { wrong: "Spatial data wordt binair opgeslagen zodat de DBA de locaties niet kan zien.", right: "De encodering is er voor indexering en snel opzoeken. Met STAsText() is alles gewoon leesbaar." },
    { wrong: "De M in een punt staat voor meters.", right: "M = measure: een vrije waarde die de applicatie zelf betekenis geeft." },
    { wrong: "Spatial methodes mag je niet in een JOIN gebruiken.", right: "Dat mag gewoon, bijv. <code>JOIN ... ON sp.Border.STContains(c.Location) = 1</code>." },
    { wrong: "Met NEAR zoek je punten in de buurt van een coördinaat.", right: "NEAR is Full Text Search. Voor afstand gebruik je STDistance." }
  ],
  flashcards: [
    { front: "Je berekent de afstand Amsterdam–New York. Kies je geometry of geography, en waarom?", back: "Geography: die rekent op de bolle aarde. Geometry rekent in een plat vlak en klopt over zulke afstanden niet." },
    { front: "Noem per object het vormtype: een winkel, een bezorgroute, een postcodegebied.", back: "Point, LineString, Polygon. Alle drie (en verzamelingen ervan) passen in geometry/geography." },
    { front: "Waarvoor staat de M in POINT(X Y Z M)?", back: "Measure: een waarde die de applicatie zelf interpreteert." },
    { front: "<code>SELECT Location FROM Application.Cities</code> geeft onleesbare hex. Hoe krijg je 'POINT (...)' te zien?", back: "<code>SELECT Location.STAsText()</code>: dat geeft de WKT-tekst." },
    { front: "Waarom bewaart SQL Server een geography niet gewoon als de tekst 'POINT(4.9 52.4)'?", back: "In binaire vorm kan hij er een spatial index op bouwen en snel zoeken. Tekst is daar ongeschikt voor." },
    { front: "Waarom spatial type i.p.v. lat/long-kolommen?", back: "Indexeerbaar en SQL Server kan er berekeningen mee doen." },
    { front: "Hoe controleer je of punt P in gebied G ligt?", back: "<code>G.STContains(P) = 1</code> (of <code>P.STWithin(G)</code>)." },
    { front: "Waarvoor gebruik je <code>STIntersection</code>?", back: "Om het snijpunt/de overlap van twee objecten te krijgen." },
    { front: "Kan een spatial methode in een JOIN-conditie?", back: "Ja, net als in SELECT en WHERE." },
    { front: "Volgorde in <code>geography::Point()</code> vs. WKT", back: "Point(lat, long, srid) vs. 'POINT(long lat)'." },
    { front: "Welke methode geeft de afstand tussen twee objecten?", back: "<code>STDistance</code>" }
  ],
  quiz: [
    {
      q: "Je bouwt een bezorg-app die de afstand tussen klanten in heel Europa berekent. Welk type kies je?",
      options: [
        "Geometry, want dat ondersteunt polygonen",
        "Geography, want het rekent met lengte- en breedtegraden op de bolle aarde",
        "Geometry, want dat geeft afstanden in meters",
        "Maakt niet uit, de afstanden zijn gelijk"
      ],
      answer: 1,
      explain: "Geography werkt met coördinaten op een bol, dus afstanden over grote gebieden kloppen. Geometry rekent in een plat vlak (Euclidisch) en is bedoeld voor plattegronden of lokale coördinaten."
    },
    {
      q: "Welke van deze waarden past NIET in een geometry-kolom?",
      options: [
        "<code>POINT (3 4)</code>",
        "<code>LINESTRING (0 0, 5 5)</code>",
        "<code>POLYGON ((0 0, 4 0, 4 4, 0 0))</code>",
        "Een JSON-document met een adres"
      ],
      answer: 3,
      explain: "Geometry bewaart vormen: punten, lijnen, polygonen en verzamelingen daarvan. Een adres als JSON is tekst en hoort in een gewone kolom."
    },
    {
      q: "Een punt wordt gedefinieerd als <code>POINT(12 7 3 450)</code>. Wat stelt de vierde waarde (M) voor?",
      options: [
        "De magnitude: hoe groot het punt getekend wordt",
        "De eenheid: meters",
        "De afstand tot het middelpunt",
        "Een measure: een waarde waar de applicatie zelf betekenis aan geeft"
      ],
      answer: 3,
      explain: "M staat voor measure. SQL Server rekent er niet mee; jij bepaalt of het kilometers langs een route, een tijdstip of iets anders is."
    },
    {
      q: "Je selecteert <code>Location</code> uit Application.Cities en krijgt <code>0xE6100000...</code>. Hoe maak je er leesbare tekst van?",
      options: [
        "<code>CAST(Location AS VARCHAR(MAX))</code>",
        "<code>JSON_VALUE(Location, '$')</code>",
        "<code>Location.STAsText()</code>",
        "Dat kan niet; spatial data is versleuteld"
      ],
      answer: 2,
      explain: "STAsText() geeft de Well-Known Text, bijvoorbeeld POINT (-86.58 34.73)."
    },
    {
      q: "Waarom worden geometry/geography-waarden binair geëncodeerd opgeslagen?",
      options: [
        "Zodat ze goed te indexeren zijn en snel doorzocht kunnen worden",
        "Om de locaties af te schermen voor de databasebeheerder",
        "Omdat de resultatenweergave anders geen kaart kan tekenen",
        "Omdat tekst in SQL Server niet langer dan 8000 tekens mag zijn"
      ],
      answer: 0,
      explain: "De encodering maakt spatial indexes en snelle berekeningen mogelijk. Het is geen beveiliging."
    },
    {
      q: "Een collega slaat vestigingen op met twee kolommen <code>Lat FLOAT</code> en <code>Lon FLOAT</code>. Wat is het belangrijkste argument om een spatial type te gebruiken?",
      options: [
        "Float-kolommen zijn niet nauwkeurig genoeg voor GPS",
        "Spatial types zijn indexeerbaar en SQL Server kan er afstanden en overlap mee berekenen",
        "Het Entity Framework kan geen floats mappen",
        "Twee kolommen nemen meer ruimte in dan één"
      ],
      answer: 1,
      explain: "Met een spatial type krijg je spatial indexes en methodes als STDistance en STContains erbij."
    },
    {
      q: "Je hebt de grens van een land en een stad als geography. Hoe controleer je of de stad binnen het land ligt?",
      options: [
        "Door de latitudes en longitudes te joinen",
        "Door in de index van de locatiekolom te zoeken",
        "Dat kan niet standaard in SQL Server",
        "<code>Land.STContains(Stad) = 1</code>"
      ],
      answer: 3,
      explain: "STContains geeft 1 als het tweede object helemaal binnen het eerste ligt."
    },
    {
      q: "Je hebt de polygoon van een bezorgzone en die van een gemeente. Hoe krijg je het stuk dat in beide ligt?",
      options: [
        "<code>zone.STDistance(gemeente)</code>",
        "<code>zone.STIntersection(gemeente)</code>",
        "<code>zone.STAsText()</code>",
        "<code>zone.STContains(gemeente)</code>"
      ],
      answer: 1,
      explain: "STIntersection geeft de overlap als nieuwe vorm. STContains en STIntersects geven alleen ja of nee, en STDistance geeft een afstand."
    },
    {
      q: "Mag je een spatial methode zoals <code>STContains</code> of <code>STIntersects</code> in de ON-clausule van een JOIN gebruiken?",
      options: [
        "Ja, dat mag",
        "Nee, alleen in SELECT en WHERE",
        "Nee, spatial objecten zijn niet vergelijkbaar",
        "Nee, SQL Server verbiedt het omdat het te zwaar is"
      ],
      answer: 0,
      explain: "Het zijn gewone expressies; ze mogen overal waar een conditie mag. Het kan wel zwaar zijn op grote tabellen, maar het is toegestaan."
    },
    {
      q: "Je bouwt een tabel met afleveradressen en wilt later kunnen vragen welke adressen binnen 5 km van een depot liggen. Hoe definieer je de locatiekolom?",
      options: ["Als <code>VARCHAR(100)</code>", "Als <code>BINARY(16)</code>", "Als spatial type (geography/geometry)", "Als twee <code>FLOAT</code>-kolommen"],
      answer: 2,
      explain: "Alleen met een spatial type kun je STDistance gebruiken en een spatial index leggen."
    },
    {
      q: "Welke methode gebruik je om te berekenen hoe ver twee steden uit elkaar liggen?",
      options: ["<code>STIntersection</code>", "<code>NEAR</code>", "<code>STAsText</code>", "<code>STDistance</code>"],
      answer: 3,
      explain: "STDistance geeft de afstand. NEAR is een Full Text Search-operator voor woorden die dicht bij elkaar staan."
    },
    {
      q: "Je schrijft <code>geography::Point(4.89, 52.37, 4326)</code> voor Amsterdam (lat 52.37, long 4.89). Het punt komt ergens anders terecht. Waarom?",
      options: [
        "De SRID 4326 hoort bij geometry",
        "geography::Point verwacht eerst de latitude en dan de longitude",
        "Coördinaten moeten in radialen",
        "Een geography-punt heeft altijd een Z-waarde nodig"
      ],
      answer: 1,
      explain: "Point(lat, long, srid): de argumenten zijn omgedraaid. In WKT is het juist POINT(long lat)."
    }
  ]
});
