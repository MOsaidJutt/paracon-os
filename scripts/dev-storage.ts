import S3rver from "s3rver";
import path from "path";

/**
 * Local S3-compatible storage for dev/test — a real (if minimal) S3 server
 * rather than a stub, so the Documents panel and Import Centre's presigned
 * upload flow work out of the box without provisioning real MinIO/R2. Used
 * by `npm run dev:storage` (manual) and as a Playwright webServer for e2e.
 */
const PORT = Number(process.env.STORAGE_TEST_PORT ?? 9000);
const BUCKET = process.env.STORAGE_BUCKET ?? "oneparacon";

// The presigned-upload flow PUTs directly from the browser (localhost:3000) to
// this server (localhost:9000) — a cross-origin request, so the bucket needs a
// permissive CORS rule or the browser blocks the PUT/GET before it's sent.
const CORS_CONFIG = `<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
  </CORSRule>
</CORSConfiguration>`;

const server = new S3rver({
  address: "localhost",
  port: PORT,
  silent: false,
  directory: path.join(__dirname, "..", ".s3rver-data"),
  resetOnClose: false,
  allowMismatchedSignatures: true,
  configureBuckets: [{ name: BUCKET, configs: [CORS_CONFIG] }],
});

server.run().then(() => {
  console.log(`Local S3-compatible storage running at http://localhost:${PORT} (bucket: ${BUCKET})`);
});
