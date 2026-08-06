# Todo — Vera App

## Última actualización
2026-05-28 (sesión 14)

---

## Lista de prioridades (mayor → menor)

### 1. BUG-005 — Verificar APK preview el 1 de junio 🔴
Generar el APK con `eas build --profile preview` y confirmar que `supabaseAnonKey` no llega `undefined` en runtime. Doble fallback implementado en `app.config.js` y `src/services/supabase.ts`. El development build funciona correctamente.

---

### 2. Seguridad — Claude API key expuesta en cliente 🔴
La función `interpretDebt()` y `interpretTransaction()` en `src/services/claude.ts` llaman directamente a `https://api.anthropic.com/v1/messages` con la API key en el header. Cualquier usuario con herramientas de proxy puede ver la key.

**Fix recomendado:** Crear una Supabase Edge Function (`supabase/functions/interpret-debt/index.ts`) que reciba el transcript y devuelva el JSON interpretado. El cliente llama a `supabase.functions.invoke('interpret-debt', { body: { transcript } })` en lugar de llamar a Anthropic directamente. La API key vive solo en las environment variables de la Edge Function.

---

### 3. Contenido del Tab Finanzas ✅ (sesión 11)
`FinanzasScreen.tsx` completamente implementado: balance del mes con count-up animation, lista de transacciones con categoría + ícono emoji, barras de presupuesto animadas, selector de período deslizable, FAB "+", swipe para eliminar con undo de 4s, registro por voz (`interpretTransaction`). Tabla `transactions` en Supabase. **Todo.md estaba desactualizado en este punto.**

---


### 4. Páginas web Política de privacidad y Términos de uso 🟡
Publicar contenido real en `https://riselai.com/vera/privacy` y `https://riselai.com/vera/terms`. Las URLs ya están hardcodeadas en `SettingsScreen.tsx` con `Linking.openURL`. Opciones: página propia en riselai.com, Notion público, Google Docs publicado, o Termly. Una vez publicadas, no requiere cambios en el código.

---

### 6. Deudas recurrentes 🔵
Marcar una deuda como "se repite cada mes" y que se genere automáticamente el día X. Requiere nuevo campo `isRecurring` + `recurDay` en el modelo `Debt`, migración en Supabase, y lógica de generación al abrir la app.

---

### 7. Calculadora de split 🔵
Pantalla nueva: ingresar un monto total, seleccionar N personas, y generar las deudas divididas de forma equitativa (o personalizada por persona). Útil para cenas, viajes grupales, etc.

---

### 8. Widget en pantalla de inicio 🔵
Mostrar el balance total sin abrir la app. Requiere módulo nativo o Expo Widgets (experimental). Para después del lanzamiento en Play Store.

---


## ✅ Completado (sesiones 1–13)

**Sesión 13:**
- **FinanzasScreen unmount cleanup** — `clearTimeout(deleteTimerRef.current)` en useEffect de retorno, previene setState en componente desmontado
- **HistoryScreen virtualización** — ScrollView → FlatList con estructura aplanada de items (headers + events), `initialNumToRender=20`, `windowSize=10`, `renderItem` con `useCallback`
- **HomeSkeletonLoader** — nuevo `SkeletonLoader.tsx` con animación shimmer; reemplaza ActivityIndicator en HomeScreen loading state
- **useMemo masivo en HomeScreen** — `personDebtsMap`, `chartData`, `filteredPersons`, `debtResults`, `recentActivities`, `urgentDebts`, `personMap` todos memoizados
- **personMap memoizado** en HistoryScreen y MovementsScreen
- **`deletePerson` faltante en PersonDetailScreen** — añadido a destructuración de `useCostos()`; el bug de crash al eliminar persona estaba silenciosamente presente
- **Zero errores TypeScript en todo el proyecto** — `notifications.ts` completado con `shouldShowBanner`/`shouldShowList`; `HomeScreen` usa `CompositeScreenProps` para navegación Tab→Stack sin errores de tipo

**Sesión 12 (Play Store compliance):**
- CostosContext stale closures resueltas, PersonCard "Al día", HistoryScreen multi-moneda corregido, NotificationScheduler optimizado, SUPABASE_URL constante, BUG-005 fallback en supabase.ts, PhotoViewerModal extraído, SummaryCard type safety, docs actualizados



