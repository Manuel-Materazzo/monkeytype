import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("monkeytype", {
  platform: process.platform,
});
