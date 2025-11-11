/**
 * Reusable Error Message Component
 * Use this component to display consistent error messages across the application
 */
import React from 'react';
import { AlertTriangle, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface ErrorMessageProps {
  /**
   * The error message to display
   */
  message?: string;
  /**
   * The error title (default: 'Ошибка')
   */
  title?: string;
  /**
   * Type of error (affects icon and color)
   */
  type?: 'error' | 'warning' | 'critical';
  /**
   * Optional retry callback
   */
  onRetry?: () => void;
  /**
   * Optional back/cancel callback
   */
  onBack?: () => void;
  /**
   * Whether to show the error as full page (default: true)
   */
  fullPage?: boolean;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

const iconMap = {
  error: AlertCircle,
  warning: AlertTriangle,
  critical: XCircle,
};

const colorMap = {
  error: 'text-red-500',
  warning: 'text-orange-500',
  critical: 'text-red-700',
};

export function ErrorMessage({ 
  message = 'Произошла ошибка при загрузке данных', 
  title = 'Ошибка',
  type = 'error',
  onRetry,
  onBack,
  fullPage = true,
  className = ''
}: ErrorMessageProps) {
  const Icon = iconMap[type];
  const iconColor = colorMap[type];

  const content = (
    <div className={`text-center ${className}`}>
      <Icon className={`w-12 h-12 ${iconColor} mx-auto mb-4`} />
      <h2 className="text-gray-900 text-xl mb-2">{title}</h2>
      <p className="text-gray-600 mb-4 max-w-md mx-auto">{message}</p>
      <div className="flex gap-3 justify-center">
        {onRetry && (
          <Button onClick={onRetry} className="bg-purple-600 hover:bg-purple-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Повторить попытку
          </Button>
        )}
        {onBack && (
          <Button onClick={onBack} variant="outline">
            Назад
          </Button>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return content;
}