- **Animación ChartDetailScreen** — barras con `Easing.out(Easing.cubic)` 420ms, reset al cambiar de año; count-up en totales (Me deben / Le debo / Neto) con `CountUpText`; secciones con stagger 80ms ease-out en entrada
- **Onboarding** — bottom sheet de bienvenida con 3 puntos simples (qué es Vera, registro por voz, recordatorios+stats); se muestra una sola vez al hacer login; flag `@vera_onboarding_done` en AsyncStorage. Sistema de hints contextuales: `useHint(key)` hook + `HintCard` component; 3 hints activos: swipe en HomeScreen, me debe/le debo en PersonDetail, detalles del gráfico en Statistics; cada hint aparece una sola vez y se descarta con ✕
- **Filtro de moneda en StatisticsScreen** — chips ARS/USD/UYU/BRL en la leyenda del gráfico; `monthlyData` y `monthComparison` reactivos a `chartCurrency`; barras se resetean y reaniman al cambiar; label y texto de comparación dinámicos

- Migraciones SQL Supabase — `paid_amount numeric` y `partial_payment_date text` en tabla `debts`
- Rebuild con `react-native-view-shot` — `ShareStatsModal` y `ReminderImageModal` funcionando en dispositivo
- Auth completo (login, registro, logout, persistencia de sesión)
- CRUD personas y deudas contra Supabase + patrón optimista + revert
- Caché offline Nivel 1 — lectura desde AsyncStorage cuando no hay red
- Escritura offline completa — `offlineQueue.ts` con cola de operaciones; `syncQueue` en CostosContext; banner "X cambios pendientes de sincronizar" en HomeScreen
- Toast diferenciado: offline (ámbar) vs error real (rojo)
- Multi-moneda: ARS, USD, UYU, BRL en toda la app
- Dark/light mode persistido
- Animaciones de entrada/salida en cards y deudas
- Registro de deuda por voz (Claude API + expo-speech-recognition)
- Edición de deudas (toque largo o swipe → Editar)
- Swipe en deudas (Editar / Eliminar)
- Swipe en personas (Editar / Eliminar)
- Fecha de vencimiento con picker visual (DueDatePickerModal, año deslizable)
- Foto de perfil por persona (Supabase Storage + cache-busting)
- Búsqueda en tiempo real de personas y deudas (SearchIcon SVG custom)
- Notas y fotos adjuntas en deudas (Storage, thumbnail, visor fullscreen con zoom pinch)
- Bottom tab navigator (Deudas / Estadísticas / Finanzas / Ajustes)
- StatisticsScreen: balance por moneda, gráfico mensual, top personas con foto real, comparación % vs mes anterior
- ChartDetailScreen: selector de año, totales, desglose mensual accordion; cada deuda navega a PersonDetail
- Pagos parciales (PartialPaymentModal, paidAmount, partialPaymentDate)
- effectiveAmount propagado a toda la app (SummaryCard, Stats, Home vencimientos y búsqueda, Movements, History)
- MovementsScreen con 4 tabs: Todos / Agregadas / Saldadas / Parciales
- Picker de año deslizable con FlatList y scroll centrado en SummaryCard e HistoryScreen
- Ordenamiento de personas: por nombre A-Z, por monto adeudado, por última actividad
- Notificaciones push: `notifications.ts` con permisos, canal Android, schedule por vencimiento (vencida / mañana / en 3 días)
- ShareStatsModal: imagen de marca compartible con ViewShot + expo-sharing
- ReminderImageModal: recordatorio visual 2 pasos (seleccionar deudas → preview + compartir)
- Tap fuera cierra todos los modales y bottom sheets
- HistoryScreen: cada fila navega a PersonDetail al tocarla
- **Login con Google** — Google Play Services nativo via `@react-native-google-signin/google-signin` v16; `idToken` → `supabase.auth.signInWithIdToken`; sin browser ni deep links
- **Botón Google con logo oficial** — `GoogleIcon.tsx` SVG multicolor (rojo/azul/amarillo/verde)
- **Foto real en ShareStatsModal** — `personDot` reemplazado por `Image` con `uri: person.avatarUrl` cuando existe; fallback al emoji/color
