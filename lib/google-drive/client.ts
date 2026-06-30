import { google } from "googleapis";
import { BadRequestError } from "@/lib/errors";

/**
 * Least-privileged scope — OneParacon can only see/manage files and folders
 * it creates itself or that a user explicitly selects via the Picker widget,
 * never the connected account's whole Drive. This is what keeps the OAuth
 * consent screen out of Google's "restricted scope" verification process.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured — see .env.example`);
  return value;
}

export function isGoogleDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REDIRECT_URI);
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_DRIVE_REDIRECT_URI")
  );
}

/** Builds the consent-screen redirect URL. `state` round-trips the org id through Google so the callback knows which org is connecting. */
export function buildAuthUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh token on every connect, not just the first ever consent
    scope: [DRIVE_SCOPE, USERINFO_SCOPE],
    state,
  });
}

/** Exchanges the OAuth callback's `code` for a refresh token + the connected account's email. */
export async function exchangeCodeForTokens(code: string): Promise<{ refreshToken: string; email: string }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new BadRequestError(
      "Google did not return a refresh token — disconnect any prior OneParacon grant at myaccount.google.com/permissions and try connecting again"
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new BadRequestError("Could not read the connected Google account's email");

  return { refreshToken: tokens.refresh_token, email: data.email };
}

/** Mints a short-lived access token from a stored refresh token — never persisted, minted fresh per use. */
export async function mintAccessToken(refreshToken: string): Promise<string> {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new BadRequestError("Google Drive is connected, but a fresh access token couldn't be minted — try reconnecting");
  return token;
}

/** A configured Drive v3 client for one request — callers mint a fresh access token first via mintAccessToken. */
export function getDriveClient(accessToken: string) {
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: client });
}
