# Design Reference — Vera App

## Última actualización
2026-05-16 (sesión 11)

---

## App de referencia: Monai

**Links:**
- Web: https://get-monai.app/?lang=es
- Play Store: https://play.google.com/store/apps/details?id=app.getmonai.android

**Descripción:** App de finanzas personales minimalista. Registro de gastos/ingresos por voz y manual, con categorías, presupuesto mensual y dashboard limpio. Sin bloat, sin formularios complejos.

---

## Motion design de Monai (aplicar en toda Vera)

### Principios
1. **Confianza, no entretenimiento** — las animaciones sirven para orientar al usuario, no para divertirlo
2. **Ease-out puro** — `Easing.out(Easing.cubic)` como curva estándar. Sin springs con rebote visible
3. **Duraciones cortas** — 250-420ms para entradas. 520ms máximo para count-up de números
4. **FAB con overshoot controlado** — `Easing.out(Easing.back(1.4))` en 260ms. No spring de friction baja

### Patrones implementados en Vera
| Elemento | Animación | Duración | Curva |
|---|---|---|---|
| Header al entrar | opacity + translateY(-12→0) | 250ms | ease-out cubic |
| Profile card | opacity + translateY(18→0) + scale(0.97→1) | 320ms | ease-out cubic |
| Filas de lista | opacity + translateY(14→0), stagger 55ms | 280ms | ease-out cubic |
| FAB / botones flotantes | scale(0→1) | 260ms | ease-out back(1.4) |
| Barras de gráfico | height(0→target) | 420ms | ease-out cubic |
| Secciones (Statistics) | opacity + translateY(18→0), stagger 90ms | 320ms | ease-out cubic |
| **Count-up de números** | valor animado 0→target | 520ms | ease-out cubic |

### La firma visual — Count-up
**La animación más importante de Monai.** Los balances y totales nunca "aparecen" — siempre cuentan desde 0 hasta el valor real.
Implementado en Vera via `CountUpAmount` (componente local en `PersonDetailScreen.tsx` y `StatisticsScreen.tsx`).

```typescript
// Patrón estándar
const anim = useRef(new Animated.Value(0)).current;
const [disp, setDisp] = useState(0);
useEffect(() => {
  const id = anim.addListener(({ value: v }) => setDisp(v));
  Animated.timing(anim, {
    toValue: targetValue, duration: 520,
    easing: Easing.out(Easing.cubic), useNativeDriver: false,
  }).start();
  return () => anim.removeListener(id);
}, [targetValue]);
```

---

## Tab Finanzas — referencia Monai

### Qué hace Monai en su pantalla principal de finanzas
- **Dashboard limpio** con balance del mes actual (ingresos - gastos = neto)
- **Barra de progreso de presupuesto** por categoría — pill-shaped, color por % usado (verde→naranja→rojo)
- **Lista de transacciones recientes** — cada ítem tiene ícono de categoría + descripción + monto + fecha
- **Selector de período** — mes actual por defecto, deslizable a meses anteriores
- **Sin tabs dentro de la pantalla** — todo en un solo scroll limpio
- **Entrada rápida** — FAB con "+" que abre un sheet minimalista (monto → categoría → descripción opcional)

### Categorías de Monai (referencia para Vera)
Ingresos: Sueldo, Freelance, Inversiones, Otros
Gastos: Comida, Transporte, Entretenimiento, Salud, Hogar, Ropa, Educación, Otros

### Cómo se ven las transacciones (Monai style)
```
[🍕]  Almuerzo                    -$1.200
      Comida · 15 may              ← fecha y categoría
```

### UX importante de Monai
- El balance del mes muestra signo + color (verde positivo / rojo negativo)
- Las barras de presupuesto aparecen con animación de fill (igual que las barras del gráfico en Vera)
- Swipe left en transacción → eliminar (igual que ya hace Vera en deudas)
- La pantalla usa el mismo card style con borderRadius 16 y elevation sutil

### Lo que NO tiene Monai (no agregar a Vera)
- No tiene exportación a Excel/CSV
- No conecta con cuentas bancarias
- No tiene gráficos de torta ni complejos
- No tiene multi-moneda en la sección de gastos (trabaja en moneda local)

---

## Otras referencias visuales

### Colores por categoría (sugerencia para Vera Finanzas)
| Categoría | Color |
|---|---|
| Comida | #FF9500 |
| Transporte | #007AFF |
| Entretenimiento | #AF52DE |
| Salud | #34C759 |
| Hogar | #5AC8FA |
| Sueldo / Ingresos | #34C759 |
| Otros | #8E8E93 |

### Iconos por categoría (emojis, sin librerías externas)
Comida 🍽️ · Transporte 🚌 · Entretenimiento 🎮 · Salud 💊 · Hogar 🏠 · Ropa 👕 · Educación 📚 · Sueldo 💼 · Freelance 💻 · Otros 📦
