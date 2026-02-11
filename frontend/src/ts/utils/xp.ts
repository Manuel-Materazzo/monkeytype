import { XpBreakdown, CompletedEvent } from "@monkeytype/schemas/results";
import { getFunbox } from "@monkeytype/funbox";
import {
  getStartOfDayTimestamp,
  getCurrentDayTimestamp,
} from "@monkeytype/util/date-and-time";
import { isSafeNumber } from "@monkeytype/util/numbers";

const MIN_DAILY_BONUS = 10;
const MAX_DAILY_BONUS = 1000;

export function calculateXp(
  result: CompletedEvent,
  currentTotalXp: number,
  lastResultTimestamp: number | null,
): { xp: number; breakdown: XpBreakdown } {
  const {
    mode,
    acc,
    testDuration,
    incompleteTestSeconds,
    incompleteTests,
    afkDuration,
    charStats,
    punctuation,
    numbers,
    funbox: resultFunboxes,
  } = result;

  if (mode === "zen") {
    return { xp: 0, breakdown: {} };
  }

  const breakdown: XpBreakdown = {};

  const baseXp = Math.round((testDuration - afkDuration) * 2);
  breakdown.base = baseXp;

  let modifier = 1;

  const correctedEverything = charStats
    .slice(1)
    .every((charStat: number) => charStat === 0);

  if (acc === 100) {
    modifier += 0.5;
    breakdown.fullAccuracy = Math.round(baseXp * 0.5);
  } else if (correctedEverything) {
    modifier += 0.25;
    breakdown.corrected = Math.round(baseXp * 0.25);
  }

  if (mode === "quote") {
    modifier += 0.5;
    breakdown.quote = Math.round(baseXp * 0.5);
  } else {
    if (punctuation) {
      modifier += 0.4;
      breakdown.punctuation = Math.round(baseXp * 0.4);
    }
    if (numbers) {
      modifier += 0.1;
      breakdown.numbers = Math.round(baseXp * 0.1);
    }
  }

  if (resultFunboxes.length !== 0) {
    const funboxModifier = resultFunboxes.reduce((sum, funboxName) => {
      const fb = getFunbox(funboxName);
      const difficultyLevel = fb?.difficultyLevel ?? 0;
      return sum + difficultyLevel;
    }, 0);

    if (funboxModifier > 0) {
      modifier += funboxModifier;
      breakdown.funbox = Math.round(baseXp * funboxModifier);
    }
  }

  let incompleteXp = 0;
  if (incompleteTests !== undefined && incompleteTests.length > 0) {
    incompleteTests.forEach((it: { acc: number; seconds: number }) => {
      let mod = (it.acc - 50) / 50;
      if (mod < 0) mod = 0;
      incompleteXp += Math.round(it.seconds * mod);
    });
    breakdown.incomplete = incompleteXp;
  } else if (incompleteTestSeconds && incompleteTestSeconds > 0) {
    incompleteXp = Math.round(incompleteTestSeconds);
    breakdown.incomplete = incompleteXp;
  }

  const accuracyModifier = (acc - 50) / 50;

  let dailyBonus = 0;
  if (isSafeNumber(lastResultTimestamp)) {
    const lastResultDay = getStartOfDayTimestamp(lastResultTimestamp);
    const today = getCurrentDayTimestamp();
    if (lastResultDay !== today) {
      const proportionalXp = Math.round(currentTotalXp * 0.05);
      dailyBonus = Math.max(
        Math.min(MAX_DAILY_BONUS, proportionalXp),
        MIN_DAILY_BONUS,
      );
      breakdown.daily = dailyBonus;
    }
  }

  const xpWithModifiers = Math.round(baseXp * modifier);
  const xpAfterAccuracy = Math.round(xpWithModifiers * accuracyModifier);
  breakdown.accPenalty = xpWithModifiers - xpAfterAccuracy;

  const totalXp = Math.round(xpAfterAccuracy + incompleteXp) + dailyBonus;

  return { xp: totalXp, breakdown };
}
