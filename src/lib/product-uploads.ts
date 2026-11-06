/**
 * Product photos saved with the upload API are written to local disk.
 * That disk is not durable on Vercel (or other serverless hosts), so those
 * environments must use the existing image URL field instead.
 */
export function localProductUploadAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.VERCEL) return false;
  if (env.AWS_LAMBDA_FUNCTION_NAME) return false;
  if (env.NODE_ENV === "production") return false;
  return true;
}

export const HOSTED_IMAGE_HELP =
  "On the hosted site, paste a public image URL. A file upload is stored only while the local development server is running, and is not kept on serverless hosting.";
