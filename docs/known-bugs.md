# Known Bugs — Vera App

## Formato
Cada bug incluye: descripción, estado, y contexto para reproducirlo.

---

## Bugs activos

### BUG-001 — Toast muestra error crudo en development build
**Estado:** Resuelto en producción, visible solo en dev  
**Descripción:** En development build, al arrancar la app sin conexión aparece un toast rojo con "TypeError: Network request failed" en lugar del mensaje personalizado "Sin conexión a internet. Mostrando datos guardados."  
**Causa:** El overlay de error del development build de React Native/Expo se superpone sobre el Toast component. En producción este overlay no existe.  
**Impacto:** Solo afecta al desarrollador durante testing. Usuarios finales ven el mensaje correcto.  
**Workaround:** Ignorar en dev build. Verificado que en producción funciona correctamente.

---

### BUG-002 — handleAddDebt tiene tipo DebtStatus | any en la firma
**Estado:** Pendiente  
**Descripción:** En PersonDetailScreen.tsx, la función `handleAddDebt` tiene el tipo `DebtStatus | any` en lugar del tipo correcto `DebtDirection`.  
**Impacto:** Bajo — no causa errores en runtime pero es un type safety issue.  
**Fix:** Cambiar la firma para usar `DebtDirection` correctamente.

---

## Bugs resueltos

### BUG-003 — Dependencia circular CostosContext ↔ Toast ✅
**Resuelto:** 2026-05-12  
**Descripción:** `CostosContext.tsx` importaba `Toast` y `Toast.tsx` importaba `useCostos` de `CostosContext`. Metro bundler resolvía el ciclo con módulos parcialmente inicializados, causando que `extractMessage` e `isOfflineError` llegaran como `undefined` en runtime.  
**Fix:** Mover `<Toast />` a `App.tsx` dentro de `<CostosProvider>`, eliminando el import de Toast en CostosContext.

### BUG-004 — isOfflineError no interceptaba errores de red ✅
**Resuelto:** 2026-05-12  
**Descripción:** El toast mostraba "TypeError: Network request failed" crudo en lugar del mensaje personalizado. La función `isOfflineError` recibía el error técnico pero `extractMessage` fallaba porque `e instanceof Error` era `false` para errores de Supabase, causando que `String(e)` produjera el string con prefijo "TypeError:".  
**Fix:** Mejorar `extractMessage` para usar `lastIndexOf(':')` como fallback y extraer solo la parte posterior al prefijo de tipo.
