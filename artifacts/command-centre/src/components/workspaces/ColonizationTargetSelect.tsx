import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetF10Catalog } from "@workspace/api-client-react";

export type ColonizationTarget = string;

export function ColonizationTargetSelect({ value, onChange, disabled, testId }: {
  value: ColonizationTarget;
  onChange: (value: ColonizationTarget) => void;
  disabled?: boolean;
  testId: string;
}) {
  const catalog = useGetF10Catalog();
  const options = catalog.data?.families.flatMap(family =>
    family.targets.map(target => ({ value: `${family.family}::${target}`, label: `${family.family} / ${target}` })),
  ) ?? [];
  return <div>
    <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
      Future F10 colonization target
    </label>
    <Select value={value} onValueChange={v => onChange(v as ColonizationTarget)} disabled={disabled}>
      <SelectTrigger data-testid={testId} className="font-mono text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="UNDECIDED">Not decided yet</SelectItem>
        {options.map(({ value, label }) =>
          <SelectItem key={value} value={value} className="font-mono text-xs">{label}</SelectItem>)}
      </SelectContent>
    </Select>
    <p className="mt-1 text-xs text-muted-foreground">Planning only; F10 still requires qualification, consent and target verification.</p>
    {catalog.isError && <p role="alert" className="text-xs text-destructive">F10 targets could not be loaded. Retry before choosing a specific target.</p>}
  </div>;
}
