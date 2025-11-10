# Инструкция по миграции базы данных для orderKey

## Обзор

Эта миграция добавляет два новых поля в таблицу `tasks`:
- `orderKey` - для стабильного упорядочивания задач
- `version` - для отслеживания версий задач

## Применение миграции

### 1. В разработке (development)

```bash
# Применить миграцию к базе данных
npm run prisma:migrate

# Или напрямую через Prisma CLI
npx prisma migrate dev
```

### 2. В продакшене (production)

```bash
# Применить миграции без интерактивного режима
npx prisma migrate deploy
```

### 3. Вручную (если нужно)

Если у вас проблемы с автоматической миграцией, можно применить SQL вручную:

```sql
-- Добавляем orderKey с значением по умолчанию 'n'
ALTER TABLE "tasks" ADD COLUMN "orderKey" TEXT DEFAULT 'n';

-- Добавляем version с начальным значением 1
ALTER TABLE "tasks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Создаем индекс для быстрой сортировки
CREATE INDEX "tasks_status_orderKey_idx" ON "tasks"("status", "orderKey");
```

## Проверка миграции

После применения миграции проверьте структуру таблицы:

```sql
-- PostgreSQL
\d tasks

-- Или через SQL
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('orderKey', 'version');
```

Ожидаемый результат:
```
column_name | data_type | column_default
------------|-----------|---------------
orderKey    | text      | 'n'
version     | integer   | 1
```

## Обратная совместимость

✅ Существующие задачи:
- Автоматически получат `orderKey = 'n'`
- Автоматически получат `version = 1`
- Продолжат работать без изменений

✅ Новые задачи:
- Будут создаваться с начальными значениями
- orderKey будет вычисляться автоматически при перетаскивании

## Откат миграции (если нужно)

Если что-то пошло не так и нужно откатить изменения:

```sql
-- Удаляем индекс
DROP INDEX IF EXISTS "tasks_status_orderKey_idx";

-- Удаляем колонки
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "orderKey";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "version";
```

## Размер данных

Оценка влияния на размер БД:
- `orderKey` (TEXT): ~5-10 байт на задачу
- `version` (INTEGER): 4 байта на задачу
- Индекс: ~15-20 байт на задачу

Для 10,000 задач:
- Дополнительно: ~200-300 KB
- Практически не влияет на производительность

## FAQ

**Q: Нужно ли обновлять существующие данные?**
A: Нет, значения по умолчанию применятся автоматически.

**Q: Как быть с задачами в процессе миграции?**
A: Миграция выполняется в транзакции, никаких данных не потеряется.

**Q: Нужно ли останавливать приложение?**
A: Рекомендуется на время миграции, но не критично для небольших БД.

**Q: Что если миграция упадет с ошибкой?**
A: Prisma автоматически откатит изменения. Проверьте логи и попробуйте снова.

## Мониторинг после миграции

Проверьте, что все работает корректно:

```sql
-- Проверить, что у всех задач есть orderKey
SELECT COUNT(*) FROM tasks WHERE "orderKey" IS NULL;
-- Должно быть: 0

-- Проверить, что у всех задач есть version
SELECT COUNT(*) FROM tasks WHERE version IS NULL;
-- Должно быть: 0

-- Проверить распределение orderKey
SELECT status, COUNT(*), MIN("orderKey"), MAX("orderKey")
FROM tasks
GROUP BY status;
```

## Поддержка

Если возникли проблемы:
1. Проверьте логи Prisma
2. Убедитесь, что DATABASE_URL настроен правильно
3. Проверьте права доступа к базе данных
4. Обратитесь к документации KANBAN_DND_OPTIMIZATION.md
