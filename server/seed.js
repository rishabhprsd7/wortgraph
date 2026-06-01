// Hackathon seed: 48 German words across 6 topics with realistic retention data
// Run locally:      node seed.js
// Run on production: API_URL=https://wortgraph.onrender.com SEED_USER=demo node seed.js

const API = process.env.API_URL || 'http://localhost:3001';
const SEED_USER = process.env.SEED_USER || 'default';

const batches = [
  {
    source: 'Politik',
    snippet: 'Die Bundesregierung hat einen neuen Gesetzentwurf zur Klimapolitik vorgestellt. Die Koalition debattiert über Verfassungsänderungen und Wahlrechtsreform.',
    words: [
      { article: 'die', word: 'Bundesregierung', cefr: 'B2', translation: 'federal government', example: 'Die Bundesregierung beschloss neue Maßnahmen gegen die Inflation.', exampleTranslation: 'The federal government decided on new measures against inflation.' },
      { article: 'die', word: 'Verfassung', cefr: 'B2', translation: 'constitution', example: 'Das Grundgesetz ist die Verfassung Deutschlands und schützt Bürgerrechte.', exampleTranslation: 'The Basic Law is Germany\'s constitution and protects civil rights.' },
      { article: 'die', word: 'Koalition', cefr: 'B2', translation: 'coalition', example: 'Die Koalition aus drei Parteien einigt sich selten schnell.', exampleTranslation: 'The coalition of three parties rarely agrees quickly.' },
      { article: 'die', word: 'Gesetzgebung', cefr: 'C1', translation: 'legislation', example: 'Die neue Gesetzgebung schützt Verbraucher vor überhöhten Preisen.', exampleTranslation: 'The new legislation protects consumers from excessive prices.' },
      { article: 'die', word: 'Verordnung', cefr: 'C1', translation: 'regulation, ordinance', example: 'Die neue Verordnung schreibt vor, dass alle Firmen CO₂-Ausstoß melden müssen.', exampleTranslation: 'The new regulation requires all companies to report CO₂ emissions.' },
      { article: 'die', word: 'Abstimmung', cefr: 'B2', translation: 'vote, ballot', example: 'Bei der Abstimmung stimmten nur wenige Abgeordnete gegen den Vorschlag.', exampleTranslation: 'In the vote, only a few MPs voted against the proposal.' },
      { article: 'die', word: 'Vermittlung', cefr: 'B2', translation: 'mediation, placement', example: 'Die Vermittlung zwischen den Tarifparteien dauerte drei Wochen.', exampleTranslation: 'Mediation between the negotiating parties lasted three weeks.' },
      { article: 'der', word: 'Beschluss', cefr: 'B2', translation: 'resolution, decision', example: 'Der Beschluss des Stadtrats tritt nächsten Monat offiziell in Kraft.', exampleTranslation: 'The city council resolution officially takes effect next month.' },
    ],
  },
  {
    source: 'Klima',
    snippet: 'Der Klimawandel gefährdet Ökosysteme weltweit. Experten fordern schnellere Energiewende und stärkeren Artenschutz.',
    words: [
      { article: 'der', word: 'Klimawandel', cefr: 'B1', translation: 'climate change', example: 'Der Klimawandel verursacht häufigere Überschwemmungen in Europa.', exampleTranslation: 'Climate change is causing more frequent floods in Europe.' },
      { article: 'die', word: 'Nachhaltigkeit', cefr: 'B2', translation: 'sustainability', example: 'Viele Firmen berichten über Nachhaltigkeit, aber wenige ändern ihr Verhalten.', exampleTranslation: 'Many companies report on sustainability, but few change their behaviour.' },
      { article: 'die', word: 'Energiewende', cefr: 'B2', translation: 'energy transition', example: 'Die Energiewende erfordert massive Investitionen in Solar- und Windkraft.', exampleTranslation: 'The energy transition requires massive investment in solar and wind energy.' },
      { article: 'die', word: 'Erderwärmung', cefr: 'B2', translation: 'global warming', example: 'Ohne Handeln könnte die Erderwärmung bis 2100 über zwei Grad betragen.', exampleTranslation: 'Without action, global warming could exceed two degrees by 2100.' },
      { article: 'die', word: 'Abholzung', cefr: 'C1', translation: 'deforestation', example: 'Die Abholzung des Regenwaldes beschleunigt den Klimawandel erheblich.', exampleTranslation: 'Deforestation of the rainforest significantly accelerates climate change.' },
      { article: 'die', word: 'Emissionen', cefr: 'B2', translation: 'emissions', example: 'Der Verkehr ist für einen großen Teil der CO₂-Emissionen verantwortlich.', exampleTranslation: 'Traffic is responsible for a large share of CO₂ emissions.' },
      { article: 'der', word: 'Artenschutz', cefr: 'C1', translation: 'species protection', example: 'Der Artenschutz verhindert, dass seltene Tiere durch menschliche Aktivität aussterben.', exampleTranslation: 'Species protection prevents rare animals from becoming extinct.' },
      { article: 'die', word: 'Überflutung', cefr: 'B2', translation: 'flooding, inundation', example: 'Die Überflutung des Flussufers zerstörte viele Häuser im Stadtteil.', exampleTranslation: 'The flooding of the riverbank destroyed many houses in the district.' },
    ],
  },
  {
    source: 'Wirtschaft',
    snippet: 'Der deutsche Arbeitsmarkt zeigt sich stabil. Experten diskutieren Wirtschaftswachstum, Besteuerung und die Finanzierung öffentlicher Projekte.',
    words: [
      { article: 'das', word: 'Wirtschaftswachstum', cefr: 'B2', translation: 'economic growth', example: 'Das Wirtschaftswachstum verlangsamte sich wegen geringerer Investitionen.', exampleTranslation: 'Economic growth slowed due to lower investment.' },
      { article: 'die', word: 'Beschäftigung', cefr: 'B2', translation: 'employment', example: 'Die Beschäftigung im Dienstleistungssektor ist stark gestiegen.', exampleTranslation: 'Employment in the service sector has risen sharply.' },
      { article: 'die', word: 'Verschuldung', cefr: 'B2', translation: 'debt, indebtedness', example: 'Die hohe Verschuldung der Kommunen macht Schulbauprojekte schwer.', exampleTranslation: 'The high debt of municipalities makes school building projects difficult.' },
      { article: 'die', word: 'Finanzierung', cefr: 'B2', translation: 'financing, funding', example: 'Die Finanzierung des Bahnprojekts kommt zu einem Drittel vom Bund.', exampleTranslation: 'One third of the rail project funding comes from the federal government.' },
      { article: 'die', word: 'Besteuerung', cefr: 'C1', translation: 'taxation', example: 'Die Besteuerung hoher Einkommen soll die Schere zwischen Arm und Reich verkleinern.', exampleTranslation: 'Taxing high incomes should narrow the gap between rich and poor.' },
      { article: 'der', word: 'Wettbewerb', cefr: 'B2', translation: 'competition', example: 'Der starke Wettbewerb zwingt Unternehmen, ihre Preise niedrig zu halten.', exampleTranslation: 'Intense competition forces companies to keep their prices low.' },
      { article: 'die', word: 'Verhandlung', cefr: 'B2', translation: 'negotiation, trial', example: 'Die Verhandlung zwischen Gewerkschaften und Arbeitgebern zog sich hin.', exampleTranslation: 'Negotiations between unions and employers dragged on.' },
      { article: 'die', word: 'Entwicklung', cefr: 'B1', translation: 'development', example: 'Die wirtschaftliche Entwicklung der Region hängt von neuen Unternehmen ab.', exampleTranslation: 'The economic development of the region depends on new businesses.' },
    ],
  },
  {
    source: 'Gesellschaft',
    snippet: 'Gesellschaftlicher Zusammenhalt erfordert Gleichberechtigung und gegenseitige Verständigung. Die Bevölkerung wird vielfältiger.',
    words: [
      { article: 'die', word: 'Gemeinschaft', cefr: 'B1', translation: 'community', example: 'In einer guten Gemeinschaft unterstützen sich Nachbarn gegenseitig.', exampleTranslation: 'In a good community, neighbours support each other.' },
      { article: 'der', word: 'Zusammenhalt', cefr: 'B2', translation: 'cohesion, solidarity', example: 'Der gesellschaftliche Zusammenhalt leidet, wenn Vertrauen fehlt.', exampleTranslation: 'Social cohesion suffers when trust is lacking.' },
      { article: 'die', word: 'Gleichberechtigung', cefr: 'B2', translation: 'equal rights', example: 'Die Gleichberechtigung von Frauen und Männern ist gesetzlich verankert.', exampleTranslation: 'Equal rights for women and men are enshrined in law.' },
      { article: 'die', word: 'Bevölkerung', cefr: 'B1', translation: 'population', example: 'Die Bevölkerung in ländlichen Regionen nimmt ab, da viele in Städte ziehen.', exampleTranslation: 'The population in rural regions is declining as many move to cities.' },
      { article: 'die', word: 'Vielfalt', cefr: 'B2', translation: 'diversity, variety', example: 'Die kulturelle Vielfalt der Stadt zieht viele Touristen an.', exampleTranslation: 'The cultural diversity of the city attracts many tourists.' },
      { article: 'die', word: 'Verständigung', cefr: 'B2', translation: 'communication, understanding', example: 'Ohne Verständigung ist es schwierig, Konflikte zu lösen.', exampleTranslation: 'Without mutual understanding, it is difficult to resolve conflicts.' },
      { article: 'die', word: 'Benachteiligung', cefr: 'C1', translation: 'disadvantage, discrimination', example: 'Die Benachteiligung von Kindern aus armen Familien beginnt in der Grundschule.', exampleTranslation: 'The disadvantage of children from poor families begins in primary school.' },
      { article: 'die', word: 'Eingliederung', cefr: 'C1', translation: 'integration, inclusion', example: 'Die Eingliederung von Geflüchteten in den Arbeitsmarkt braucht Unterstützung.', exampleTranslation: 'The integration of refugees into the labour market needs support.' },
    ],
  },
  {
    source: 'Technologie',
    snippet: 'Digitalisierung verändert Wirtschaft und Gesellschaft. Künstliche Intelligenz und Vernetzung schaffen neue Möglichkeiten und Risiken.',
    words: [
      { article: 'die', word: 'Digitalisierung', cefr: 'B2', translation: 'digitalisation', example: 'Die Digitalisierung der Verwaltung macht Behördengänge einfacher.', exampleTranslation: 'The digitalisation of administration makes dealings with authorities easier.' },
      { article: 'die', word: 'Vernetzung', cefr: 'B2', translation: 'networking, connectivity', example: 'Die globale Vernetzung ermöglicht Zusammenarbeit über Ländergrenzen hinweg.', exampleTranslation: 'Global connectivity enables collaboration across national borders.' },
      { article: 'die', word: 'Verschlüsselung', cefr: 'C1', translation: 'encryption', example: 'Eine starke Verschlüsselung schützt sensible Daten vor unbefugtem Zugriff.', exampleTranslation: 'Strong encryption protects sensitive data from unauthorised access.' },
      { article: 'die', word: 'Verbreitung', cefr: 'B2', translation: 'spread, distribution', example: 'Die Verbreitung von Falschinformationen im Internet ist schwer zu kontrollieren.', exampleTranslation: 'The spread of misinformation on the internet is hard to control.' },
      { article: 'die', word: 'Sicherheit', cefr: 'B1', translation: 'security, safety', example: 'Die Sicherheit im Internet hängt von starken Passwörtern ab.', exampleTranslation: 'Internet security depends on strong passwords.' },
      { article: 'die', word: 'Benutzeroberfläche', cefr: 'C1', translation: 'user interface', example: 'Eine gute Benutzeroberfläche macht Software für alle zugänglich.', exampleTranslation: 'A good user interface makes software accessible to everyone.' },
      { article: 'die', word: 'Vernunft', cefr: 'B2', translation: 'reason, rationality', example: 'Vernunft und Empathie sollten den Umgang mit KI-Systemen leiten.', exampleTranslation: 'Reason and empathy should guide how we deal with AI systems.' },
      { article: 'die', word: 'Forschung', cefr: 'B1', translation: 'research', example: 'Ohne kontinuierliche Forschung wäre der technologische Fortschritt undenkbar.', exampleTranslation: 'Without continuous research, technological progress would be unthinkable.' },
    ],
  },
  {
    source: 'Gesundheit',
    snippet: 'Das Gesundheitssystem steht vor großen Herausforderungen. Prävention, Behandlung und Betreuung älterer Menschen gewinnen an Bedeutung.',
    words: [
      { article: 'die', word: 'Behandlung', cefr: 'B1', translation: 'treatment', example: 'Die Behandlung seltener Krankheiten erfordert spezialisierte Ärzte.', exampleTranslation: 'The treatment of rare diseases requires specialised doctors.' },
      { article: 'die', word: 'Betreuung', cefr: 'B2', translation: 'care, supervision', example: 'Die Betreuung älterer Menschen zu Hause entlastet Krankenhäuser.', exampleTranslation: 'Home care for elderly people relieves pressure on hospitals.' },
      { article: 'die', word: 'Versorgung', cefr: 'B2', translation: 'supply, provision, care', example: 'Die medizinische Versorgung in ländlichen Gebieten ist oft lückenhaft.', exampleTranslation: 'Medical care in rural areas is often patchy.' },
      { article: 'die', word: 'Vorbeugung', cefr: 'B2', translation: 'prevention', example: 'Durch gezielte Vorbeugung lassen sich viele Erkrankungen vermeiden.', exampleTranslation: 'Many illnesses can be avoided through targeted prevention.' },
      { article: 'die', word: 'Belastung', cefr: 'B2', translation: 'burden, stress, load', example: 'Die psychische Belastung durch Stress am Arbeitsplatz steigt.', exampleTranslation: 'The psychological burden of workplace stress is increasing.' },
      { article: 'die', word: 'Erholung', cefr: 'B1', translation: 'recovery, recreation', example: 'Nach der Erkrankung braucht der Körper Zeit zur Erholung.', exampleTranslation: 'After illness, the body needs time to recover.' },
      { article: 'die', word: 'Verantwortung', cefr: 'B1', translation: 'responsibility', example: 'Jeder trägt Verantwortung für die eigene Gesundheit und die der anderen.', exampleTranslation: 'Everyone bears responsibility for their own health and that of others.' },
      { article: 'die', word: 'Entwicklung', cefr: 'B1', translation: 'development', example: 'Die gesundheitliche Entwicklung eines Kindes hängt von vielen Faktoren ab.', exampleTranslation: 'The health development of a child depends on many factors.' },
    ],
  },
  {
    // Argumentation vocabulary, chosen so the Graph-RAG pipeline surfaces clear
    // synonym (Entscheidung↔Beschluss), antonym (Vorteil↔Nachteil) and
    // form_of (entscheiden↔Entscheidung, beschließen↔Beschluss) relations.
    source: 'Debatte',
    snippet: 'In jeder Debatte werden Vorteile und Nachteile abgewogen. Am Ende führen Zustimmung oder Ablehnung zu einer Entscheidung.',
    words: [
      { article: 'die', word: 'Entscheidung', cefr: 'B1', translation: 'decision', example: 'Die Entscheidung des Gerichts überraschte viele Beobachter im Saal.', exampleTranslation: 'The court\'s decision surprised many observers in the room.' },
      { article: '', word: 'entscheiden', cefr: 'B1', translation: 'to decide', example: 'Der Ausschuss muss bis Freitag über den Antrag entscheiden.', exampleTranslation: 'The committee must decide on the application by Friday.' },
      { article: '', word: 'beschließen', cefr: 'B2', translation: 'to decide, to pass (a law)', example: 'Das Parlament wird das neue Gesetz nächste Woche beschließen.', exampleTranslation: 'Parliament will pass the new law next week.' },
      { article: 'der', word: 'Vorteil', cefr: 'B1', translation: 'advantage', example: 'Ein großer Vorteil der Fernarbeit ist die zeitliche Flexibilität.', exampleTranslation: 'A big advantage of remote work is flexible scheduling.' },
      { article: 'der', word: 'Nachteil', cefr: 'B1', translation: 'disadvantage', example: 'Der größte Nachteil des Plans sind die hohen Anfangskosten.', exampleTranslation: 'The biggest disadvantage of the plan is the high initial costs.' },
      { article: 'die', word: 'Zustimmung', cefr: 'B2', translation: 'approval, consent', example: 'Der Vorschlag fand bei der Mehrheit der Abgeordneten Zustimmung.', exampleTranslation: 'The proposal won the approval of the majority of MPs.' },
      { article: 'die', word: 'Ablehnung', cefr: 'B2', translation: 'rejection, refusal', example: 'Die Ablehnung des Antrags wurde mit Kostengründen begründet.', exampleTranslation: 'The rejection of the application was justified on cost grounds.' },
      { article: 'der', word: 'Anstieg', cefr: 'B2', translation: 'rise, increase', example: 'Der Anstieg der Mieten zwingt viele Familien zum Umzug.', exampleTranslation: 'The rise in rents forces many families to move.' },
      { article: 'der', word: 'Rückgang', cefr: 'B2', translation: 'decline, decrease', example: 'Der Rückgang der Geburtenrate stellt das Rentensystem vor Probleme.', exampleTranslation: 'The decline in the birth rate poses problems for the pension system.' },
    ],
  },
];

