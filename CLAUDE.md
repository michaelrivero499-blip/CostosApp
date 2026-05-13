# CLAUDE.md — Vera App

## ¿Qué es Vera?

Vera es una app mobile-first de gestión de deudas personales con IA. Permite registrar quién te debe y a quién le debés, con soporte multi-moneda, entrada por voz, sincronización en la nube y caché offline.

El nombre del proyecto en disco es `CostosApp` (nombre original) pero la app se llama **Vera** y el bundle ID es `com.riselai.vera`.

---

## Filosofía del producto

- Simplicidad extrema — core actions en máximo 2 taps
- UX emocional y conversacional
- Velocidad visual — animaciones rápidas y suaves
- Minimalismo — evitar clutter y pantallas sobrecargadas
- **NO** convertir Vera en un ERP, sistema contable o app empresarial

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | React Native + Expo SDK 54 |
| Lenguaje | TypeScript |
| Estado global | Context API (CostosContext, AuthContext, ThemeContext) |
| Base de datos | Supabase (PostgreSQL, región São Paulo) |
| Auth | Supabase Auth (email + password) |
| Persistencia local | AsyncStorage (caché offline Nivel 1 — solo lectura) |
| Voz | expo-speech-recognition + Claude API |
| IA | Claude API — modelo `claude-sonnet-4-20250514` |
| Build | EAS Build |
| Navegación | React Navigation (Native Stack) |

---

## Supabase

