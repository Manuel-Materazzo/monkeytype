import { promiseWithResolvers } from "./utils/misc";

export type User = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  providerData: Array<{ providerId: string }>;
};
export type UserCredential = { user: User };
export type AuthProvider = { providerId?: string };

type ReadyCallback = (success: boolean, user: User | null) => Promise<void>;

const { promise: authPromise, resolve: resolveAuthPromise } =
  promiseWithResolvers();

export async function init(callback: ReadyCallback): Promise<void> {
  await callback(false, null);
  resolveAuthPromise();
}

export function isAuthenticated(): boolean {
  return false;
}

export function getAuthenticatedUser(): User | null {
  return null;
}

export function getAnalytics(): undefined {
  return undefined;
}

export function isAuthAvailable(): boolean {
  return false;
}

export async function signOut(): Promise<void> {
  // noop
}

export async function signInWithEmailAndPassword(
  _email: string,
  _password: string,
  _rememberMe: boolean,
): Promise<UserCredential> {
  return { user: { uid: "", providerData: [] } };
}

export async function signInWithPopup(
  _provider: AuthProvider,
  _rememberMe: boolean,
): Promise<void> {
  // noop
}

export async function createUserWithEmailAndPassword(
  _email: string,
  _password: string,
): Promise<UserCredential> {
  return { user: { uid: "", providerData: [] } };
}

export async function getIdToken(): Promise<null> {
  return null;
}

export function resetIgnoreAuthCallback(): void {
  // noop
}

export async function sendEmailVerification(_user: User): Promise<void> {
  // noop
}

export async function updateProfile(
  _user: User,
  _profile: { displayName?: string | null; photoURL?: string | null },
): Promise<void> {
  // noop
}

export function getAdditionalUserInfo(
  _credential: UserCredential,
): { isNewUser: boolean } | null {
  return null;
}

export const EmailAuthProvider = {
  credential(_email: string, _password: string): { providerId: string } {
    return { providerId: "password" };
  },
};

export async function reauthenticateWithCredential(
  _user: User,
  _credential: unknown,
): Promise<UserCredential> {
  return { user: { uid: "", providerData: [] } };
}

export async function reauthenticateWithPopup(
  _user: User,
  _provider: AuthProvider,
): Promise<UserCredential> {
  return { user: { uid: "", providerData: [] } };
}

export async function linkWithCredential(
  _user: User,
  _credential: unknown,
): Promise<UserCredential> {
  return { user: { uid: "", providerData: [] } };
}

export async function unlinkProvider(
  _user: User,
  _providerId: string,
): Promise<User> {
  return { uid: "", providerData: [] };
}

export { authPromise };
