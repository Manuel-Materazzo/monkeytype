import { Configuration } from "@monkeytype/schemas/configuration";

const config: Configuration | undefined = {
  maintenance: false,
  dev: { responseSlowdownMs: 0 },
  quotes: {
    reporting: { enabled: false, maxReports: 0, contentReportLimit: 0 },
    submissionsEnabled: false,
    maxFavorites: 100,
  },
  results: {
    savingEnabled: true,
    objectHashCheckEnabled: false,
    filterPresets: { enabled: true, maxPresetsPerUser: 10 },
    limits: { regularUser: 1000, premiumUser: 10000 },
    maxBatchSize: 100,
  },
  users: {
    signUp: false,
    lastHashesCheck: { enabled: false, maxHashes: 0 },
    autoBan: { enabled: false, maxCount: 0, maxHours: 0 },
    profiles: { enabled: true },
    discordIntegration: { enabled: false },
    xp: {
      enabled: false,
      funboxBonus: 0,
      gainMultiplier: 0,
      maxDailyBonus: 0,
      minDailyBonus: 0,
      streak: { enabled: false, maxStreakDays: 0, maxStreakMultiplier: 0 },
    },
    inbox: { enabled: false, maxMail: 0 },
    premium: { enabled: false },
  },
  admin: { endpointsEnabled: false },
  apeKeys: {
    endpointsEnabled: false,
    acceptKeys: false,
    maxKeysPerUser: 0,
    apeKeyBytes: 0,
    apeKeySaltRounds: 0,
  },
  rateLimiting: {
    badAuthentication: { enabled: false, penalty: 0, flaggedStatusCodes: [] },
  },
  dailyLeaderboards: {
    enabled: false,
    leaderboardExpirationTimeInDays: 0,
    maxResults: 0,
    validModeRules: [],
    scheduleRewardsModeRules: [],
    topResultsToAnnounce: 1,
    xpRewardBrackets: [],
  },
  leaderboards: {
    minTimeTyping: 0,
    weeklyXp: {
      enabled: false,
      expirationTimeInDays: 0,
      xpRewardBrackets: [],
    },
  },
  connections: { enabled: false, maxPerUser: 0 },
} satisfies Configuration;

const configurationPromise: Promise<boolean> = Promise.resolve(true);

export { configurationPromise };

export function get(): Configuration | undefined {
  return config;
}

export async function sync(): Promise<void> {
  // no-op in static edition
}
