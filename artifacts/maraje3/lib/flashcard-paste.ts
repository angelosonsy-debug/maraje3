// Shared "سؤال | إجابة" bulk-paste parser used by both the contributor
// suggest-a-deck screen and the admin bulk flashcard creator.

export type ParsedCardLine = { questionAr: string; answerAr: string };

export function parseFlashcardPaste(text: string): {
  cards: ParsedCardLine[];
  skippedLines: number;
} {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const cards: ParsedCardLine[] = [];
  let skippedLines = 0;

  for (const line of lines) {
    const separatorIndex = line.indexOf("|");
    if (separatorIndex === -1) {
      skippedLines += 1;
      continue;
    }
    const questionAr = line.slice(0, separatorIndex).trim();
    const answerAr = line.slice(separatorIndex + 1).trim();
    if (!questionAr || !answerAr) {
      skippedLines += 1;
      continue;
    }
    cards.push({ questionAr, answerAr });
  }

  return { cards, skippedLines };
}
