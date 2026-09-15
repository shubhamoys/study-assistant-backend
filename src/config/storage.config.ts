import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  // Phase 2 — not read by any code yet (no upload module exists). Reserved
  // here so Phase 2's Attachment upload flow has a single place to configure
  // where files land in development, ahead of switching to Cloudflare R2.
  localPath: process.env.LOCAL_STORAGE_PATH ?? './uploads',
}));
