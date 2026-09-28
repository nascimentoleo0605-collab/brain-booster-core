export type PdfQuestion = {
  sourceNumber: string;
  statement: string;
  options: string[];
  correct_index: number | null;
  explanation: string;
};

const QUESTION = /^(?:quest[aã]o\s*)?(\d{1,4})\s*[.)º°:-]\s*(.+)$/i;
const OPTION = /^([A-Fa-f])\s*[).:\-]\s*(.+)$/;
const INLINE_ANSWER = /(?:resposta|gabarito|alternativa\s+correta)\s*[:\-]?\s*([A-Fa-f])\b/i;

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function collectAnswerKey(lines: string[]) {
  const answers = new Map<string, string>();
  let inKey = false;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (/^gabarito\b/i.test(line)) inKey = true;
    if (!inKey) continue;

    for (const match of line.matchAll(/(?:^|\s|[;,|])(?:quest[aã]o\s*)?(\d{1,4})\s*[-.):]?\s*([A-Fa-f])(?=\s|$|[;,|])/gi)) {
      answers.set(match[1], match[2].toUpperCase());
    }
  }
  return answers;
}

export function parsePdfQuestions(text: string): PdfQuestion[] {
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
  const answerKey = collectAnswerKey(lines);
  const questions: PdfQuestion[] = [];
  let current: PdfQuestion | null = null;
  let optionIndex = -1;
  let readingKey = false;

  const finish = () => {
    if (!current || current.options.length < 2 || !current.statement.trim()) return;
    const keyed = answerKey.get(current.sourceNumber);
    if (current.correct_index === null && keyed) {
      const index = keyed.charCodeAt(0) - 65;
      current.correct_index = index < current.options.length ? index : null;
    }
    questions.push(current);
  };

  for (const line of lines) {
    if (/^gabarito\b/i.test(line)) {
      readingKey = true;
      continue;
    }
    if (readingKey) continue;

    const question = line.match(QUESTION);
    if (question && !OPTION.test(line)) {
      finish();
      current = {
        sourceNumber: question[1],
        statement: question[2],
        options: [],
        correct_index: null,
        explanation: "",
      };
      optionIndex = -1;
      continue;
    }
    if (!current) continue;

    const option = line.match(OPTION);
    if (option) {
      optionIndex = option[1].toUpperCase().charCodeAt(0) - 65;
      if (optionIndex === current.options.length && current.options.length < 6) {
        current.options.push(option[2]);
      }
      const inline = option[2].match(INLINE_ANSWER);
      if (inline) current.correct_index = inline[1].toUpperCase().charCodeAt(0) - 65;
      continue;
    }

    const inline = line.match(INLINE_ANSWER);
    if (inline) {
      const index = inline[1].toUpperCase().charCodeAt(0) - 65;
      current.correct_index = index < current.options.length ? index : null;
      current.explanation = line.replace(INLINE_ANSWER, "").trim();
    } else if (optionIndex >= 0 && optionIndex < current.options.length) {
      current.options[optionIndex] = `${current.options[optionIndex]} ${line}`.trim();
    } else {
      current.statement = `${current.statement} ${line}`.trim();
    }
  }

  finish();
  return questions;
}