- **URL:** `https://mippjtmsrvjxyccmvpzl.supabase.co`
- **Organización:** RiselAI
- **Región:** São Paulo
- **Tablas:** `persons`, `debts` — ambas con RLS habilitado y grants explícitos
- **API key:** guardada en `.env` como `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Claude API key:** guardada en `.env` como `EXPO_PUBLIC_CLAUDE_API_KEY`

---

## Estructura del proyecto

```
CostosApp/
├── src/
│   ├── components/
│   │   ├── AddDebtModal.tsx       # Modal agregar/editar deuda
│   │   ├── AddPersonModal.tsx     # Modal agregar persona
│   │   ├── AnimatedSplash.tsx     # Splash animado con logo Vera
│   │   ├── BarChart.tsx           # Gráfico de barras horizontal
│   │   ├── ConfirmModal.tsx       # Modal confirmación destructiva
│   │   ├── MicIcon.tsx            # Ícono SVG micrófono
│   │   ├── PersonCard.tsx         # Card persona con neto y animaciones
│   │   ├── SettingsIcon.tsx       # Ícono SVG ajustes
│   │   ├── StatusPickerModal.tsx  # Bottom sheet cambio estado deuda
│   │   ├── SummaryCard.tsx        # Resumen global con filtros
│   │   ├── Toast.tsx              # Toast propio (offline=ámbar, error=rojo)
│   │   └── VoiceDebtModal.tsx     # Modal registro de deuda por voz
│   ├── context/
│   │   ├── AuthContext.tsx        # Auth Supabase + persistencia sesión
│   │   ├── CostosContext.tsx      # Estado global persons/debts + CRUD
│   │   └── ThemeContext.tsx       # Dark/light mode persistido
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Pantalla principal
│   │   ├── HistoryScreen.tsx      # Historial filtrable por período/moneda
│   │   ├── LoginScreen.tsx        # Login/registro
│   │   ├── MovementsScreen.tsx    # Todos los movimientos (tabs Agregadas/Saldadas)
│   │   ├── PersonDetailScreen.tsx # Detalle persona + deudas
│   │   └── SettingsScreen.tsx     # Dark mode + cerrar sesión
│   ├── services/
│   │   ├── claude.ts              # interpretDebt() — Claude API para voz
│   │   └── supabase.ts            # Cliente singleton Supabase
│   ├── storage/
│   │   └── index.ts               # createStorage(userId) — caché AsyncStorage
│   ├── types/
│   │   └── index.ts               # Person, Debt, PeriodFilter, Currency, etc.
│   └── utils/
│       └── index.ts               # formatAmount, getNetByCurrency, generateUUID, etc.
├── assets/                        # Logo Vera (fondo #0A1128)
├── docs/
│   ├── current-state.md           # ← LEER SIEMPRE al iniciar sesión
│   └── known-bugs.md
├── App.tsx
├── app.json
└── CLAUDE.md                      # ← este archivo
```

---

## Modelos de datos

### Person
```typescript
{
  id: string         // UUID client-side
  name: string
  avatar: string     // emoji
  color: string      // hex, fondo del avatar
}
```

### Debt
```typescript
{
  id: string
  personId: string
  description: string
  amount: number
  status: 'pendiente' | 'pagado'
  direction: 'me_debe' | 'le_debo'
  date: string       // ISO timestamp creación
  paidDate?: string  // ISO timestamp, se setea al marcar pagado
  currency?: 'ARS' | 'USD' | 'UYU' | 'BRL'  // default ARS
}
```

---

## Reglas de negocio — NO romper

- `me_debe` = esa persona me debe a mí
- `le_debo` = yo le debo a esa persona
- Neto por persona = suma(me_debe) - suma(le_debo)
- Al marcar pagado: **NO eliminar**, solo cambiar `status` y setear `paidDate`
- El total global muestra solo deudas `pendiente`
- Multi-moneda: ARS, USD, UYU, BRL — los netos se calculan por moneda separado

---

## Patrones de código establecidos

### CRUD en CostosContext
Todas las mutaciones siguen el mismo patrón optimista:
```typescript
// 1. Actualizar estado local inmediatamente
setState(newValue);
// 2. Operación en Supabase
try {
  const { error } = await supabase.from('tabla').operation();
  if (error) throw error;
} catch (e) {
  setState(prev); // revertir
  showError('Mensaje amigable', extractMessage(e));
}
```

### Manejo de errores
- `extractMessage(e)` — normaliza cualquier error a string limpio
- `isOfflineError(msg)` — detecta errores de red
- `toastError(friendly, technical)` — decide tipo de toast (offline=ámbar / error=rojo)
- `showError(friendly, technical)` — setea `lastError` y `lastErrorType` en contexto
- Toast se renderiza en `App.tsx` dentro de `<CostosProvider>`

### Require cycle — IMPORTANTE
`Toast.tsx` NO debe importar de `CostosContext.tsx` directamente si `CostosContext.tsx` importa `Toast.tsx`. El `<Toast />` vive en `App.tsx` dentro de `<CostosProvider>` para evitar dependencia circular.

---

## Dispositivo de desarrollo

- Samsung Galaxy S23 Ultra (SM-S918B)
- Development build via USB/ADB (NO Expo Go)
- `JAVA_HOME` debe setearse cada sesión PowerShell:
  ```
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ```

---

## Convenciones

- Todo en TypeScript estricto
- Componentes funcionales con hooks
- PascalCase para componentes, camelCase para funciones/variables
- Archivos pequeños y legibles — evitar archivos >300 líneas
- No instalar librerías nuevas sin evaluar impacto en el build
- Mantener compatibilidad con Expo SDK 54

---

## Reglas para Claude Code

1. Leer `docs/current-state.md` al iniciar cada sesión
2. Leer archivos existentes antes de escribir código nuevo
3. Preferir editar sobre reescribir archivos completos
4. No reescribir lógica que ya funciona
5. Mantener el patrón optimista en todas las mutaciones
6. Al completar una feature, actualizar `docs/current-state.md`
7. Al encontrar un bug nuevo, agregarlo a `docs/known-bugs.md`
8. No agregar `console.log` — el proyecto está limpio para producción

---

## Assets

- Logo Vera: fondo `#0A1128` (azul oscuro)
- Archivos: `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`
- Backup del proyecto: `CostosApp_backup_v1.0`
