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

export const weakWords = [
  { word: "der Sachverhalt", trans: "the matter, set of facts", retention: 42, level: "high" },
  { word: "die Verkehrswende", trans: "transport transition", retention: 51, level: "high" },
  { word: "der Wirkungsgrad", trans: "efficiency", retention: 58, level: "med" },
  { word: "das Mitbestimmungsrecht", trans: "co-determination right", retention: 61, level: "med" },
  { word: "die Konjunktur", trans: "economic situation", retention: 64, level: "med" }
];

export const activity = [
  { type: "deck", text: "Added 12 words from Zeit Online article", time: "32m" },
  { type: "review", text: "Completed review session — 18 cards", time: "2h" },
  { type: "milestone", text: "Reached B2 mastery in Politics topic", time: "1d" },
  { type: "deck", text: "Imported transcript from Lage der Nation #412", time: "2d" },
  { type: "review", text: "Completed review session — 24 cards", time: "3d" }
];
