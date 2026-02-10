import * as Notifications from "./elements/notifications";
import { TestActivityCalendar } from "./elements/test-activity-calendar";
import { Badge, CustomTheme } from "@monkeytype/schemas/users";
import { Config, Difficulty } from "@monkeytype/schemas/configs";
import {
  Mode,
  Mode2,
  PersonalBest,
  PersonalBests,
} from "@monkeytype/schemas/shared";
import {
  getDefaultSnapshot,
  Snapshot,
  SnapshotResult,
  SnapshotUserTag,
} from "./constants/default-snapshot";
import { FunboxMetadata } from "../../../packages/funbox/src/types";
import { Language } from "@monkeytype/schemas/languages";
import * as AuthEvent from "./observables/auth-event";
import { configurationPromise } from "./ape/server-configuration";
import * as LocalDb from "./utils/local-db";

let dbSnapshot: Snapshot | undefined;

export class SnapshotInitError extends Error {
  constructor(
    message: string,
    public responseCode: number,
  ) {
    super(message);
    this.name = "SnapshotInitError";
    // TODO INVESTIGATE
    // oxlint-disable-next-line
    this.responseCode = responseCode;
  }
}

export function getSnapshot(): Snapshot | undefined {
  return dbSnapshot;
}

export function setSnapshot(
  newSnapshot: Snapshot | undefined,
  options?: { dispatchEvent?: boolean },
): void {
  const originalBanned = dbSnapshot?.banned;
  const originalVerified = dbSnapshot?.verified;
  const lbOptOut = dbSnapshot?.lbOptOut;

  //not allowing user to override these values i guess?
  try {
    delete newSnapshot?.banned;
  } catch {}
  try {
    delete newSnapshot?.verified;
  } catch {}
  try {
    delete newSnapshot?.lbOptOut;
  } catch {}
  dbSnapshot = newSnapshot;
  if (dbSnapshot) {
    dbSnapshot.banned = originalBanned;
    dbSnapshot.verified = originalVerified;
    dbSnapshot.lbOptOut = lbOptOut;
  }

  if (dbSnapshot) {
    LocalDb.saveSnapshotToLocalStorage(dbSnapshot);
  }

  if (options?.dispatchEvent !== false) {
    AuthEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: false } });
  }
}

export async function initSnapshot(): Promise<Snapshot | false> {
  await configurationPromise;

  try {
    const localSnapshot = LocalDb.loadSnapshotFromLocalStorage();
    if (localSnapshot) {
      dbSnapshot = localSnapshot;
      AuthEvent.dispatch({
        type: "snapshotUpdated",
        data: { isInitial: true },
      });
      return dbSnapshot;
    }
    const defaultLocalSnapshot = LocalDb.initializeLocalSnapshot();
    dbSnapshot = defaultLocalSnapshot;
    AuthEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: true } });
    return dbSnapshot;
  } catch (e) {
    dbSnapshot = getDefaultSnapshot();
    throw e;
  }
}

export async function getUserResults(offset?: number): Promise<boolean> {
  if (!dbSnapshot) return false;
  if (
    dbSnapshot.results !== undefined &&
    (offset === undefined || dbSnapshot.results.length > offset)
  ) {
    return true;
  }
  return false;
}

function _getCustomThemeById(themeID: string): CustomTheme | undefined {
  return dbSnapshot?.customThemes?.find((t) => t._id === themeID);
}

export async function addCustomTheme(
  theme: Omit<CustomTheme, "_id">,
): Promise<boolean> {
  if (!dbSnapshot) return false;

  dbSnapshot.customThemes ??= [];

  if (dbSnapshot.customThemes.length >= 20) {
    Notifications.add("Too many custom themes!", 0);
    return false;
  }

  const newCustomTheme: CustomTheme = {
    ...theme,
    _id: "local_" + Date.now() + "_" + Math.random(),
  };

  dbSnapshot.customThemes.push(newCustomTheme);
  setSnapshot(dbSnapshot);
  return true;
}

