"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  disable?: boolean;
  /** fixed option that can't be removed. */
  fixed?: boolean;
}

interface MultiSelectProps {
  options: Option[];
  value: Option[];
  onChange: (value: Option[]) => void;
  placeholder?: string;
  /**
   * The maximum number of items that can be selected.
   * @default undefined
   */
  max?: number;
  /**
   * If true, the user cannot add any more items than the max.
   * @default false
   */
  disableCreateOnMaxReached?: boolean;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  max,
  disableCreateOnMaxReached = false,
  disabled = false
}: MultiSelectProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = React.useCallback(
    (option: Option) => {
      onChange(value.filter((s) => s.value !== option.value));
    },
    [onChange, value]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (input.value === "" && value.length > 0) {
            const lastSelect = value[value.length - 1];
            // If the last item is fixed, we don't want to remove it
            if (!lastSelect.fixed) {
              handleUnselect(lastSelect);
            }
          }
        }
        // This is not a default behaviour of the <input /> field
        if (e.key === "Escape") {
          input.blur();
        }
      }
    },
    [handleUnselect, value]
  );

  const selectables = options.filter(
    (option) => !value.some((s) => s.value === option.value)
  );

  return (
    <Command
      onKeyDown={handleKeyDown}
      className="overflow-visible bg-transparent"
    >
      <div className={cn(
        "group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50"
      )}>
        <div className="flex flex-wrap gap-1">
          {value.map((option) => {
            return (
              <Badge
                key={option.value}
                variant="secondary"
                className={cn(option.fixed && "cursor-not-allowed")}
              >
                {option.label}
                <button
                  className={cn(
                    "ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    (option.fixed || disabled) && "hidden"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(option);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => handleUnselect(option)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
          {/* Avoid having the command input displayed when the component is disabled */}
          {!disabled && <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={
              (max !== undefined &&
                value.length >= max &&
                disableCreateOnMaxReached) ||
              disabled
            }
            className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />}
        </div>
      </div>
      <div className="relative mt-2">
        {open && selectables.length > 0 ? (
          <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <CommandList>
              <CommandGroup className="h-full overflow-auto">
                {selectables.map((option) => {
                  return (
                    <CommandItem
                      key={option.value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => {
                        if (max !== undefined && value.length >= max) {
                          return;
                        }
                        setInputValue("");
                        onChange([...value, option]);
                      }}
                      className={"cursor-pointer"}
                      disabled={option.disable}
                    >
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </div>
        ) : null}
      </div>
    </Command>
  );
}