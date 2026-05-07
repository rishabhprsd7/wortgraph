// Seed script: populates Neo4j with realistic German vocabulary data
// Run with: node seed.js
// Requires the server to be running on localhost:3001

const API = 'http://localhost:3001';

const batches = [
  {
    source: 'Article',
    snippet: 'Die Bundesregierung hat einen neuen Gesetzentwurf zur Klimapolitik vorgestellt...',
    words: [
      { article: 'die', word: 'Bundesregierung', cefr: 'B2', translation: 'federal government', example: 'Die Bundesregierung beschloss neue Maßnahmen, um die Inflation zu bekämpfen.', exampleTranslation: 'The federal government decided on new measures to combat inflation.' },
      { article: 'die', word: 'Gesetzgebung', cefr: 'C1', translation: 'legislation', example: 'Die neue Gesetzgebung schützt Verbraucher vor überhöhten Preisen im Energiesektor.', exampleTranslation: 'The new legislation protects consumers from excessive prices in the energy sector.' },
      { article: 'die', word: 'Abstimmung', cefr: 'B2', translation: 'vote, ballot', example: 'Bei der Abstimmung im Parlament stimmten nur wenige Abgeordnete gegen den Vorschlag.', exampleTranslation: 'In the parliamentary vote, only a few MPs voted against the proposal.' },
      { article: 'die', word: 'Koalition', cefr: 'B2', translation: 'coalition', example: 'Die Koalition aus drei Parteien einigt sich selten schnell auf gemeinsame Entscheidungen.', exampleTranslation: 'The coalition of three parties rarely agrees quickly on joint decisions.' },
      { article: 'die', word: 'Verfassung', cefr: 'B2', translation: 'constitution', example: 'Das Grundgesetz ist die Verfassung Deutschlands und schützt die Rechte aller Bürger.', exampleTranslation: 'The Basic Law is Germany\'s constitution and protects the rights of all citizens.' },
      { article: 'der', word: 'Beschluss', cefr: 'B2', translation: 'resolution, decision', example: 'Der Beschluss des Stadtrats tritt erst nächsten Monat offiziell in Kraft.', exampleTranslation: 'The city council\'s resolution does not officially come into effect until next month.' },
      { article: 'die', word: 'Vermittlung', cefr: 'B2', translation: 'mediation, placement', example: 'Die Vermittlung zwischen den Tarifparteien dauerte drei Wochen, bis eine Einigung erzielt wurde.', exampleTranslation: 'Mediation between the negotiating parties lasted three weeks until an agreement was reached.' },
      { article: 'die', word: 'Verordnung', cefr: 'C1', translation: 'regulation, ordinance', example: 'Die neue Verordnung schreibt vor, dass alle Unternehmen ihren CO₂-Ausstoß melden müssen.', exampleTranslation: 'The new regulation requires all companies to report their CO₂ emissions.' },
    ],
  },
  {
    source: 'Podcast',
    snippet: 'Heute sprechen wir über Klimawandel und Nachhaltigkeit in der modernen Gesellschaft...',
    words: [
      { article: 'der', word: 'Klimawandel', cefr: 'B1', translation: 'climate change', example: 'Der Klimawandel verursacht häufigere Überschwemmungen und extremere Sommer in Europa.', exampleTranslation: 'Climate change is causing more frequent floods and more extreme summers in Europe.' },
      { article: 'die', word: 'Nachhaltigkeit', cefr: 'B2', translation: 'sustainability', example: 'Viele Firmen berichten über ihre Nachhaltigkeit, aber nur wenige ändern ihr Verhalten wirklich.', exampleTranslation: 'Many companies report on their sustainability, but only a few truly change their behavior.' },
      { article: 'die', word: 'Erderwärmung', cefr: 'B2', translation: 'global warming', example: 'Ohne entschlossenes Handeln könnte die Erderwärmung bis 2100 über zwei Grad Celsius betragen.', exampleTranslation: 'Without decisive action, global warming could exceed two degrees Celsius by 2100.' },
      { article: 'die', word: 'Energiewende', cefr: 'B2', translation: 'energy transition', example: 'Die Energiewende erfordert massive Investitionen in Solar- und Windkraftanlagen.', exampleTranslation: 'The energy transition requires massive investment in solar and wind energy plants.' },
      { article: 'der', word: 'Artenschutz', cefr: 'C1', translation: 'species protection', example: 'Der Artenschutz verhindert, dass seltene Tiere durch menschliche Aktivitäten aussterben.', exampleTranslation: 'Species protection prevents rare animals from becoming extinct due to human activities.' },
      { article: 'die', word: 'Überflutung', cefr: 'B2', translation: 'flooding, inundation', example: 'Die Überflutung des Flussufers zerstörte viele Häuser im tiefer gelegenen Stadtteil.', exampleTranslation: 'The flooding of the riverbank destroyed many houses in the lower-lying district.' },
      { article: 'die', word: 'Emissionen', cefr: 'B2', translation: 'emissions', example: 'Der Verkehr ist für einen großen Teil der CO₂-Emissionen in Innenstädten verantwortlich.', exampleTranslation: 'Traffic is responsible for a large share of CO₂ emissions in city centres.' },
      { article: 'die', word: 'Abholzung', cefr: 'C1', translation: 'deforestation', example: 'Die Abholzung des Regenwaldes beschleunigt den Klimawandel und zerstört Lebensräume.', exampleTranslation: 'Deforestation of the rainforest accelerates climate change and destroys habitats.' },
    ],
  },
  {
    source: 'Article',
    snippet: 'Der deutsche Arbeitsmarkt zeigt sich trotz wirtschaftlicher Unsicherheiten stabil...',
    words: [
      { article: 'das', word: 'Wirtschaftswachstum', cefr: 'B2', translation: 'economic growth', example: 'Das Wirtschaftswachstum verlangsamte sich, weil viele Unternehmen weniger investierten.', exampleTranslation: 'Economic growth slowed down because many companies invested less.' },
      { article: 'die', word: 'Verschuldung', cefr: 'B2', translation: 'debt, indebtedness', example: 'Die hohe Verschuldung der Kommunen macht es schwer, neue Schulen zu bauen.', exampleTranslation: 'The high debt of municipalities makes it difficult to build new schools.' },
      { article: 'die', word: 'Beschäftigung', cefr: 'B2', translation: 'employment', example: 'Die Beschäftigung im Dienstleistungssektor ist in den letzten Jahren stark gestiegen.', exampleTranslation: 'Employment in the service sector has risen sharply in recent years.' },
      { article: 'der', word: 'Wettbewerb', cefr: 'B2', translation: 'competition', example: 'Der starke Wettbewerb auf dem Markt zwingt Unternehmen, ihre Preise niedrig zu halten.', exampleTranslation: 'Intense market competition forces companies to keep their prices low.' },
      { article: 'die', word: 'Finanzierung', cefr: 'B2', translation: 'financing, funding', example: 'Die Finanzierung des neuen Bahnprojekts kommt zu einem Drittel vom Bund.', exampleTranslation: 'One third of the funding for the new rail project comes from the federal government.' },
      { article: 'die', word: 'Besteuerung', cefr: 'C1', translation: 'taxation', example: 'Die Besteuerung hoher Einkommen soll die Schere zwischen Arm und Reich verkleinern.', exampleTranslation: 'Taxing high incomes should help narrow the gap between rich and poor.' },
      { article: 'die', word: 'Entwicklung', cefr: 'B1', translation: 'development', example: 'Die wirtschaftliche Entwicklung der Region hängt stark von neuen Unternehmen ab.', exampleTranslation: 'The economic development of the region depends heavily on new businesses.' },
      { article: 'die', word: 'Verhandlung', cefr: 'B2', translation: 'negotiation, trial', example: 'Die Verhandlung zwischen den Gewerkschaften und Arbeitgebern zog sich über Wochen hin.', exampleTranslation: 'Negotiations between the unions and employers dragged on for weeks.' },
    ],
  },
  {
    source: 'YouTube',
    snippet: 'In diesem Video erkläre ich, wie gesellschaftlicher Zusammenhalt entsteht...',
    words: [
      { article: 'die', word: 'Gemeinschaft', cefr: 'B1', translation: 'community', example: 'In einer guten Gemeinschaft unterstützen sich die Nachbarn gegenseitig in schwierigen Zeiten.', exampleTranslation: 'In a good community, neighbours support each other in difficult times.' },
      { article: 'die', word: 'Gleichberechtigung', cefr: 'B2', translation: 'equal rights', example: 'Die Gleichberechtigung von Frauen und Männern ist im Grundgesetz verankert, aber nicht überall gelebt.', exampleTranslation: 'Equal rights for women and men are enshrined in the Basic Law, but not practised everywhere.' },
      { article: 'die', word: 'Bevölkerung', cefr: 'B1', translation: 'population', example: 'Die Bevölkerung in ländlichen Regionen nimmt ab, weil viele junge Menschen in Städte ziehen.', exampleTranslation: 'The population in rural regions is declining because many young people are moving to cities.' },
      { article: 'der', word: 'Zusammenhalt', cefr: 'B2', translation: 'cohesion, solidarity', example: 'Der gesellschaftliche Zusammenhalt leidet, wenn Menschen sich gegenseitig nicht mehr vertrauen.', exampleTranslation: 'Social cohesion suffers when people no longer trust each other.' },
      { article: 'die', word: 'Benachteiligung', cefr: 'C1', translation: 'disadvantage, discrimination', example: 'Die Benachteiligung von Kindern aus armen Familien beginnt oft schon in der Grundschule.', exampleTranslation: 'The disadvantage of children from poor families often begins as early as primary school.' },
      { article: 'die', word: 'Vielfalt', cefr: 'B2', translation: 'diversity, variety', example: 'Die kulturelle Vielfalt in der Stadt macht sie lebendig und zieht viele Touristen an.', exampleTranslation: 'The cultural diversity of the city makes it vibrant and attracts many tourists.' },
      { article: 'die', word: 'Verständigung', cefr: 'B2', translation: 'communication, understanding', example: 'Ohne gegenseitige Verständigung ist es schwierig, Konflikte zwischen Gruppen zu lösen.', exampleTranslation: 'Without mutual understanding, it is difficult to resolve conflicts between groups.' },
      { article: 'die', word: 'Eingliederung', cefr: 'C1', translation: 'integration, inclusion', example: 'Die Eingliederung von Geflüchteten in den Arbeitsmarkt braucht Zeit und gezielte Unterstützung.', exampleTranslation: 'The integration of refugees into the labour market takes time and targeted support.' },
    ],
  },
];