export async function editCustomTheme(
  themeId: string,
  newTheme: Omit<CustomTheme, "_id">,
): Promise<boolean> {
  if (!dbSnapshot) return false;

  dbSnapshot.customThemes ??= [];

  const customTheme = dbSnapshot.customThemes?.find((t) => t._id === themeId);
  if (!customTheme) {
    Notifications.add(
      "Editing failed: Custom theme with id: " + themeId + " does not exist",
      -1,
    );
    return false;
  }

  const newCustomTheme: CustomTheme = {
    ...newTheme,
    _id: themeId,
  };

  dbSnapshot.customThemes[dbSnapshot.customThemes.indexOf(customTheme)] =
    newCustomTheme;

  setSnapshot(dbSnapshot);
  return true;
}

export async function deleteCustomTheme(themeId: string): Promise<boolean> {
  if (!dbSnapshot) return false;

  const customTheme = dbSnapshot.customThemes?.find((t) => t._id === themeId);
  if (!customTheme) return false;

  dbSnapshot.customThemes = dbSnapshot.customThemes?.filter(
    (t) => t._id !== themeId,
  );

  setSnapshot(dbSnapshot);
  return true;
}

export async function getUserAverage10<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): Promise<[number, number]> {
  const snapshot = getSnapshot();

  if (!snapshot) return [0, 0];

  function cont(): [number, number] {
    const activeTagIds: string[] = [];
    snapshot?.tags?.forEach((tag) => {
      if (tag.active === true) {
        activeTagIds.push(tag._id);
      }
    });

    let wpmSum = 0;
    let accSum = 0;
    let last10Wpm = 0;
    let last10Acc = 0;
    let count = 0;
    let last10Count = 0;

    if (snapshot?.results !== undefined) {
      for (const result of snapshot.results) {
        if (
          result.mode === mode &&
          (result.punctuation ?? false) === punctuation &&
          (result.numbers ?? false) === numbers &&
          result.language === language &&
          result.difficulty === difficulty &&
          (result.lazyMode === lazyMode ||
            (result.lazyMode === undefined && !lazyMode)) &&
          (activeTagIds.length === 0 ||
            activeTagIds.some((tagId) => result.tags?.includes(tagId)))
        ) {
          // Continue if the mode2 doesn't match and it's not a quote
          if (
            `${result.mode2}` !== `${mode2 as string | number}` &&
            mode !== "quote"
          ) {
            //using template strings because legacy results might use numbers in mode2
            continue;
          }

          // Grab the most recent results from the current mode
          if (last10Count < 10) {
            last10Wpm += result.wpm;
            last10Acc += result.acc;
            last10Count++;
          }

          // Check if the mode2 matches and if it does, add it to the sum, for quotes, this is the quote id
          if (`${result.mode2}` === `${mode2 as string | number}`) {
            //using template strings because legacy results might use numbers in mode2
            wpmSum += result.wpm;
            accSum += result.acc;
            count++;

            if (count >= 10) break;
          }
        }
      }
    }

    // Return the last 10 average wpm & acc for quote
    // if the current quote id has never been completed before by the user
    if (count === 0 && mode === "quote") {
      return [last10Wpm / last10Count, last10Acc / last10Count];
    }

    return [wpmSum / count, accSum / count];
  }

  const retval: [number, number] =
    snapshot === null || (await getUserResults()) === null ? [0, 0] : cont();

  return retval;
}

export async function getUserDailyBest<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): Promise<number> {
  const snapshot = getSnapshot();

  if (!snapshot) return 0;

  function cont(): number {
    const activeTagIds: string[] = [];
    snapshot?.tags?.forEach((tag) => {
      if (tag.active === true) {
        activeTagIds.push(tag._id);
      }
    });

    let bestWpm = 0;

    if (snapshot?.results !== undefined) {
      for (const result of snapshot.results) {
        if (
          result.mode === mode &&
          (result.punctuation ?? false) === punctuation &&
          (result.numbers ?? false) === numbers &&
          result.language === language &&
          result.difficulty === difficulty &&
          (result.lazyMode === lazyMode ||
            (result.lazyMode === undefined && !lazyMode)) &&
          (activeTagIds.length === 0 ||
            activeTagIds.some((tagId) => result.tags?.includes(tagId)))
        ) {
          if (result.timestamp < Date.now() - 86400000) {
            continue;
          }

          // Continue if the mode2 doesn't match and it's not a quote
          if (
            `${result.mode2}` !== `${mode2 as string | number}` &&
            mode !== "quote"
          ) {
            //using template strings because legacy results might use numbers in mode2
            continue;
          }

          if (result.wpm > bestWpm) {
            bestWpm = result.wpm;
          }
        }
      }
    }

    return bestWpm;
  }

  const retval: number =
    snapshot === null || (await getUserResults()) === null ? 0 : cont();

  return retval;
}

