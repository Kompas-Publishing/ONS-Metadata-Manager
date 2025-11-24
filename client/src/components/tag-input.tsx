import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  type: 'genre' | 'contentType' | 'tags';
  placeholder?: string;
  disabled?: boolean;
}

interface UserDefinedTag {
  id: number;
  userId: string;
  type: string;
  value: string;
  createdAt: Date;
}

export function TagInput({ value, onChange, type, placeholder = "Add tags...", disabled = false }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: savedTags = [], isLoading } = useQuery<UserDefinedTag[]>({
    queryKey: ['/api/user-tags', type],
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createTagMutation = useMutation<UserDefinedTag, Error, string>({
    mutationFn: async (tagValue: string) => {
      const response = await apiRequest('POST', '/api/user-tags', {
        type,
        value: tagValue,
      });
      return await response.json();
    },
    onSuccess: (newTag: UserDefinedTag) => {
      queryClient.setQueryData(['/api/user-tags', type], (old: UserDefinedTag[] = []) => {
        return [newTag, ...old];
      });
    },
  });

  const savedTagValues = savedTags.map(tag => tag.value);
  const availableTags = savedTagValues.filter(tag => !value.includes(tag));

  const addTag = (tagValue: string) => {
    const trimmedValue = tagValue.trim();
    if (!trimmedValue || value.includes(trimmedValue)) {
      setInputValue("");
      setOpen(false);
      return;
    }

    onChange([...value, trimmedValue]);

    if (!savedTagValues.includes(trimmedValue)) {
      createTagMutation.mutate(trimmedValue);
    }

    setInputValue("");
    setOpen(false);
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    }
  };

  const handleSelectSuggestion = (tagValue: string) => {
    addTag(tagValue);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 relative" ref={containerRef}>
        <div className="flex-1 relative">
          <Input
            className="flex-1"
            placeholder={placeholder}
            value={inputValue}
            onFocus={() => !disabled && setOpen(true)}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            data-testid={`input-tag-${type}`}
          />
          {open && !disabled && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
              <Command>
                <CommandList>
                  {isLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">Loading...</div>
                  ) : availableTags.length === 0 ? (
                    <CommandEmpty>
                      {inputValue.trim()
                        ? `Press Enter or click Add to create "${inputValue.trim()}"`
                        : "No saved tags. Type to create a new one."}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup heading="Click to add">
                      {availableTags
                        .filter(tag =>
                          inputValue.trim()
                            ? tag.toLowerCase().includes(inputValue.toLowerCase())
                            : true
                        )
                        .map((tag) => (
                          <CommandItem
                            key={tag}
                            value={tag}
                            onSelect={() => handleSelectSuggestion(tag)}
                            data-testid={`suggestion-${type}-${tag}`}
                          >
                            <Plus className="w-4 h-4 mr-2 text-muted-foreground" />
                            {tag}
                          </CommandItem>
                        ))}
                      {inputValue.trim() &&
                        !availableTags.some(
                          tag => tag.toLowerCase() === inputValue.trim().toLowerCase()
                        ) && (
                          <CommandItem
                            value={inputValue.trim()}
                            onSelect={() => handleSelectSuggestion(inputValue.trim())}
                            data-testid={`suggestion-${type}-new`}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create "{inputValue.trim()}"
                          </CommandItem>
                        )}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            onClick={() => {
              if (inputValue.trim()) {
                addTag(inputValue);
              }
            }}
            disabled={!inputValue.trim()}
            data-testid={`button-add-tag-${type}`}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="gap-1"
              data-testid={`badge-tag-${type}-${index}`}
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="ml-1 hover:text-destructive"
                  data-testid={`button-remove-tag-${type}-${index}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
