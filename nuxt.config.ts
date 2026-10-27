// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@vercel/analytics'],
  extends: ['github:rhyden153/neogames-ui'],
  runtimeConfig: {
    leaderboard: { redisUrlEnv: 'DEMON_SCORES_REDIS_URL' },
    public: { leaderboard: { game: 'demon-hunter' } },
  },
})
