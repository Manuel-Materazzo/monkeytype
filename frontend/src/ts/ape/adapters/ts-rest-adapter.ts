import { AppRouter, initClient, type ApiFetcherArgs } from "@ts-rest/core";
import { envConfig } from "virtual:env-config";

export let lastSeenServerCompatibility: number | undefined;

function buildApi(_timeout: number): (args: ApiFetcherArgs) => Promise<{
  status: number;
  body: unknown;
  headers: Headers;
}> {
  return async (_request: ApiFetcherArgs) => {
    return {
      status: 503,
      body: { message: "Offline mode" },
      headers: new Headers(),
    };
  };
}

// oxlint-disable-next-line explicit-function-return-type
export function buildClient<T extends AppRouter>(
  contract: T,
  baseUrl: string,
  timeout: number = 10_000,
) {
  return initClient(contract, {
    baseUrl: baseUrl,
    jsonQuery: true,
    api: buildApi(timeout),
    baseHeaders: {
      Accept: "application/json",
      "X-Client-Version": envConfig.clientVersion,
    },
  });
}
