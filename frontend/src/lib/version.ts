// Frontend version - updated on each deployment
// This is set at build time from package.json version
import packageJson from "../../package.json";

export const FRONTEND_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version || "0.1.0";
