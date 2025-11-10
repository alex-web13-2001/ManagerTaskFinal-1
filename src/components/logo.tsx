import React from 'react';
import { motion } from 'framer-motion';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
  onClick?: () => void;
};

export function Logo({ size = 'md', iconOnly = false, onClick }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', iconText: 'text-sm' },
    md: { icon: 'w-10 h-10', text: 'text-xl', iconText: 'text-base' },
    lg: { icon: 'w-14 h-14', text: 'text-2xl', iconText: 'text-xl' },
  };

  const { icon: iconSize, text: textSize, iconText } = sizes[size];

  return (
    <div
      className={`flex items-center gap-2 md:gap-3 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      onClick={onClick}
    >
      {/* Иконка с градиентом */}
      <div className={`relative ${iconSize} rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-lg flex items-center justify-center overflow-hidden group`}>
        {/* Анимированный градиентный оверлей */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 opacity-80 group-hover:opacity-100 transition-opacity" />
        
        {/* Декоративные точки */}
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white/40 rounded-full" />
        <div className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-white/30 rounded-full" />
        
        {/* Текст T24 */}
        <span className={`relative z-10 text-white ${iconText} font-bold tracking-tight drop-shadow-md`}>
          T24
        </span>
        
        {/* Эффект свечения при наведении */}
        <div className="absolute inset-0 bg-blue-400/0 group-hover:bg-blue-400/10 transition-colors rounded-2xl" />
      </div>

      {/* Название приложения */}
      {!iconOnly && (
        <div className="flex flex-col">
          <span className="text-sm md:text-base text-gray-700 tracking-wide font-bold">
            Менеджер ваших задач
          </span>
        </div>
      )}
    </div>
  );
}

// Вариант только иконки для использования в разных местах
export function LogoIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { wrapper: 'w-6 h-6', text: 'text-xs' },
    md: { wrapper: 'w-8 h-8', text: 'text-sm' },
    lg: { wrapper: 'w-12 h-12', text: 'text-lg' },
  };

  const { wrapper, text } = sizes[size];

  return (
    <div className={`relative ${wrapper} rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-lg flex items-center justify-center overflow-hidden group`}>
      {/* Декоративные элементы */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 opacity-80" />
      <div className="absolute top-1 right-1 w-1 h-1 bg-white/40 rounded-full" />
      <div className="absolute bottom-1 left-1 w-0.5 h-0.5 bg-white/30 rounded-full" />
      
      {/* Текст T24 */}
      <span className={`relative z-10 text-white ${text} font-bold tracking-tight drop-shadow-md`}>
        T24
      </span>
    </div>
  );
}

// Анимированный логотип для экрана входа
export function AnimatedLogo() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center"
    >
      <motion.div
        className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-2xl flex items-center justify-center overflow-hidden mb-4"
        whileHover={{ scale: 1.05, rotate: 2 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {/* Анимированный градиентный оверлей */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20"
          animate={{
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Декоративные точки с анимацией */}
        <motion.div
          className="absolute top-2 right-2 w-2 h-2 bg-white/40 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-white/30 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            delay: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Текст T24 с легкой анимацией */}
        <motion.span
          className="relative z-10 text-white text-3xl font-extrabold tracking-tight drop-shadow-lg"
          animate={{
            textShadow: [
              '0 2px 8px rgba(0,0,0,0.3)',
              '0 4px 12px rgba(0,0,0,0.4)',
              '0 2px 8px rgba(0,0,0,0.3)',
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          T24
        </motion.span>
        
        {/* Эффект свечения */}
        <motion.div
          className="absolute inset-0 bg-blue-400/20 rounded-3xl"
          animate={{
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Название с градиентом */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <p className="text-lg text-gray-700 font-bold">
          Менеджер ваших задач
        </p>
      </motion.div>
    </motion.div>
  );
}
