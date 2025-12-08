import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
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
  placeholder = 'Введите тег...',
  maxLength = 30,
}: TagsInputProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

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

  // Reset selected index when filtered tags change
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [filteredTags]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTag = (tag: string) => {
    setError(null);
    onAddTag(tag);
    setSearchQuery('');
    setOpen(false);
    setSelectedIndex(-1);
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
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setSelectedIndex((prev) => Math.min(prev + 1, filteredTags.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (selectedIndex >= 0 && filteredTags[selectedIndex]) {
        // Select highlighted tag
        handleSelectTag(filteredTags[selectedIndex]);
      } else if (hasExactMatch) {
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
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="space-y-2">
      {/* Direct input with autocomplete */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        
        {/* Dropdown with results (shown when open=true) */}
        {open && (
          <div 
            ref={dropdownRef}
            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>
                  {error ? (
                    <div className="text-sm text-red-600 px-2 py-3">
                      {error}
                    </div>
                  ) : (
                    <div className="px-2 py-3">
                      {searchQuery.trim() ? (
                        <div
                          className="text-sm cursor-pointer hover:bg-accent px-2 py-1.5 rounded-sm"
                          onClick={handleCreateNewTag}
                        >
                          Создать тег "{searchQuery.trim()}"
                        </div>
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
                    {filteredTags.map((tag, index) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => handleSelectTag(tag)}
                        className={selectedIndex === index ? 'bg-accent' : ''}
                      >
                        {tag}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>
        )}
      </div>
      
      {/* Selected tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="ml-1 hover:text-red-600"
                aria-label={`Удалить тег ${tag}`}
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
