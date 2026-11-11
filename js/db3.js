/* Centrale registry voor alle onderwerpen. Elk bestand in /data/topics roept DB3.registerTopic({...}) aan. */
(function (global) {
  const DB3 = global.DB3 || {};
  DB3.topics = DB3.topics || [];

  /* Volgorde + metadata volgens de toetsmatrijs. Elk onderwerp = 3 toetsvragen (≈ 6,7%). */
  DB3.clusters = [
    { id: "integriteit", title: "ACID-principes waarborgen", goal: "Bedrijfsregels op databaseniveau implementeren" },
    { id: "consistentie", title: "Data consistent houden over rijen heen", goal: "Bedrijfsregels op databaseniveau implementeren" },
    { id: "analyse", title: "Performance-bottlenecks vinden", goal: "Performance analyseren en verbeteren" },
    { id: "inrichting", title: "Data inrichten voor performance", goal: "Performance analyseren en verbeteren" },
    { id: "semi", title: "Semi-gestructureerde data", goal: "Geavanceerde querytechnieken" },
    { id: "spatial", title: "Locatiegerelateerde queries", goal: "Geavanceerde querytechnieken" },
    { id: "tekst", title: "Efficiënt tekst doorzoeken", goal: "Geavanceerde querytechnieken" },
  ];

  DB3.catalog = [
    { id: "acid", title: "ACID", week: 1, cluster: "integriteit", icon: "◆" },
    { id: "transactions", title: "Transactions", week: 1, cluster: "integriteit", icon: "⇄" },
    { id: "permissions", title: "Permissions", week: 1, cluster: "integriteit", icon: "⚿" },
    { id: "constraints", title: "Constraints", week: 2, cluster: "integriteit", icon: "▣" },
    { id: "views", title: "Views", week: 2, cluster: "consistentie", icon: "◫" },
    { id: "triggers", title: "Triggers", week: 2, cluster: "consistentie", icon: "ϟ" },
    { id: "functions", title: "Functions & RLS", week: 3, cluster: "consistentie", icon: "ƒ" },
    { id: "storedprocs", title: "Stored Procedures", week: 3, cluster: "consistentie", icon: "▶" },
    { id: "temporal", title: "Temporal Tables", week: 3, cluster: "consistentie", icon: "◷" },
    { id: "profiler", title: "Profiler", week: 4, cluster: "analyse", icon: "◉" },
    { id: "queryplans", title: "Query Execution Plans", week: 4, cluster: "analyse", icon: "⤳" },
    { id: "indexing", title: "Indexing", week: 4, cluster: "inrichting", icon: "≣" },
    { id: "json", title: "JSON / XML", week: 5, cluster: "semi", icon: "{ }" },
    { id: "spatial", title: "Spatial types (GPS)", week: 5, cluster: "spatial", icon: "⌖" },
    { id: "fulltext", title: "Full Text Search", week: 6, cluster: "tekst", icon: "❝" },
  ];

  DB3.registerTopic = function (topic) {
    if (!topic || !topic.id) throw new Error("Topic zonder id");
    const meta = DB3.catalog.find((c) => c.id === topic.id) || {};
    const merged = Object.assign({}, meta, topic);
    const i = DB3.topics.findIndex((t) => t.id === topic.id);
    if (i >= 0) DB3.topics[i] = merged; else DB3.topics.push(merged);
  };

  DB3.getTopic = (id) => DB3.topics.find((t) => t.id === id);
  DB3.ordered = () => DB3.catalog.map((c) => DB3.getTopic(c.id)).filter(Boolean);

  global.DB3 = DB3;
})(typeof window !== "undefined" ? window : globalThis);
