import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthUrl, isGoogleDriveConfigured } from "@/lib/google-drive/client";
import { initiateUploadSession } from "@/lib/google-drive/service";

const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_DRIVE_REDIRECT_URI"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("isGoogleDriveConfigured", () => {
  it("is false when any of the three required env vars is missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
    expect(isGoogleDriveConfigured()).toBe(false);

    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(isGoogleDriveConfigured()).toBe(false); // still missing redirect URI
  });

  it("is true once all three are set", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "http://localhost:3000/api/admin/google-drive/callback";
    expect(isGoogleDriveConfigured()).toBe(true);
  });
});

describe("buildAuthUrl", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_DRIVE_REDIRECT_URI = "http://localhost:3000/api/admin/google-drive/callback";
  });

  it("requests the least-privileged drive.file scope, offline access and the round-tripped state", () => {
    const url = new URL(buildAuthUrl("anti-csrf-nonce"));
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/admin/google-drive/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("anti-csrf-nonce");
    expect(url.searchParams.get("scope")).toContain("auth/drive.file");
    expect(url.searchParams.get("scope")).not.toContain("auth/drive ");
  });
});

// The only network boundary this service touches directly (everything else
// goes through the googleapis SDK) — mocked at the fetch level rather than
// deep-mocking googleapis, consistent with testing our own logic, not
// Google's client library.
describe("initiateUploadSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the resumable session URL from the Location header on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === "Location" ? "https://upload.example.com/session/abc" : null) },
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = await initiateUploadSession("token-123", "folder-1", "drawing.pdf", "application/pdf");
    expect(url).toBe("https://upload.example.com/session/abc");

    const [calledUrl, options] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("uploadType=resumable");
    expect(options.headers.Authorization).toBe("Bearer token-123");
    expect(options.headers["X-Upload-Content-Type"]).toBe("application/pdf");
    expect(JSON.parse(options.body)).toEqual({ name: "drawing.pdf", parents: ["folder-1"] });
  });

  it("throws a BadRequestError when Google rejects the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid_grant", headers: { get: () => null } })
    );
    await expect(initiateUploadSession("bad-token", "folder-1", "drawing.pdf", "application/pdf")).rejects.toThrow(
      /Google Drive declined the upload session/
    );
  });

  it("throws when Google omits the Location header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: { get: () => null } }));
    await expect(initiateUploadSession("token-123", "folder-1", "drawing.pdf", "application/pdf")).rejects.toThrow(
      /did not return an upload session URL/
    );
  });
});
