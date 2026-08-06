// ── Vera Pro — configuración de límites y estado ─────────────────────────────
//
// Fuente de verdad única.
// - APK beta: EXPO_PUBLIC_IS_PRO=true en el perfil "apk" de eas.json
// - Play Store gratis: EXPO_PUBLIC_IS_PRO no definido → false
// - TODO: reemplazar con RevenueCat.getCustomerInfo() cuando se integre billing.

export const FREE_PERSONS_LIMIT = 5;   // máx personas en versión gratis
export const FREE_DEBTS_LIMIT   = 20;  // máx deudas activas en versión gratis

/**
 * ¿El usuario actual tiene Vera Pro?
 * En el build APK beta se inyecta EXPO_PUBLIC_IS_PRO=true via eas.json.
 * En producción Play Store queda false hasta integrar RevenueCat.
 */
export const IS_PRO_USER = process.env.EXPO_PUBLIC_IS_PRO === 'true';