export async function getActiveTagsPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): Promise<number> {
  const snapshot = getSnapshot();
  if (!snapshot) return 0;

  let tagPbWpm = 0;
  for (const tag of snapshot.tags) {
    if (!tag.active) continue;
    const currTagPB = await getLocalTagPB(
      tag._id,
      mode,
      mode2,
      punctuation,
      numbers,
      language,
      difficulty,
      lazyMode,
    );
    if (currTagPB > tagPbWpm) tagPbWpm = currTagPB;
  }

  return tagPbWpm;
}

export async function getLocalPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
  funboxes: FunboxMetadata[],
): Promise<PersonalBest | undefined> {
  if (!funboxes.every((f) => f.canGetPb)) {
    return undefined;
  }

  const pbs = dbSnapshot?.personalBests?.[mode]?.[mode2] as
    | PersonalBest[]
    | undefined;

  return pbs?.find(
    (pb) =>
      (pb.punctuation ?? false) === punctuation &&
      (pb.numbers ?? false) === numbers &&
      pb.difficulty === difficulty &&
      pb.language === language &&
      (pb.lazyMode ?? false) === lazyMode,
  );
}

function saveLocalPB<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
  wpm: number,
  acc: number,
  raw: number,
  consistency: number,
): void {
  if (mode === "quote") return;
  if (!dbSnapshot) return;
  function cont(): void {
    if (!dbSnapshot) return;
    let found = false;

    dbSnapshot.personalBests ??= {
      time: {},
      words: {},
      quote: {},
      zen: {},
      custom: {},
    };

    dbSnapshot.personalBests[mode] ??= {
      [mode2]: [],
    };

    dbSnapshot.personalBests[mode][mode2] ??=
      [] as unknown as PersonalBests[M][Mode2<M>];

    (
      dbSnapshot.personalBests[mode][mode2] as unknown as PersonalBest[]
    ).forEach((pb) => {
      if (
        (pb.punctuation ?? false) === punctuation &&
        (pb.numbers ?? false) === numbers &&
        pb.difficulty === difficulty &&
        pb.language === language &&
        (pb.lazyMode ?? false) === lazyMode
      ) {
        found = true;
        pb.wpm = wpm;
        pb.acc = acc;
        pb.raw = raw;
        pb.timestamp = Date.now();
        pb.consistency = consistency;
        pb.lazyMode = lazyMode;
      }
    });
    if (!found) {
      //nothing found
      (dbSnapshot.personalBests[mode][mode2] as unknown as PersonalBest[]).push(
        {
          language,
          difficulty,
          lazyMode,
          punctuation,
          numbers,
          wpm,
          acc,
          raw,
          timestamp: Date.now(),
          consistency,
        },
      );
    }
  }

  if (dbSnapshot !== null) {
    cont();
  }
}

export async function getLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: string,
  difficulty: Difficulty,
  lazyMode: boolean,
): Promise<number> {
  if (dbSnapshot === null) return 0;

  let ret = 0;

  const filteredtag = (getSnapshot()?.tags ?? []).find((t) => t._id === tagId);

  if (filteredtag === undefined) return ret;

  filteredtag.personalBests ??= {
    time: {},
    words: {},
    quote: {},
    zen: {},
    custom: {},
  };

  filteredtag.personalBests[mode] ??= {
    [mode2]: [],
  };

  filteredtag.personalBests[mode][mode2] ??=
    [] as unknown as PersonalBests[M][Mode2<M>];

  const personalBests = (filteredtag.personalBests[mode][mode2] ??
    []) as PersonalBest[];

  ret =
    personalBests.find(
      (pb) =>
        (pb.punctuation ?? false) === punctuation &&
        (pb.numbers ?? false) === numbers &&
        pb.difficulty === difficulty &&
        pb.language === language &&
        (pb.lazyMode === lazyMode || (pb.lazyMode === undefined && !lazyMode)),
    )?.wpm ?? 0;

  return ret;
}

