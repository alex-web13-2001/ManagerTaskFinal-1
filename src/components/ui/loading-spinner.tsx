/**
 * Reusable Loading Spinner Component
 * Use this component to show a consistent loading state across the application
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /**
   * Optional message to display below the spinner
   */
  message?: string;
  /**
   * Size of the spinner (default: 'default')
   */
  size?: 'small' | 'default' | 'large';
  /**
   * Whether to center the spinner in the container (default: true)
   */
  center?: boolean;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

const sizeClasses = {
  small: 'w-4 h-4',
  default: 'w-8 h-8',
  large: 'w-12 h-12',
};

export function LoadingSpinner({ 
  message = 'Загрузка...', 
  size = 'default',
  center = true,
  className = ''
}: LoadingSpinnerProps) {
  const content = (
    <div className={`${center ? 'text-center' : ''} ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-purple-600 ${center ? 'mx-auto mb-4' : ''}`} />
      {message && <p className="text-gray-600">{message}</p>}
    </div>
  );

  if (center) {
    return (
      <div className="flex-1 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
