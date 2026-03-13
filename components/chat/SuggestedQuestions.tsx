"use client";

interface Props {
  questions: string[];
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ questions, onSelect }: Props) {
  if (questions.length === 0) return null;

  return (
    <div className="px-3 pb-2 space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
      <div className="flex flex-col gap-1.5">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="text-left text-xs px-3 py-2 rounded-xl border border-dashed hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
