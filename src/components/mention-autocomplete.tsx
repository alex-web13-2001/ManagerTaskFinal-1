import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { TeamMember } from '../types';

interface MentionAutocompleteProps {
  users: TeamMember[];
  onSelect: (user: TeamMember) => void;
  searchQuery: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
}

// Helper to get initials from name
const getInitials = (name: string | undefined) => {
  if (!name || !name.trim()) return '?';
  const trimmedName = name.trim();
  return trimmedName
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function MentionAutocomplete({
  users,
  onSelect,
  searchQuery,
  textareaRef,
  onClose,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Flag to prevent race condition between click selection and outside click detection
  // Set to true when user clicks to select, cleared after selection completes
  const isSelectingRef = useRef(false);

  // Filter users based on search query
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Calculate position based on textarea ref
  useEffect(() => {
    let rafId: number | null = null;
    
    const updatePosition = () => {
      // Cancel any pending animation frame to avoid duplicate updates
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      // Schedule update for next animation frame for better performance
      rafId = requestAnimationFrame(() => {
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          
          setPosition({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
        rafId = null;
      });
    };
    
    // Calculate initial position immediately
    updatePosition();
    
    // Update position on various events
    const dialogContent = document.querySelector('[data-slot="dialog-content"]');
    
    // Add listeners
    // Note: Using capture:true for window scroll to catch all nested scroll events
    // Position updates are throttled via requestAnimationFrame for performance
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    if (dialogContent) {
      dialogContent.addEventListener('scroll', updatePosition);
    }
    
    // Cleanup all listeners
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (dialogContent) {
        dialogContent.removeEventListener('scroll', updatePosition);
      }
    };
  }, [textareaRef]); // Position depends on textarea ref

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredUsers]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Skip if element selection is in progress
      if (isSelectingRef.current) return;
      
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Note: Item selection uses onMouseDown to fire before this mousedown handler
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [filteredUsers, selectedIndex, onSelect, onClose]);

  if (filteredUsers.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] w-72 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {filteredUsers.map((user, index) => (
        <div
          key={user.id}
          ref={el => itemRefs.current[index] = el}
          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
            index === selectedIndex
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevent textarea from losing focus
            e.stopPropagation();
            // Set flag to prevent handleClickOutside from closing before onSelect completes
            isSelectingRef.current = true;
            onSelect(user);
            // Clear flag after event loop completes to allow future outside clicks
            setTimeout(() => { isSelectingRef.current = false; }, 0);
          }}
        >
          <Avatar className="w-8 h-8">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            )}
            <AvatarFallback className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {user.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
