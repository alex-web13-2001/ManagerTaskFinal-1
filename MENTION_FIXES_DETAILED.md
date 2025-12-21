# Исправление механизма упоминания пользователей в комментариях

## 🔍 Проблемы

Согласно описанию задачи:
1. **Позиция окна выбора не обновляется** - автокомплит не следует за текстовым полем при прокрутке
2. **Пользователи не упоминаются** - упоминания не сохраняются в базе данных
3. **Механизм не работает** - общие проблемы с функциональностью

## ✅ Исправления

### Исправление 1: Расчет позиции автокомплита

**Файл**: `src/components/mention-autocomplete.tsx`

**Проблема**: 
- Позиция рассчитывалась только при первом рендере
- Не обновлялась при прокрутке диалога
- Не обновлялась при прокрутке окна
- Не обновлялась при изменении размера окна

**Код ДО**:
```typescript
useEffect(() => {
  const updatePosition = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  };
  
  updatePosition();
  
  const dialogContent = document.querySelector('[data-slot="dialog-content"]');
  if (dialogContent) {
    dialogContent.addEventListener('scroll', updatePosition);
    return () => dialogContent.removeEventListener('scroll', updatePosition);
  }
}, [textareaRef]);
```

**Проблемы в коде**:
1. Слушатель только для `dialogContent.scroll`
2. Нет слушателя для `window.scroll`
3. Нет слушателя для `window.resize`
4. Если `dialogContent` не найден, cleanup функция не возвращается
5. Зависимости `[textareaRef]` - эффект не перезапускается при изменении списка пользователей

**Код ПОСЛЕ**:
```typescript
useEffect(() => {
  const updatePosition = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const rect = textarea.getBoundingClientRect();
      
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  };
  
  // Calculate initial position immediately
  updatePosition();
  
  // Update position on various events
  const dialogContent = document.querySelector('[data-slot="dialog-content"]');
  
  // Add listeners
  window.addEventListener('scroll', updatePosition, true); // Use capture for all scrolls
  window.addEventListener('resize', updatePosition);
  if (dialogContent) {
    dialogContent.addEventListener('scroll', updatePosition);
  }
  
  // Cleanup all listeners
  return () => {
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
    if (dialogContent) {
      dialogContent.removeEventListener('scroll', updatePosition);
    }
  };
}, [textareaRef, filteredUsers.length]); // Re-calculate when filtered users change
```

**Что исправлено**:
1. ✅ Добавлен `window.scroll` с `capture: true` для отлова всех событий прокрутки
2. ✅ Добавлен `window.resize` для обновления при изменении размера окна
3. ✅ Cleanup функция всегда возвращается и удаляет все слушатели
4. ✅ Добавлена зависимость `filteredUsers.length` для пересчета при изменении списка

### Исправление 2: Логика сопоставления упоминаний на бэкенде

**Файл**: `src/lib/mentions.ts`

**Проблема**:
Несоответствие между генерацией имени пользователя на фронтенде и сопоставлением на бэкенде.

**Пример**:
- Email: `john+test@example.com`
- **Frontend** генерирует: `john+test` → санация → `johntest` (символ `+` удален)
- **Backend** пытался сопоставить: `john+test@example.com`.startsWith(`johntest`) → **FALSE!**

**Код ДО**:
```typescript
export function getUsersByMentions(
  mentions: string[], 
  projectMembers: Array<{id: string, name: string, email: string}>
): string[] {
  const userIds = new Set<string>();
  
  for (const mention of mentions) {
    const mentionLower = mention.toLowerCase();
    
    const found = projectMembers.find(member => 
      (member.name && member.name.toLowerCase().includes(mentionLower)) ||
      member.email.toLowerCase().startsWith(mentionLower)
    );
    
    if (found) {
      userIds.add(found.id);
    }
  }
  
  return Array.from(userIds);
}
```

**Проблемы в коде**:
1. Используется `email.toLowerCase().startsWith(mentionLower)` - сравнение с исходным email
2. Email содержит специальные символы (`+`, `!`, и т.д.), которые фронтенд удаляет
3. Сравнение всегда будет ложным для email со специальными символами

