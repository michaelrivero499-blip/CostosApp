# Current State — Vera App

## Última actualización
2026-05-12

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
- **Editar deuda** — EN PROGRESO (interrumpido por límite de Claude Code)

---

## En progreso 🔄

### Editar deuda existente
**Estado:** Claude Code había comenzado la implementación. Completó:
- Análisis del approach (reusar AddDebtModal con prop `initialValues`)
- Inicio de cambios en PersonDetailScreen.tsx (import DebtDirection agregado)

**Falta completar:**
1. `AddDebtModal.tsx` — agregar prop opcional `initialValues?: { description, amount, direction, currency }`. useEffect([visible]) para seedear estado. Título/botón dinámicos: "Editar deuda"/"Guardar" vs "Nueva deuda"/"Agregar"
2. `CostosContext.tsx` — agregar función `updateDebt(debtId, description, amount, direction, currency)` con patrón optimista igual a las otras mutaciones
3. `PersonDetailScreen.tsx` — estado `editTarget: Debt | null`. Toque largo en deuda → `setEditTarget(debt)`. Modal en modo edición con `onSave={handleEditDebt}` que llama `updateDebt`

---

## Pendiente — Alta prioridad (antes de Play Store) 📋

1. ~~Limpiar console.log~~ ✅
2. **Editar deuda** — continuar implementación
3. **Fecha de vencimiento en deudas** — agregar campo `dueDate` al modelo Debt, campo en AddDebtModal, indicador visual en PersonDetailScreen
4. **Foto de perfil por persona** — extender modelo Person para soportar imagen real además del emoji/color actual
5. **Búsqueda de personas y deudas** — barra de búsqueda en HomeScreen
6. **Notificaciones push** — recordatorios de deudas vencidas o próximas a vencer

---

## Pendiente — Media prioridad (post lanzamiento) 📋

7. Escritura offline completa — cola de operaciones pendientes para sincronizar al volver la conexión
8. Notas y fotos en deudas — adjuntar comprobante
9. Deudas recurrentes — generación automática mensual
10. Estadísticas históricas
11. Widget en pantalla de inicio

---

## Bugs conocidos 🐛

Ver `docs/known-bugs.md`

---

## Decisiones técnicas recientes

- **Toast fuera de CostosContext:** `<Toast />` movido a `App.tsx` dentro de `<CostosProvider>` para romper dependencia circular que causaba que `extractMessage` e `isOfflineError` llegaran como `undefined`
- **extractMessage:** función que normaliza cualquier tipo de error (Error nativo, PostgrestError, string con prefijo "TypeError:") a un mensaje limpio
- **No migrar estado global:** mantener Context API, no Zustand ni Redux

---

## Próxima sesión — continuar con

Editar deuda existente (retomar implementación interrumpida).
Prompt para Claude Code:

> Continuá la implementación de editar deuda. El approach aprobado es reusar AddDebtModal con prop opcional initialValues. Falta: (1) modificar AddDebtModal.tsx para aceptar initialValues y mostrar título/botón dinámicos, (2) agregar updateDebt() en CostosContext.tsx con patrón optimista, (3) completar PersonDetailScreen.tsx con editTarget state y toque largo para abrir modal en modo edición.
