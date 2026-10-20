import * as React from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface BranchOption {
  id: string;
  branchName?: string;
  branch_name?: string;
  city?: string;
}

interface BranchComboboxProps {
  value: string;
  branches: BranchOption[];
  onChange: (branchId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function BranchCombobox({
  value,
  branches,
  onChange,
  disabled = false,
  placeholder = 'Select branch...',
  className,
}: BranchComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = branches.find((b) => b.id === value);
  const displayText = selected
    ? `${selected.branchName || selected.branch_name || 'Branch'} (${selected.city || ''})`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          title={displayText}
          className={cn(
            'h-8 min-w-[150px] max-w-[210px] justify-between text-xs font-normal border-border bg-card text-foreground px-2.5 rounded-lg hover:bg-secondary/70 shadow-2xs',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{displayText}</span>
          </span>
          <ChevronsUpDown className="ml-1.5 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[230px] p-0 rounded-xl border border-border bg-popover shadow-lg" align="start">
        <Command>
          <CommandInput placeholder="Search branch or city..." className="h-8 text-xs" />
          <CommandList className="max-h-56 p-1">
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
              No branch found.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-xs py-1.5 px-2 rounded-lg cursor-pointer flex items-center justify-between"
              >
                <span className="text-muted-foreground italic">No Branch Assigned</span>
                {!value && <Check className="h-3.5 w-3.5 text-primary" />}
              </CommandItem>
              {branches.map((b) => {
                const bName = b.branchName || b.branch_name || 'Branch';
                const label = `${bName} (${b.city || ''})`;
                const isSelected = value === b.id;
                return (
                  <CommandItem
                    key={b.id}
                    value={`${bName} ${b.city || ''}`}
                    onSelect={() => {
                      onChange(b.id);
                      setOpen(false);
                    }}
                    className="text-xs py-1.5 px-2 rounded-lg cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
