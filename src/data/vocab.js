// Brand colors for CEFR proficiency levels — shared across all views
export const CEFR_COLOR = { B1: '#7f77dd', B2: '#5b8ff9', C1: '#1d9e75', C2: '#e24b4a' };

export const flashcards = [
  {
    article: "die",
    word: "Arbeitslosigkeit",
    translation: "unemployment",
    cefr: "B2",
    topic: "Employment",
    example: "Die Arbeitslosigkeit ist im letzten Quartal leicht gesunken.",
    exampleEn: "Unemployment fell slightly in the last quarter."
  },
  {
    article: "der",
    word: "Wirkungsgrad",
    translation: "efficiency",
    cefr: "C1",
    topic: "Engineering",
    example: "Der Wirkungsgrad neuer Solarmodule überschreitet 23 Prozent.",
    exampleEn: "The efficiency of new solar modules exceeds 23 percent."
  },
  {
    article: "das",
    word: "Mitbestimmungsrecht",
    translation: "right of co-determination",
    cefr: "C1",
    topic: "Politics",
    example: "Arbeitnehmer haben in deutschen Konzernen ein Mitbestimmungsrecht.",
    exampleEn: "Employees have co-determination rights in German corporations."
  },
  {
    article: "die",
    word: "Verkehrswende",
    translation: "transport transition",
    cefr: "B2",
    topic: "Climate",
    example: "Die Verkehrswende erfordert massive Investitionen in den Nahverkehr.",
    exampleEn: "The transport transition requires huge investment in public transit."
  },
  {
    article: "der",
    word: "Sachverhalt",
    translation: "set of facts; matter",
    cefr: "B2",
    topic: "Journalism",
    example: "Der Sachverhalt ist komplexer, als es zunächst scheint.",
    exampleEn: "The matter is more complex than it first appears."
  }
];

export const extractedWords = [
  { article: "die", word: "Inflation", cefr: "B1" },
  { article: "der", word: "Verbraucher", cefr: "B2" },
  { article: "das", word: "Preisniveau", cefr: "B2" },
  { article: "die", word: "Geldpolitik", cefr: "C1" },
  { article: "der", word: "Leitzins", cefr: "C1" },
  { article: "die", word: "Eurozone", cefr: "B1" },
  { article: "die", word: "Notenbank", cefr: "B2" },
  { article: "die", word: "Rezession", cefr: "B2" },
  { article: "der", word: "Haushalt", cefr: "B1" },
  { article: "das", word: "Wachstum", cefr: "B1" },
  { article: "die", word: "Lebenshaltungskosten", cefr: "B2" },
  { article: "der", word: "Sparkurs", cefr: "C1" },
  { article: "die", word: "Konjunktur", cefr: "B2" },
  { article: "die", word: "Stagflation", cefr: "C1" },
  { article: "der", word: "Mietpreisbremse", cefr: "C1" },
  { article: "die", word: "Lohnentwicklung", cefr: "B2" }
];

export const sampleText = `Die Inflation in der Eurozone ist im April erneut leicht gestiegen. Verbraucher spüren die höheren Lebenshaltungskosten vor allem bei Lebensmitteln und Energie. Die Europäische Zentralbank hält am aktuellen Leitzins fest, um die Geldpolitik nicht zu lockern, bevor das Preisniveau stabil ist. Wirtschaftsforscher warnen vor einer möglichen Rezession, falls die Konjunktur weiter schwächelt.`;
