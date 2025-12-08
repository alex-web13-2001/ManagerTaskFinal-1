import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { X } from 'lucide-react';

export interface TagsInputProps {
  tags: string[];
  availableTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export function TagsInput({
  tags,
  availableTags,
  onAddTag,
  onRemoveTag,
  placeholder = 'Выберите или создайте тег',
  maxLength = 30,
}: TagsInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Filter available tags based on search query and exclude already selected tags
  const filteredTags = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return availableTags.filter((tag) => !tags.includes(tag));
    
    return availableTags
      .filter((tag) => !tags.includes(tag))
      .filter((tag) => tag.toLowerCase().includes(query));
  }, [availableTags, tags, searchQuery]);

  // Check if there's an exact match in available tags
  const hasExactMatch = React.useMemo(() => {
    const query = searchQuery.trim();
    return filteredTags.some((tag) => tag.toLowerCase() === query.toLowerCase());
  }, [filteredTags, searchQuery]);

  const handleSelectTag = (tag: string) => {
    setError(null);
    onAddTag(tag);
    setSearchQuery('');
    setOpen(false);
  };

  const handleCreateNewTag = () => {
    const newTag = searchQuery.trim();
    
    if (!newTag) {
      setError('Введите название тега');
      return;
    }
    
    if (newTag.length > maxLength) {
      setError(`Тег не может быть длиннее ${maxLength} символов`);
      return;
    }
    
    if (tags.includes(newTag)) {
      setError('Этот тег уже добавлен');
      return;
    }
    
    setError(null);
    onAddTag(newTag);
    setSearchQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (hasExactMatch) {
        // If there's an exact match, select it
        const exactMatch = filteredTags.find(
          (tag) => tag.toLowerCase() === searchQuery.trim().toLowerCase()
        );
        if (exactMatch) {
          handleSelectTag(exactMatch);
        }
      } else {
        // Otherwise, create new tag
        handleCreateNewTag();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearchQuery('');
      setError(null);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-start text-left font-normal"
          >
            {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {/* shouldFilter={false} because we implement custom filtering logic below */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск тегов..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              <CommandEmpty>
                {error ? (
                  <div className="text-sm text-red-600 px-2 py-3">
                    {error}
                  </div>
                ) : (
                  <div className="px-2 py-3">
                    {searchQuery.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={handleCreateNewTag}
                      >
                        Создать тег "{searchQuery.trim()}"
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Начните вводить для поиска или создания тега
                      </p>
                    )}
                  </div>
                )}
              </CommandEmpty>
              {filteredTags.length > 0 && (
                <CommandGroup>
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => handleSelectTag(tag)}
                    >
                      {tag}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
