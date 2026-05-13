module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      'https://mippjtmsrvjxyccmvpzl.supabase.co',
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcHBqdG1zcnZqeHljY212cHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxOTk1MDcsImV4cCI6MjA5Mzc3MzUwN30.kgvaK7NlhlRgAkpfNFsrd4yohR1rYgRHT8o5wQCeEtA',
    claudeApiKey: process.env.EXPO_PUBLIC_CLAUDE_API_KEY,
  },
});