// Review simulation: word → [correct, correct, wrong, ...] sequences
const reviewScripts = {
  // High retention (know well)
  Bundesregierung: [true, true, true, true],
  Klimawandel:     [true, true, true],
  Gemeinschaft:    [true, true, true, true],
  Bevölkerung:     [true, true, true],
  Wettbewerb:      [true, true, true],
  Entwicklung:     [true, true, true, true],
  Koalition:       [true, true, true],

  // Medium retention
  Nachhaltigkeit:  [true, false, true, true],
  Energiewende:    [false, true, true],
  Beschäftigung:   [true, false, true, true],
  Zusammenhalt:    [true, true, false, true],
  Verfassung:      [true, false, true],
  Vielfalt:        [true, true, false, true],
  Finanzierung:    [false, true, true],
  Verhandlung:     [true, true, false, true],

  // Low retention — stuck words (reviewed many times, still failing)
  Gesetzgebung:    [false, true, false, false, true, false],
  Verordnung:      [false, false, true, false, false],
  Abholzung:       [false, true, false, false, true, false],
  Benachteiligung: [false, false, false, true, false, false],
  Eingliederung:   [false, true, false, false, false],
  Besteuerung:     [false, false, true, false, false],

  // Not reviewed yet (new words)
  Erderwärmung:    [],
  Artenschutz:     [],
  Abstimmung:      [],
  Vermittlung:     [],
  Beschluss:       [],
  Überflutung:     [],
  Emissionen:      [],
  Verschuldung:    [],
  Wirtschaftswachstum: [],
  Gleichberechtigung:  [],
  Verständigung:   [],
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('Checking server…');
  const health = await fetch(`${API}/health`).then(r => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error('Server not reachable at', API, '— start it with: npm run dev (in server/)');
    process.exit(1);
  }
  console.log('Server OK\n');

  // 1. Save word batches
  for (const batch of batches) {
    const words = batch.words.map(w => ({ ...w, word: w.word }));
    const result = await post('/api/words', {
      words,
      source: batch.source,
      snippet: batch.snippet,
      userId: 'default',
    });
    console.log(`Saved ${result.saved} words from "${batch.source}" (${result.edges} edges)`);
  }

  console.log('\nSimulating reviews…');

  // 2. Simulate reviews
  for (const [word, sequence] of Object.entries(reviewScripts)) {
    if (sequence.length === 0) continue;
    for (const correct of sequence) {
      await post('/api/review', { userId: 'default', word, correct });
    }
    const finalCorrect = sequence.filter(Boolean).length;
    const pct = Math.round((finalCorrect / sequence.length) * 100);
    console.log(`  ${word}: ${sequence.length} reviews → ~${pct}% correct`);
  }

  console.log('\nDone! Your Neo4j graph now has:');
  console.log('  • 32 words across 4 topics (Article, Podcast, YouTube)');
  console.log('  • CO_OCCURS_WITH edges between words from the same source');
  console.log('  • Varied retention: high / medium / stuck / unreviewed');
  console.log('  • Word families: ver-, be-, ge-, -ung, -keit, -schaft visible');
  console.log('\nRefresh the Agent tab to see insights populate.');
}

main().catch(e => { console.error(e); process.exit(1); });