export async function saveLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
  wpm: number,
  acc: number,
  raw: number,
  consistency: number,
): Promise<number | undefined> {
  if (!dbSnapshot) return;
  if (mode === "quote") return;
  function cont(): void {
    const filteredtag = dbSnapshot?.tags?.find(
      (t) => t._id === tagId,
    ) as SnapshotUserTag;

    filteredtag.personalBests ??= {
      time: {},
      words: {},
      quote: {},
      zen: {},
      custom: {},
    };

    filteredtag.personalBests[mode] ??= {
      [mode2]: [],
    };

    filteredtag.personalBests[mode][mode2] ??=
      [] as unknown as PersonalBests[M][Mode2<M>];

    try {
      let found = false;

      (
        filteredtag.personalBests[mode][mode2] as unknown as PersonalBest[]
      ).forEach((pb) => {
        if (
          (pb.punctuation ?? false) === punctuation &&
          (pb.numbers ?? false) === numbers &&
          pb.difficulty === difficulty &&
          pb.language === language &&
          (pb.lazyMode === lazyMode || (pb.lazyMode === undefined && !lazyMode))
        ) {
          found = true;
          pb.wpm = wpm;
          pb.acc = acc;
          pb.raw = raw;
          pb.timestamp = Date.now();
          pb.consistency = consistency;
          pb.lazyMode = lazyMode;
        }
      });
      if (!found) {
        //nothing found
        (
          filteredtag.personalBests[mode][mode2] as unknown as PersonalBest[]
        ).push({
          language,
          difficulty,
          lazyMode,
          punctuation,
          numbers,
          wpm,
          acc,
          raw,
          timestamp: Date.now(),
          consistency,
        });
      }
    } catch (e) {
      //that mode or mode2 is not found
      filteredtag.personalBests = {
        time: {},
        words: {},
        quote: {},
        zen: {},
        custom: {},
      };
      filteredtag.personalBests[mode][mode2] = [
        {
          language: language,
          difficulty: difficulty,
          lazyMode: lazyMode,
          punctuation: punctuation,
          numbers: numbers,
          wpm: wpm,
          acc: acc,
          raw: raw,
          timestamp: Date.now(),
          consistency: consistency,
        },
      ] as unknown as PersonalBests[M][Mode2<M>];
    }
  }

  if (dbSnapshot !== null) {
    cont();
  }

  return;
}

export function deleteLocalTag(tagId: string): void {
  getSnapshot()?.results?.forEach((result) => {
    const tagIndex = result.tags.indexOf(tagId);
    if (tagIndex > -1) {
      result.tags.splice(tagIndex, 1);
    }
  });
}

export async function updateLocalTagPB<M extends Mode>(
  tagId: string,
  mode: M,
  mode2: Mode2<M>,
  punctuation: boolean,
  numbers: boolean,
  language: Language,
  difficulty: Difficulty,
  lazyMode: boolean,
): Promise<void> {
  if (dbSnapshot === null) return;

  const filteredtag = (getSnapshot()?.tags ?? []).find((t) => t._id === tagId);

  if (filteredtag === undefined) return;

  const pb = {
    wpm: 0,
    acc: 0,
    rawWpm: 0,
    consistency: 0,
  };

  getSnapshot()?.results?.forEach((result) => {
    if (result.tags.includes(tagId) && result.wpm > pb.wpm) {
      if (
        result.mode === mode &&
        result.mode2 === mode2 &&
        result.punctuation === punctuation &&
        result.numbers === numbers &&
        result.language === language &&
        result.difficulty === difficulty &&
        result.lazyMode === lazyMode
      ) {
        pb.wpm = result.wpm;
        pb.acc = result.acc;
        pb.rawWpm = result.rawWpm;
        pb.consistency = result.consistency;
      }
    }
  });

  await saveLocalTagPB(
    tagId,
    mode,
    mode2,
    punctuation,
    numbers,
    language,
    difficulty,
    lazyMode,
    pb.wpm,
    pb.acc,
    pb.rawWpm,
    pb.consistency,
  );
}

