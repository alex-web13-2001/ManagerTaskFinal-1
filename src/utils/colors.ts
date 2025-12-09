/**
 * Utility for getting Tailwind CSS color classes for projects
 */

export function getColorForProject(color?: string): string {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
    orange: 'bg-orange-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
    gray: 'bg-gray-500',
  };
  return colorMap[color || ''] || 'bg-gray-500';
}
