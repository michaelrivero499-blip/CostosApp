// La URL y la publishable key de Supabase ya no se inyectan por acá: viven
// hardcodeadas en src/services/supabase.ts, que es donde corresponde para una
// key pública. Eso elimina la dependencia de variables de entorno de EAS que
// causaba BUG-005 ("Invalid API key" en el APK preview).
//
// La API key de Claude sí es un secreto real y sigue viniendo del entorno.
// TODO (Fase 1): moverla a una Edge Function. Hoy viaja dentro del APK y
// cualquiera puede extraerla con un proxy.

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    claudeApiKey: process.env.EXPO_PUBLIC_CLAUDE_API_KEY,
  },
});
