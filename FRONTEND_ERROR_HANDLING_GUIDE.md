# Руководство по обработке ошибок и загрузки во фронтенде

## Обзор

Это руководство описывает, как правильно обрабатывать состояния загрузки и ошибок во фронтенде приложения для предотвращения "белого экрана смерти" и улучшения пользовательского опыта.

## Архитектура обработки ошибок

### 1. ErrorBoundary (Границы ошибок)

Приложение использует компонент `ErrorBoundary` для перехвата критических ошибок React:

```tsx
// Уже реализовано в src/App.tsx
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

**Когда использовать:** ErrorBoundary уже обёрнут вокруг основных компонентов приложения. Не нужно добавлять дополнительные границы, если только вы не создаёте независимый модуль.

### 2. Компоненты для отображения состояний

#### LoadingSpinner

Используйте для отображения состояния загрузки:

```tsx
import { LoadingSpinner } from './ui/loading-spinner';

// Вариант 1: Полноэкранная загрузка (по умолчанию)
if (isLoading) {
  return <LoadingSpinner message="Загрузка проекта..." />;
}

// Вариант 2: Маленький спиннер в кнопке
<Button disabled={isLoading}>
  {isLoading && <LoadingSpinner size="small" center={false} />}
  Сохранить
</Button>

// Вариант 3: Крупный спиннер
<LoadingSpinner size="large" message="Обработка данных..." />
```

#### ErrorMessage

Используйте для отображения ошибок:

```tsx
import { ErrorMessage } from './ui/error-message';

// Вариант 1: Полноэкранная ошибка с возможностью повтора
if (isError) {
  return (
    <ErrorMessage
      title="Не удалось загрузить проект"
      message="Проверьте подключение к интернету и повторите попытку"
      onRetry={refetch}
      onBack={() => navigate('/projects')}
    />
  );
}

// Вариант 2: Предупреждение (не критичная ошибка)
<ErrorMessage
  type="warning"
  title="Частичная загрузка"
  message="Некоторые данные недоступны"
  fullPage={false}
/>

// Вариант 3: Критическая ошибка
<ErrorMessage
  type="critical"
  title="Критическая ошибка"
  message="Невозможно продолжить работу"
  onRetry={reload}
/>
```

## Паттерны для обработки ошибок

### Паттерн 1: Компонент с данными из контекста

```tsx
export function MyComponent() {
  const { data, isLoading, error } = useApp();

  // 1. Сначала проверяем загрузку
  if (isLoading) {
    return <LoadingSpinner message="Загрузка данных..." />;
  }

  // 2. Затем проверяем ошибки
  if (error) {
    return (
      <ErrorMessage
        message={error.message || 'Не удалось загрузить данные'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 3. Проверяем наличие необходимых данных
  if (!data || data.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Данные отсутствуют</p>
      </div>
    );
  }

  // 4. Рендерим компонент с данными
  return (
    <div>
      {data.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}
```

### Паттерн 2: Компонент с асинхронной операцией

```tsx
export function MyFormComponent() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.submitForm(data);
      toast.success('Данные сохранены');
      navigate('/success');
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить данные');
      toast.error('Ошибка сохранения');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <ErrorMessage
          type="error"
          message={error}
          fullPage={false}
          onRetry={() => setError(null)}
        />
      )}
      
      {/* Form fields */}
      
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoadingSpinner size="small" center={false} />
            Сохранение...
          </>
        ) : (
          'Сохранить'
        )}
      </Button>
    </form>
  );
}
```

### Паттерн 3: Компонент с зависимыми данными

```tsx
export function ProjectDetailView({ projectId }: Props) {
  const { projects, tasks, isLoading } = useApp();
  const project = projects.find(p => p.id === projectId);

  // 1. Общая загрузка
  if (isLoading) {
    return <LoadingSpinner message="Загрузка проекта..." />;
  }

  // 2. Проверка наличия проекта
  if (!project) {
    return (
      <ErrorMessage
        title="Проект не найден"
        message="Проект с указанным ID не существует или был удалён"
        onBack={() => navigate('/projects')}
      />
    );
  }

  // 3. Рендерим с данными
  return (
    <div>
      <h1>{project.name}</h1>
      {/* Rest of component */}
    </div>
  );
}
```

## Best Practices (Лучшие практики)

### ✅ DO (Делайте так)

1. **Всегда проверяйте состояние загрузки первым:**
   ```tsx
   if (isLoading) return <LoadingSpinner />;
   ```

2. **Предоставляйте возможность повторить операцию:**
   ```tsx
   <ErrorMessage onRetry={refetch} />
   ```

3. **Используйте понятные сообщения об ошибках:**
   ```tsx
   message="Не удалось загрузить список проектов. Проверьте подключение к интернету."
   ```

4. **Обрабатывайте отсутствие данных отдельно от ошибок:**
   ```tsx
   if (!data) return <EmptyState />;
   if (error) return <ErrorMessage />;
   ```

5. **Используйте toast для некритичных ошибок:**
   ```tsx
   toast.error('Не удалось сохранить изменения');
   ```

### ❌ DON'T (Не делайте так)

1. **Не игнорируйте состояния загрузки:**
   ```tsx
   // ❌ Плохо - может вызвать "белый экран"
   const { data } = useApp();
   return <div>{data.map(...)}</div>;
   ```

2. **Не используйте только console.log для ошибок:**
   ```tsx
   // ❌ Плохо - пользователь не увидит ошибку
   catch (error) {
     console.error(error);
   }
   ```

3. **Не показывайте технические детали пользователю:**
   ```tsx
   // ❌ Плохо
   <ErrorMessage message={error.stack} />
   
   // ✅ Хорошо
   <ErrorMessage message="Не удалось загрузить данные" />
   ```

4. **Не блокируйте всё приложение из-за некритичной ошибки:**
   ```tsx
   // ❌ Плохо - блокирует весь UI
   if (optionalDataError) return <ErrorMessage />;
   
   // ✅ Хорошо - показываем частичные данные
   <div>
     {optionalDataError && <AlertBanner />}
     <MainContent data={mainData} />
   </div>
   ```

## Контрольный список для новых компонентов

При создании нового компонента, убедитесь что:

- [ ] Добавлена обработка состояния `isLoading`
- [ ] Добавлена обработка ошибок
- [ ] Добавлена обработка отсутствия данных (empty state)
- [ ] Пользователь может повторить неудачную операцию
- [ ] Сообщения об ошибках понятны и на русском языке
- [ ] Критичные операции показывают индикатор загрузки
- [ ] Используются компоненты `LoadingSpinner` и `ErrorMessage`

## Примеры из существующих компонентов

### project-detail-view.tsx (Хороший пример)

```tsx
// ✅ Правильная обработка
if (isLoading) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">Загрузка проекта...</p>
      </div>
    </div>
  );
}

if (!project) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-gray-900 mb-2">Проект не найден</h2>
        <p className="text-gray-600 mb-4">Проект с таким ID не существует</p>
        {onBack && (
          <Button onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к списку
          </Button>
        )}
      </div>
    </div>
  );
}
```

## Заключение

Следуя этим паттернам и best practices, вы обеспечите:
- Отсутствие "белых экранов смерти"
- Лучший UX при ошибках и загрузке
- Консистентность в обработке ошибок по всему приложению
- Возможность пользователю восстановиться после ошибки