**Код ПОСЛЕ**:
```typescript
export function getUsersByMentions(
  mentions: string[], 
  projectMembers: Array<{id: string, name: string, email: string}>
): string[] {
  const userIds = new Set<string>();
  
  for (const mention of mentions) {
    const mentionLower = mention.toLowerCase();
    
    const found = projectMembers.find(member => {
      // Check if name includes the mention
      if (member.name && member.name.toLowerCase().includes(mentionLower)) {
        return true;
      }
      
      // Check if email prefix matches (after sanitization)
      if (member.email && member.email.includes('@')) {
        const emailPrefix = member.email.split('@')[0];
        // Sanitize email prefix the same way frontend does: only word chars, dots, hyphens
        const sanitizedPrefix = emailPrefix.replace(/[^\w.-]/g, '').toLowerCase();
        return sanitizedPrefix === mentionLower;
      }
      
      return false;
    });
    
    if (found) {
      userIds.add(found.id);
    }
  }
  
  return Array.from(userIds);
}
```

**Что исправлено**:
1. ✅ Применяется та же санация, что и на фронтенде: `/[^\w.-]/g`
2. ✅ Используется точное сопоставление вместо `startsWith`
3. ✅ Гарантирует работу с любыми email (даже со специальными символами)

## 🧪 Тестовые случаи

### Тест 1: Обычный email
- Email: `john.doe@example.com`
- Упоминание: `@john.doe`
- Frontend генерирует: `john.doe` (без изменений)
- Backend сопоставляет: `john.doe` === `john.doe` ✅

### Тест 2: Email с символом `+`
- Email: `jane+test@example.com`
- Упоминание: `@janetest`
- Frontend генерирует: `jane+test` → `janetest` (`+` удален)
- Backend сопоставляет: `janetest` === `janetest` ✅

### Тест 3: Email с символом `_`
- Email: `bob_wilson@example.com`
- Упоминание: `@bob_wilson`
- Frontend генерирует: `bob_wilson` (без изменений, `_` - это word character)
- Backend сопоставляет: `bob_wilson` === `bob_wilson` ✅

### Тест 4: Сопоставление по имени
- Имя: `Jane Smith`
- Упоминание: `@jane`
- Backend сопоставляет: `"jane smith".includes("jane")` ✅

## 📋 Полный поток работы

1. **Пользователь вводит `@j` в поле комментария**
   - `handleCommentTextChange` обнаруживает `@j`
   - Устанавливает `showMentionAutocomplete = true`
   - Устанавливает `mentionQuery = "j"`

2. **Автокомплит отображается**
   - Рендерится через Portal в `document.body`
   - Позиция рассчитывается относительно textarea
   - Фильтрует пользователей по запросу `"j"`
   - Обновляет позицию при прокрутке/изменении размера

3. **Пользователь выбирает "John Doe (john.doe@example.com)"**
   - Клик мыши или нажатие Enter
   - `handleMentionSelect` вызывается
   - `getUsernameForMention` → `"john.doe"`
   - Вставляет `@john.doe` в текст
   - Закрывает автокомплит

4. **Пользователь отправляет комментарий**
   - Frontend: `extractMentionedUsers` извлекает ID пользователей
   - Отправляет комментарий с `mentionedUsers` (игнорируется бэкендом)

5. **Backend обрабатывает комментарий**
   - `extractMentions` извлекает `["john.doe"]` из текста
   - `getUsersByMentions` находит пользователя с email `john.doe@example.com`
   - Применяет санацию: `"john.doe"` === `"john.doe"` ✅
   - Сохраняет комментарий с упомянутыми пользователями

## 🎯 Результат

После исправлений:
- ✅ Позиция автокомплита корректно обновляется при любых действиях
- ✅ Пользователи корректно упоминаются и сохраняются
- ✅ Механизм работает для всех email (включая специальные символы)
- ✅ Сборка проходит без ошибок
- ✅ TypeScript типизация корректна

## 📝 Файлы изменены

1. `src/components/mention-autocomplete.tsx` - Исправлена логика обновления позиции
2. `src/lib/mentions.ts` - Исправлена логика сопоставления пользователей

## 🚀 Для тестирования

1. Запустите dev сервер: `npm run dev:all`
2. Откройте задачу в проекте
3. Перейдите на вкладку "Комментарии"
4. Введите `@` в поле комментария
5. Проверьте:
   - Автокомплит появляется ниже текстового поля
   - Позиция обновляется при прокрутке диалога
   - Можно выбрать пользователя мышью
   - Можно выбрать пользователя клавиатурой (Enter)
   - Упоминание вставляется в текст
   - Комментарий сохраняется с упоминаниями