export async function updateLbMemory<M extends Mode>(
  mode: M,
  mode2: Mode2<M>,
  language: Language,
  rank: number,
  _api = false,
): Promise<void> {
  if (mode === "time") {
    const timeMode = mode;
    const timeMode2 = mode2 as "15" | "60";

    const snapshot = getSnapshot();
    if (!snapshot) return;
    snapshot.lbMemory ??= {
      time: { "15": { english: 0 }, "60": { english: 0 } },
    };
    snapshot.lbMemory[timeMode] ??= {
      "15": { english: 0 },
      "60": { english: 0 },
    };
    snapshot.lbMemory[timeMode][timeMode2] ??= {};

    const mem = snapshot.lbMemory[timeMode][timeMode2];
    mem[language] = rank;
    setSnapshot(snapshot);
  }
}

// oxlint-disable-next-line no-empty-function
export async function saveConfig(_config: Partial<Config>): Promise<void> {}

// oxlint-disable-next-line no-empty-function
export async function resetConfig(): Promise<void> {}

export type SaveLocalResultData = {
  xp?: number;
  streak?: number;
  result?: SnapshotResult<Mode>;
  isPb?: boolean;
};

export function saveLocalResult(data: SaveLocalResultData): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  if (data.result !== undefined) {
    if (snapshot.results !== undefined) {
      snapshot.results.unshift(data.result);
    } else {
      snapshot.results = [data.result];
    }
    if (snapshot.testActivity !== undefined) {
      snapshot.testActivity.increment(new Date(data.result.timestamp));
    }
    snapshot.typingStats ??= {
      timeTyping: 0,
      startedTests: 0,
      completedTests: 0,
    };

    const time =
      data.result.testDuration +
      data.result.incompleteTestSeconds -
      data.result.afkDuration;

    snapshot.typingStats.timeTyping += time;
    snapshot.typingStats.startedTests += data.result.restartCount + 1;
    snapshot.typingStats.completedTests += 1;

    if (data.isPb) {
      saveLocalPB(
        data.result.mode,
        data.result.mode2,
        data.result.punctuation,
        data.result.numbers,
        data.result.language,
        data.result.difficulty,
        data.result.lazyMode,
        data.result.wpm,
        data.result.acc,
        data.result.rawWpm,
        data.result.consistency,
      );
    }
  }

  if (data.xp !== undefined) {
    snapshot.xp ??= 0;
    snapshot.xp += data.xp;
  }

  if (data.streak !== undefined) {
    snapshot.streak = data.streak;

    if (snapshot.streak > snapshot.maxStreak) {
      snapshot.maxStreak = snapshot.streak;
    }
  }

  setSnapshot(snapshot, {
    dispatchEvent: false,
  });
}

export function addXp(xp: number): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.xp ??= 0;
  snapshot.xp += xp;
  setSnapshot(snapshot, {
    dispatchEvent: false,
  });
}

export function updateInboxUnreadSize(newSize: number): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.inboxUnreadSize = newSize;
  setSnapshot(snapshot);
}

export function addBadge(badge: Badge): void {
  const snapshot = getSnapshot();
  if (!snapshot) return;

  snapshot.inventory ??= {
    badges: [],
  };
  snapshot.inventory.badges.push(badge);
  setSnapshot(snapshot);
}

export async function getTestActivityCalendar(
  yearString: string,
): Promise<TestActivityCalendar | undefined> {
  if (dbSnapshot === undefined) return undefined;

  if (yearString === "current") return dbSnapshot.testActivity;

  const currentYear = new Date().getFullYear().toString();
  if (yearString === currentYear) {
    return dbSnapshot.testActivity?.getFullYearCalendar();
  }

  return dbSnapshot.testActivityByYear?.[yearString];
}

// oxlint-disable-next-line no-empty-function
export function mergeConnections(_connections: unknown[]): void {}

export function isFriend(_uid: string | undefined): boolean {
  return false;
}

// export async function DB.getLocalTagPB(tagId) {
//   function cont() {
//     let ret = 0;
//     try {
//       ret = dbSnapshot.tags.filter((t) => t.id === tagId)[0].pb;
//       if (ret === undefined) {
//         ret = 0;
//       }
//       return ret;
//     } catch (e) {
//       return ret;
//     }
//   }

//   const retval = dbSnapshot !== null ? cont() : undefined;

//   return retval;
// }

// export async functio(tagId, wpm) {
//   function cont() {
//     dbSnapshot.tags.forEach((tag) => {
//       if (tag._id === tagId) {
//         tag.pb = wpm;
//       }
//     });
//   }

//   if (dbSnapshot !== null) {
//     cont();
//   }
// }
