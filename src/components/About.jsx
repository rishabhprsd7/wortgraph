export function About({ setRoute }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 0 60px' }}>

      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 10px', color: 'var(--ink)' }}>
          Why I built Wortgraph
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, margin: 0 }}>
          A personal story about language learning, frustration, and a better way.
        </p>
      </div>

      <Section>
        <p>
          I've been learning German for a while. Everyone gives the same advice: read German news,
          watch German YouTube, immerse yourself. And every time I try, the same thing happens.
          I open an article, hit a wall of unfamiliar words in the first paragraph, and close the tab.
          The motivation drains within minutes.
        </p>
        <p>
          The problem isn't the content. The problem is the order. You can't enjoy something you
          can't understand, and you can't understand something when every third word sends you to
          a dictionary.
        </p>
        <p>
          Wortgraph flips this. Before you read an article or watch a video, you paste the text
          and extract the vocabulary that will actually appear in it. You practice those specific words —
          with their context, their examples, their pronunciation. Then you go back and read the
          original text. And this time, you understand it. And because you understand it,
          you want to read more.
        </p>
        <p>
          That loop — <em>prepare, practice, read, feel capable</em> — is what keeps people going.
          Wortgraph is built around it.
        </p>
      </Section>

      <Divider />

      <Section title="What makes it different">
        <p>
          Most vocabulary apps treat words like isolated flashcards. You memorise <em>Beschluss</em> in
          a session and forget it within a week — because it lives nowhere. It has no context, no
          neighbours, no weight.
        </p>
        <p>
          Language, at its core, is a network. Words carry meaning through their relationships:
          what they appear with, what topic they belong to, how central they are to your
          comprehension. Every word you save in Wortgraph becomes a node in your personal
          knowledge graph — connected to the words it appeared with, grouped by topic,
          and scored by how well you know it.
        </p>
        <p>
          The result is something no flashcard app can offer: <strong>a map of what you know,
          and a precise diagnosis of what you're missing.</strong>
        </p>
      </Section>

      <Divider />

      <Section title="The AI Coach">
        <p>
          The AI Coach doesn't just answer questions. It reads your graph — your retention
          scores, your weakest clusters, the bridge words that could connect isolated parts
          of your vocabulary — and reasons about them. When it tells you to focus on
          <em> Verwaltung</em> this week, it's because your graph shows that word sitting at the
          intersection of three topic clusters you're already building.
        </p>
        <p>
          It uses Neo4j vector similarity search to find words by meaning, not just by
          keyword — so "political decisions" surfaces <em>Beschluss, Abstimmung, Gesetzgebung</em>
          ranked by semantic distance.
        </p>
      </Section>

      <Divider />

      <Section title="Limitations (honestly)">
        <ul style={{ paddingLeft: 20, lineHeight: 2, color: 'var(--ink-2)', fontSize: 14 }}>
          <li><strong>Works best with focused passages</strong> — paste one section at a time (under 600 words), not a whole article. The goal is to read that section afterwards, not to build an abstract vocabulary list.</li>
          <li><strong>YouTube transcripts are manual</strong> — YouTube blocks server-side scraping. The app guides you to copy and paste the transcript yourself.</li>
          <li><strong>Graph needs words to show insights</strong> — bridge words and cluster analysis require a populated deck. Use the demo data to explore the full experience immediately.</li>
          <li><strong>No authentication</strong> — users are identified by name only. Personal use and demos; not production-ready for multi-user privacy.</li>
        </ul>
      </Section>

      <Divider />

      <Section title="Who this is for">
        <p>
          Language learners at the B1–C1 level who are past the basics but hitting a plateau.
          The learner who can order coffee but can't follow the news. Who studies vocabulary
          lists but can't find words when speaking. Who keeps opening foreign-language content
          and closing it five minutes later, discouraged.
        </p>
        <p>
          Wortgraph meets you where the frustration lives — in the text you want to understand —
          and gives you a way to prepare for it, rather than fight through it unprepared.
        </p>
      </Section>

      <Divider />

      <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setRoute('explore')}>
          Try it — paste a text →
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setRoute('agent')}>
          Explore the AI Coach
        </button>
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6 }}>
        Built for the Neo4j Hackathon 2026 · Neo4j Aura · React · Groq LLaMA 3.3 70B · Gemini embeddings
      </p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>
          {title}
        </h3>
      )}
      <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '28px 0' }} />;
}
