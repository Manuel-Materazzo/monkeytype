import { createSignal } from "solid-js";

type BeforeInstallPromptEvent = {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
} & Event;

const [installPrompt, setInstallPrompt] =
  createSignal<BeforeInstallPromptEvent | null>(null);

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return installPrompt();
}

export function triggerInstall(): void {
  const prompt = installPrompt();
  if (prompt === null) return;
  void prompt.prompt();
  void prompt.userChoice.then((choice) => {
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setInstallPrompt(e as BeforeInstallPromptEvent);
});

window.addEventListener("appinstalled", () => {
  setInstallPrompt(null);
});