// Review sequences — designed to fill all 7 insight panels
const reviewScripts = {
  // HIGH RETENTION (≥70%): established words
  Bundesregierung:    [true, true, true, true, true],
  Klimawandel:        [true, true, true, true],
  Gemeinschaft:       [true, true, true, true, true],
  Bevölkerung:        [true, true, true, true],
  Wettbewerb:         [true, true, true, true],
  Entwicklung:        [true, true, true, true, true],
  Koalition:          [true, true, true, true],
  Sicherheit:         [true, true, true, true],
  Forschung:          [true, true, true, true],
  Verantwortung:      [true, true, true, true],
  Behandlung:         [true, true, true, true],
  Erholung:           [true, true, true],

  // MEDIUM RETENTION (45–69%): still learning
  Nachhaltigkeit:     [true, false, true, true],
  Energiewende:       [false, true, true, true],
  Beschäftigung:      [true, false, true, true],
  Zusammenhalt:       [true, true, false, true],
  Verfassung:         [true, false, true, true],
  Vielfalt:           [true, true, false, true],
  Finanzierung:       [false, true, true],
  Verhandlung:        [true, true, false, true],
  Digitalisierung:    [true, false, true, true],
  Vernetzung:         [false, true, true],
  Betreuung:          [true, false, true],
  Versorgung:         [true, true, false, true],
  Belastung:          [false, true, true],
  Abstimmung:         [true, false, true],
  Vermittlung:        [true, false, true, true],

  // STUCK (<45% after 3+ reviews): need active strategies
  Gesetzgebung:       [false, true, false, false, true, false],
  Verordnung:         [false, false, true, false, false],
  Abholzung:          [false, true, false, false, true, false],
  Benachteiligung:    [false, false, false, true, false, false],
  Eingliederung:      [false, true, false, false, false],
  Besteuerung:        [false, false, true, false, false],
  Verschlüsselung:    [false, true, false, false, true, false],
  Verbreitung:        [false, false, false, true, false],
  Benutzeroberfläche: [false, true, false, false, false],
  Gleichberechtigung: [false, false, true, false, false, true, false],

  // UNREVIEWED: new additions
  Erderwärmung:       [],
  Artenschutz:        [],
  Emissionen:         [],
  Überflutung:        [],
  Wirtschaftswachstum:[],
  Verschuldung:       [],
  Vorbeugung:         [],
  Vernunft:           [],
  Beschluss:          [],
  Verständigung:      [],

  // Debatte batch — mixed tiers
  Entscheidung:       [true, true, true],
  Vorteil:            [true, true, true, true],
  Nachteil:           [true, true, false, true],
  entscheiden:        [true, false, true],
  Anstieg:            [true, false, true],
  Ablehnung:          [false, true, false],
  beschließen:        [],
  Zustimmung:         [],
  Rückgang:           [],
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log('Checking server…');
  const health = await fetch(`${API}/health`).then(r => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error('Server not reachable at', API, '— start it first: node index.js');
    process.exit(1);
  }
  console.log('Server OK\n');

  // 1. Wipe existing data
  console.log('Clearing existing data…');
  const clearRes = await fetch(`${API}/api/admin/clear`, { method: 'DELETE' });
  if (!clearRes.ok) throw new Error(`Clear failed: ${await clearRes.text()}`);
  console.log('Database cleared\n');

  // 2. Save all batches
  console.log('Seeding words…');
  for (const batch of batches) {
    const result = await post('/api/words', {
      words: batch.words,
      source: batch.source,
      snippet: batch.snippet,
      userId: SEED_USER,
    });
    console.log(`  ✓ ${batch.source}: ${result.saved} words, ${result.edges} co-occurrence edges`);
  }

  // 3. Seed bridge-word candidates (in graph but not in user's deck)
  console.log('\nSeeding bridge word candidates…');
  const bridges = [
    // Politik bridges — connect to Bundesregierung, Koalition, Verfassung, Abstimmung
    { article: 'das', word: 'Wahlrecht', cefr: 'B2', translation: 'right to vote, electoral law', example: 'Das Wahlrecht ist ein unveräußerliches Grundrecht in jeder Demokratie.', exampleTranslation: 'The right to vote is an inalienable fundamental right in every democracy.', relatedTo: ['Bundesregierung', 'Koalition', 'Abstimmung'] },
    { article: 'die', word: 'Bürgerbeteiligung', cefr: 'C1', translation: 'civic participation', example: 'Bürgerbeteiligung stärkt das Vertrauen in demokratische Prozesse.', exampleTranslation: 'Civic participation strengthens trust in democratic processes.', relatedTo: ['Verfassung', 'Abstimmung', 'Beschluss'] },
    { article: 'die', word: 'Transparenz', cefr: 'B2', translation: 'transparency', example: 'Ohne Transparenz können Bürger politische Entscheidungen nicht nachvollziehen.', exampleTranslation: 'Without transparency, citizens cannot follow political decisions.', relatedTo: ['Gesetzgebung', 'Verordnung', 'Bundesregierung'] },

    // Klima bridges — connect to Klimawandel, Emissionen, Energiewende
    { article: 'das', word: 'Treibhausgas', cefr: 'B2', translation: 'greenhouse gas', example: 'Treibhausgase wie CO₂ sind Hauptursache der globalen Erwärmung.', exampleTranslation: 'Greenhouse gases like CO₂ are the main cause of global warming.', relatedTo: ['Klimawandel', 'Emissionen', 'Erderwärmung'] },
    { article: 'die', word: 'Dürre', cefr: 'B2', translation: 'drought', example: 'Anhaltende Dürre bedroht die Landwirtschaft in vielen Regionen.', exampleTranslation: 'Prolonged drought threatens agriculture in many regions.', relatedTo: ['Klimawandel', 'Erderwärmung', 'Überflutung'] },
    { article: 'die', word: 'Biodiversität', cefr: 'C1', translation: 'biodiversity', example: 'Biodiversität ist die Grundlage stabiler Ökosysteme weltweit.', exampleTranslation: 'Biodiversity is the foundation of stable ecosystems worldwide.', relatedTo: ['Artenschutz', 'Abholzung', 'Nachhaltigkeit'] },

    // Wirtschaft bridges — connect to Beschäftigung, Wettbewerb, Finanzierung
    { article: 'die', word: 'Inflation', cefr: 'B2', translation: 'inflation', example: 'Hohe Inflation mindert die Kaufkraft der Bevölkerung deutlich.', exampleTranslation: 'High inflation significantly reduces the purchasing power of the population.', relatedTo: ['Wirtschaftswachstum', 'Verschuldung', 'Besteuerung'] },
    { article: 'die', word: 'Arbeitslosigkeit', cefr: 'B2', translation: 'unemployment', example: 'Steigende Arbeitslosigkeit belastet die sozialen Sicherungssysteme.', exampleTranslation: 'Rising unemployment puts a strain on social security systems.', relatedTo: ['Beschäftigung', 'Entwicklung', 'Finanzierung'] },
    { article: 'der', word: 'Haushalt', cefr: 'B1', translation: 'budget, household', example: 'Der staatliche Haushalt muss Einnahmen und Ausgaben in Einklang bringen.', exampleTranslation: 'The state budget must balance revenue and expenditure.', relatedTo: ['Verschuldung', 'Finanzierung', 'Besteuerung'] },

    // Gesellschaft bridges — connect to Gemeinschaft, Vielfalt, Bevölkerung
    { article: 'die', word: 'Solidarität', cefr: 'B2', translation: 'solidarity', example: 'Solidarität bedeutet, füreinander einzustehen — auch in schwierigen Zeiten.', exampleTranslation: 'Solidarity means standing up for each other — even in difficult times.', relatedTo: ['Gemeinschaft', 'Zusammenhalt', 'Bevölkerung'] },
    { article: 'die', word: 'Inklusion', cefr: 'B2', translation: 'inclusion', example: 'Inklusion ermöglicht Menschen mit Behinderungen gleichberechtigte Teilhabe.', exampleTranslation: 'Inclusion enables people with disabilities to participate on equal terms.', relatedTo: ['Gleichberechtigung', 'Benachteiligung', 'Eingliederung'] },
    { article: 'die', word: 'Partizipation', cefr: 'C1', translation: 'participation', example: 'Politische Partizipation ist Voraussetzung einer lebendigen Demokratie.', exampleTranslation: 'Political participation is a prerequisite for a vibrant democracy.', relatedTo: ['Gemeinschaft', 'Vielfalt', 'Verständigung'] },

    // Technologie bridges — connect to Digitalisierung, Vernetzung, Sicherheit
    { article: 'der', word: 'Datenschutz', cefr: 'B2', translation: 'data protection', example: 'Datenschutz schützt persönliche Daten vor Missbrauch und unerlaubtem Zugriff.', exampleTranslation: 'Data protection safeguards personal data from misuse and unauthorised access.', relatedTo: ['Verschlüsselung', 'Sicherheit', 'Vernetzung'] },
    { article: 'die', word: 'Automatisierung', cefr: 'B2', translation: 'automation', example: 'Automatisierung in der Industrie verändert die Anforderungen an Arbeitnehmer.', exampleTranslation: 'Automation in industry is changing the demands placed on employees.', relatedTo: ['Digitalisierung', 'Entwicklung', 'Vernetzung'] },
    { article: 'der', word: 'Algorithmus', cefr: 'C1', translation: 'algorithm', example: 'Algorithmen bestimmen immer mehr, welche Inhalte wir im Netz sehen.', exampleTranslation: 'Algorithms increasingly determine what content we see online.', relatedTo: ['Digitalisierung', 'Verbreitung', 'Benutzeroberfläche'] },

    // Gesundheit bridges — connect to Behandlung, Vorbeugung, Forschung
    { article: 'die', word: 'Impfung', cefr: 'B1', translation: 'vaccination', example: 'Impfung ist eine der wirksamsten Maßnahmen zur Vorbeugung von Infektionskrankheiten.', exampleTranslation: 'Vaccination is one of the most effective measures for preventing infectious diseases.', relatedTo: ['Vorbeugung', 'Behandlung', 'Forschung'] },
    { article: 'das', word: 'Wohlbefinden', cefr: 'B2', translation: 'wellbeing', example: 'Körperliches und seelisches Wohlbefinden sind eng miteinander verbunden.', exampleTranslation: 'Physical and mental wellbeing are closely linked.', relatedTo: ['Erholung', 'Belastung', 'Betreuung'] },
    { article: 'die', word: 'Prävention', cefr: 'B2', translation: 'prevention', example: 'Prävention ist günstiger als Behandlung — und schützt mehr Menschen.', exampleTranslation: 'Prevention is cheaper than treatment — and protects more people.', relatedTo: ['Vorbeugung', 'Versorgung', 'Verantwortung'] },
  ];
  const bridgeResult = await post('/api/admin/seed-bridges', { bridges });
  console.log(`  ✓ ${bridgeResult.created} bridge word candidates added`);

  // 4. Simulate reviews
  console.log('\nSimulating reviews…');
  for (const [word, sequence] of Object.entries(reviewScripts)) {
    if (sequence.length === 0) continue;
    for (const correct of sequence) {
      await post('/api/review', { userId: SEED_USER, word, correct });
    }
    const pct = Math.round((sequence.filter(Boolean).length / sequence.length) * 100);
    const tag = pct >= 70 ? '✓' : pct >= 45 ? '~' : '✗';
    console.log(`  ${tag} ${word}: ${sequence.length} reviews → ${pct}%`);
  }

  // 5. Embed with Gemini
  console.log('\nEmbedding words with Gemini…');
  try {
    const embedRes = await fetch(`${API}/api/embed/words`, { method: 'POST' });
    if (embedRes.ok) {
      const { embedded, failed, total } = await embedRes.json();
      console.log(`  ✓ Embedded ${embedded}/${total} words${failed ? ` (${failed} failed)` : ''}`);
    } else {
      const { error } = await embedRes.json().catch(() => ({}));
      if (error?.includes('GEMINI_KEY')) {
        console.log('  Skipped — add GEMINI_KEY to server/.env to enable semantic search');
      } else {
        console.log('  Embedding skipped:', error || embedRes.status);
      }
    }
  } catch (e) {
    console.log('  Embedding skipped:', e.message);
  }

  // 6. Generate word relations via Graph-RAG (synonyms / antonyms / forms).
  // Runs the real pipeline per word: vector retrieval → Groq classification →
  // edge write-back. Needs embeddings (step 5) + GROQ_KEY on the server.
  console.log('\nGenerating word relations (Graph-RAG)…');
  const allLemmas = batches.flatMap(b => b.words.map(w => w.word));
  let relSyn = 0, relAnt = 0, relForm = 0, relSkipped = 0;
  for (const word of allLemmas) {
    try {
      const r = await post('/api/word/relations/refresh', { userId: SEED_USER, word, minConfidence: 0.7 });
      if (r.error) { relSkipped++; continue; }
      relSyn += r.synonyms?.length || 0;
      relAnt += r.antonyms?.length || 0;
      relForm += r.forms?.length || 0;
    } catch {
      relSkipped++;
    }
    await new Promise(r => setTimeout(r, 600)); // stay under Groq rate limit
  }
  if (relSkipped === allLemmas.length) {
    console.log('  Skipped — needs GEMINI_KEY + GROQ_KEY on the server');
  } else {
    console.log(`  ✓ Built ${relSyn} synonym · ${relAnt} antonym · ${relForm} form edges${relSkipped ? ` (${relSkipped} words skipped)` : ''}`);
  }

  // 7. Build Meaning hubs (Concepts) — cluster words by shared English meaning.
  console.log('\nBuilding meaning hubs (Concepts)…');
  try {
    const m = await post('/api/meanings/build', { userId: SEED_USER });
    if (m.error) console.log('  Skipped:', m.error);
    else console.log(`  ✓ Built ${m.meanings} concept hubs · ${m.edges} MEANS edges`);
  } catch (e) {
    console.log('  Meaning build skipped:', e.message);
  }

  console.log('\n✅ Done! Your Neo4j graph now has:');
  console.log('  • 57 words across 7 topics: Politik · Klima · Wirtschaft · Gesellschaft · Technologie · Gesundheit · Debatte');
  console.log('  • Retention tiers: ~15 high · ~19 medium · ~11 stuck · ~12 unreviewed');
  console.log('  • Word families visible: ver-, be-, ge-, -ung, -keit, -schaft');
  console.log('  • Dense CO_OCCURS_WITH edges between same-topic words');
  console.log('  • Vector embeddings (if GEMINI_KEY set) for semantic search');
  console.log('  • SYNONYM_OF / ANTONYM_OF / FORM_OF edges from the Graph-RAG pipeline');
  console.log('  • Meaning hubs: (:Meaning)<-[:MEANS]-(:Word) for the Concepts view');
  console.log('\nRefresh the Agent tab to see all insights populate.');
  console.log('Flip a flashcard in Learn to see related words (synonyms/antonyms/forms).');
  console.log('Open Concepts to explore English meanings → German words as a graph.');
}

main().catch(e => { console.error(e); process.exit(1); });
