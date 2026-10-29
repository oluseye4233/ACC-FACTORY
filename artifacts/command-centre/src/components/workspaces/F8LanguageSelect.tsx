export const F8_LANGUAGE_LABELS = { python: "Python", javascript: "JavaScript", sql: "SQL", c: "C", cpp: "C++", csharp: "C#" } as const;
export type F8Language = keyof typeof F8_LANGUAGE_LABELS;

export function F8LanguageSelect({ value, onChange }: { value: F8Language; onChange: (language: F8Language) => void }) {
  return <label className="block space-y-2 text-xs mb-3">
    <span>Programming language</span>
    <select className="h-9 w-full rounded border bg-background px-2" value={value}
      onChange={event => onChange(event.target.value as F8Language)} data-testid="f8-language">
      {Object.entries(F8_LANGUAGE_LABELS).map(([language, label]) => <option key={language} value={language}>{label}</option>)}
    </select>
    <span className="block text-muted-foreground">CODE ONE+, CODE DJ and CODE ORACLE support these six languages only. TypeScript is excluded. Python, SQL and C-family output is an editable source handoff; compilation and target execution require separate evidence.</span>
  </label>;
}
