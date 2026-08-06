# Current State — Vera App

## Última actualización
2026-05-28 (sesión 14)

---

## Features completados ✅

- Auth completo (login, registro, logout, persistencia de sesión con AsyncStorage)
- CRUD de personas y deudas contra Supabase con patrón optimista + revert
- Caché offline Nivel 1 — lectura desde AsyncStorage cuando no hay red
- Toast de error diferenciado: offline (ámbar) vs error real (rojo)
- Multi-moneda completo: ARS, USD, UYU, BRL en toda la app
- Filtro por período (total / este mes / otro mes) en Home e HistoryScreen
- Dark/light mode persistido
- Animaciones de entrada/salida en PersonCard y deudas
- Recordatorio por WhatsApp con mensaje pre-armado y cálculo de neto
- Registro de deuda por voz: grabación → transcripción → interpretación Claude API → modal de confirmación
- BarChart de resumen visual por persona
- Feed de últimos 3 movimientos en Home
- Splash animado con logo Vera
- Dependencia circular CostosContext ↔ Toast resuelta — Toast vive en App.tsx
- Todos los console.log eliminados — proyecto limpio para producción
- **Editar deuda** — toque largo en cualquier deuda abre AddDebtModal en modo edición
- **Swipe en deudas** — deslizar a la izquierda revela botones Editar y Eliminar inline
- **Sistema de documentación viva** — CLAUDE.md, docs/current-state.md, docs/known-bugs.md establecidos
- **Proyecto en GitHub** — código fuente completo subido al repositorio
- **Proyecto en Claude.ai** — configurado como Proyecto "Vera App" con contexto persistente
- **EAS Build configurado** — perfil `preview` con environment variables en eas.json
- **app.config.js** — creado para inyectar variables de entorno en builds EAS (supabaseUrl, supabaseAnonKey, claudeApiKey)
- **expo-constants** — instalado y configurado para acceder a `Constants.expoConfig.extra` en runtime
- **BUG-005 resuelto** — fallback hardcodeado correcto en app.config.js, variable actualizada en EAS Cloud. Pendiente confirmar con APK el 1 de junio (debug visual en LoginScreen.tsx queda hasta entonces)
- **Ojito mostrar/ocultar contraseña** — en login y registro (campo password con toggle "Ver"/"Ocultar")
- **Campo confirmación de contraseña** — en modo registro con validación de coincidencia antes de enviar
- **Fecha de vencimiento en deudas** — dueDate opcional en modelo Debt, picker visual con año/mes/día (DueDatePickerModal), indicador en card (rojo vencido / naranja próximo / gris normal), columna due_date agregada en Supabase
- **Botones de swipe mejorados** — integrados visualmente a la card con borderRadius y mismo alto
- **Foto de perfil por persona** ✅ — upload a Supabase Storage, cache-busting con ?t=timestamp, stale closure corregido en updatePersonAvatar, race condition en useEffect de carga inicial resuelto con merge optimista
- **Swipe en PersonCard** — deslizar persona a la izquierda revela Editar y Eliminar; misma integración visual que deudas (marginLeft: -12 en swipeActions)
- **Editar persona desde HomeScreen** — botón Editar en swipe abre AddPersonModal en modo edición con valores pre-cargados
- **Eliminar persona desde HomeScreen** — botón Eliminar en swipe muestra ConfirmModal antes de borrar
- **Crash al eliminar persona desde PersonDetailScreen resuelto** — hooks movidos antes del early return para cumplir reglas de React hooks
- **DueDatePickerModal mejorado** — años en ScrollView horizontal deslizable (15 años, scroll automático al año seleccionado), etiquetas de sección "AÑO / MES / DÍA"
- **Sección VENCIMIENTOS en HomeScreen** — aparece solo cuando hay deudas próximas a vencer (≤7 días) o vencidas; colores por urgencia: rojo (vencida/hoy), naranja (1-3d), amarillo (#FBBF24, 4-7d); avatar con foto real si existe; tappable → navega a PersonDetail
- **Búsqueda de personas y deudas** — lupa en header, filtra personas por nombre y deudas pendientes por descripción en tiempo real; resultados muestran foto real de la persona; tapping navega a PersonDetail y cierra búsqueda
- **Notas y foto en deudas** — campo `notes` (texto libre, 300 chars) y `photoUrl` en modelo Debt; upload a Supabase Storage (bucket avatars, ruta debts/{userId}/{debtId}.jpg); AddDebtModal muestra picker de foto y preview; deuda card muestra notas en itálica y thumbnail 48×48 tappable
- **Visor de fotos a pantalla completa** — PhotoViewerModal con GestureHandlerRootView dentro del Modal (fix para que RNGH reciba gestos); zoom pinch preciso con delta frame-a-frame (`ds = gs / prevGestureScale`); pan con un dedo cuando está zoomada; botón X con borde rojo semitransparente; disponible desde PersonDetailScreen y AddDebtModal
- **Tab bar de navegación** — Bottom Tab Navigator con 4 tabs: Deudas (HomeScreen), Estadísticas (StatisticsScreen), Finanzas (placeholder "Próximamente"), Ajustes (SettingsScreen); iconos SVG propios en TabIcons.tsx; rojo #F05B53 activo, gris inactivo; PersonDetail/History/Movements siguen en Stack encima de los tabs
- **StatisticsScreen** — balance pendiente por moneda, gráfico de barras últimos 6 meses, top 5 personas tapeables (navegan a PersonDetail), botón "Más detalles →"
- **ChartDetailScreen** — selector de año por chips (solo años con datos + año actual); totales del año (Me deben / Le debo / Neto); gráfico de 12 meses; desglose mensual compacto con accordion: tocar un mes despliega panel con cada deuda (persona, descripción, monto, estado)
- **Comparación mensual en StatisticsScreen** — línea de insight dentro de la card del gráfico (entre las barras y "Más detalles →") que muestra el % de cambio del balance ARS respecto al mes anterior; verde si positivo, rojo si negativo
- **Ícono de búsqueda agrandado** — lupa en HomeScreen header pasó de fontSize 22 a 26 para mejor visibilidad
- **`effectiveAmount` propagado a toda la app** — SummaryCard (`computeStats`), StatisticsScreen (balance y top personas), HomeScreen (vencimientos y resultados de búsqueda), MovementsScreen (tab Agregadas) muestran el monto restante real en lugar del total bruto de deudas con pago parcial
- **MovementsScreen rediseñado** — nuevo tab "Todos" como default (todos los eventos cronológicos: alta, pago parcial, saldado), tab "Parciales" con indicador ámbar y badge "💰 pago parcial", tipo `UnifiedEvent`; el tab anterior "Agregadas" muestra `effectiveAmount` + "de $X" en deudas parciales
- **Picker de año deslizable** — tanto en SummaryCard como en HistoryScreen, el selector de periodo ahora usa `FlatList` horizontal con `scrollToIndex({ viewPosition: 0.5 })` para centrar el año seleccionado automáticamente; rango 2023 → año actual + 2, se expande +1 por año automáticamente
- **ShareStatsModal** — nuevo modal que captura una imagen de marca Vera (dark card con logo, balance por moneda, stats, top 3 personas, footer) usando `react-native-view-shot` y la comparte via `expo-sharing`; accesible desde botón `↑` en header de StatisticsScreen
- **ReminderImageModal** — nuevo modal de 2 pasos para enviar recordatorios visuales: paso 1 selección de deudas con checkboxes (toggle individual o todas), paso 2 preview de la `ReminderCard` branded (logo, avatar de persona, lista de deudas, neto por moneda, footer) y compartir via `expo-sharing`; reemplaza el recordatorio de texto plano por WhatsApp en PersonDetailScreen
- **Tap fuera cierra modales** — todos los modales y bottom sheets cierran al tocar el overlay oscuro: `StatusPickerModal`, `ConfirmModal`, `PartialPaymentModal`, `ShareStatsModal` (via `onStartShouldSetResponder`), `ReminderImageModal`, picker de SummaryCard, picker de HistoryScreen; patrón `TouchableWithoutFeedback` doble (externo captura, interno detiene propagación)
- **Historial tappable** — cada fila del HistoryScreen (deuda normal y pago parcial) navega a `PersonDetail` de la persona correspondiente al tocarla
- **Login con Google** — `@react-native-google-signin/google-signin` v16 con Google Play Services nativo (sin browser ni deep links); `GoogleSignin.configure({ webClientId })` → `signIn()` → `idToken` → `supabase.auth.signInWithIdToken`; `GoogleSignin.signOut()` integrado en signOut de Supabase; Google configurado como proveedor en Supabase Dashboard; cliente Android creado en Google Cloud Console con SHA-1 del debug keystore
- **Botón Google con logo oficial** — `GoogleIcon.tsx` SVG con los 4 colores reales del logo de Google (rojo/azul/amarillo/verde) reemplaza la "G" azul genérica en `LoginScreen`
- **Foto real en ShareStatsModal** — sección TOP PERSONAS muestra `Image` con `uri: person.avatarUrl` cuando existe; fallback al emoji/color; mismo patrón que StatisticsScreen
- **Play Store compliance** (sesión 12) — `app.json`: `userInterfaceStyle: "automatic"`, `versionCode: 1`, `targetSdkVersion: 34`; `LoginScreen`: validación email + contraseña, pantalla post-registro "Revisá tu email", bloque debug eliminado; `SettingsScreen`: Política de privacidad, Términos de uso, Eliminar cuenta (mailto)
- **PersonDetail delete bug resuelto** (sesión 12) — `confirmDeletePerson` ahora llama `deletePerson(personId)` antes de `navigation.goBack()`
- **Stale closures en CostosContext resueltas** (sesión 12) — todos los callbacks usan functional updater con snapshot para revert; dependencias correctas en `useCallback` (removido `persons`/`debts` de todos los deps)
- **PersonCard "Al día"** (sesión 12) — cuando `activeCount === 0` muestra "Al día" en lugar de "0 deudas activas"
- **HistoryScreen multi-moneda corregido** (sesión 12) — `periodTotalsByCurrency` (Map) agrupa por moneda; JSX y exportación nunca mezclan monedas
- **NotificationScheduler optimizado** (sesión 12) — hash de due dates para re-programar solo cuando cambia algo relevante; permisos pedidos solo al montar
- **Constante SUPABASE_URL** (sesión 12) — URL hardcodeada extraída a constante en CostosContext
- **supabase.ts doble fallback** (sesión 12) — fallback en punto de consumo + BUG-005 cerrado
- **PhotoViewerModal extraído** (sesión 12) — componente duplicado en AddDebtModal+PersonDetailScreen consolidado en `src/components/PhotoViewerModal.tsx`
- **FinanzasScreen unmount cleanup** (sesión 13) — useEffect de cleanup agrega `clearTimeout(deleteTimerRef.current)` al desmontar; previene setState en componente desmontado
- **HistoryScreen FlatList** (sesión 13) — ScrollView reemplazado por FlatList con datos aplanados (headers + events); `initialNumToRender=20`, `windowSize=10`; `renderItem` con `useCallback`; importación de `CURRENCY_NAMES` eliminada (no se usaba)
- **HomeSkeletonLoader** (sesión 13) — nuevo componente `src/components/SkeletonLoader.tsx` con animación shimmer; reemplaza `ActivityIndicator` en HomeScreen loading state; 4 PersonCard esqueleto + 1 SummaryCard esqueleto con colores adaptativos dark/light
- **useMemo masivo en HomeScreen** (sesión 13) — `personDebtsMap`, `chartData`, `filteredPersons`, `debtResults`, `recentActivities`, `urgentDebts`, `personMap` todos memoizados; evita recálculos innecesarios en cada render
- **useMemo personMap en HistoryScreen y MovementsScreen** (sesión 13) — `personMap` ahora memoizado con `[persons]` como dep en ambos screens
- **BUG TypeScript: `deletePerson` faltante en PersonDetailScreen** (sesión 13) — faltaba en la destructuración de `useCostos()` (línea 34); error TS2552 resuelto
- **notifications.ts TS error resuelto** (sesión 13) — `NotificationBehavior` requería `shouldShowBanner` y `shouldShowList`; campos añadidos al handler
- **HomeScreen navigation type** (sesión 13) — `Props` usa `CompositeScreenProps<BottomTabScreenProps, NativeStackScreenProps>` para que TypeScript acepte `navigation.navigate('PersonDetail')` desde pantalla de Tab; zero TS errors en todo el proyecto
- **StatusBar visible** (sesión 14) — `expo-status-bar` `StatusBar` en `App.tsx` con `style={isDark ? 'light' : 'dark'}`; batería/notificaciones visibles en toda la app
- **Freemium gate** (sesión 14) — `src/utils/pro.ts` con `IS_PRO_USER=false`, `FREE_PERSONS_LIMIT=5`, `FREE_DEBTS_LIMIT=20`; wrapper `openAddPerson()`, `openAddDebt()`, `openVoice()` en HomeScreen y PersonDetailScreen; cuando se alcanza el límite (o se toca el mic) abre `ProUpgradeModal`
- **ProUpgradeModal** (sesión 14) — bottom sheet animado (slide-up + fade), wordmark "Vera" completo como PNG transparente con gradiente real (2148×1272, background despill + min/max filter por canal), chip PRO superpuesto en esquina superior derecha del logo; lista de 7 features con emojis originales + checkmarks; botón "Próximamente"; gateado por `reason: 'persons' | 'debts' | 'voice'`
- **scripts/process_wordmark.py y remove_bg.py** (sesión 14) — scripts Python para procesar el logo Vera: upscale 2x, detección HSV teal, corrección de bordes por canal (MinFilter R / MaxFilter G,B), alpha binario; produce `vera_wordmark_transparent.png` y `vera_v_transparent_1024px.png`

---

## Pendiente
Ver `docs/todo.md` para la lista completa y priorizada.

---

## Bugs conocidos 🐛

Ver `docs/known-bugs.md`

---

## Referencia de diseño
- **App de referencia: Monai** — analizada en sesión 11. Motion language: ease-out cubic, duraciones 250-420ms, count-up en números (firma visual principal), sin springs con rebote. Ver `docs/design-reference.md` para análisis completo + guía del Tab Finanzas.

---

## Decisiones técnicas recientes

- **Toast fuera de CostosContext:** `<Toast />` movido a `App.tsx` dentro de `<CostosProvider>` para romper dependencia circular que causaba que `extractMessage` e `isOfflineError` llegaran como `undefined`
- **extractMessage:** función que normaliza cualquier tipo de error (Error nativo, PostgrestError, string con prefijo "TypeError:") a un mensaje limpio
- **No migrar estado global:** mantener Context API, no Zustand ni Redux
- **Google OAuth vía Play Services, no browser:** Chrome Custom Tabs en Android moderno bloquea navegación a esquemas personalizados (`com.riselai.vera://`), haciendo el deep link return imposible. Solución: `@react-native-google-signin/google-signin` usa Google Play Services nativamente, sin browser ni redirects. El `idToken` se pasa directamente a `supabase.auth.signInWithIdToken`.

---

## Próxima sesión — continuar con

Ver `docs/todo.md`.
