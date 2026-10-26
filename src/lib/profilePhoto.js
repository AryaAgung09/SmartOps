import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import path from "path";

export const PROFILE_PHOTO_DIR = path.join(process.cwd(), "storage", "profiles");
export const MAX_PROFILE_PHOTO_SIZE = 2 * 1024 * 1024;

const PHOTO_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isRemoteProfilePhoto(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function profilePhotoMime(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

export function profilePhotoExtension(contentType) {
  return PHOTO_EXTENSIONS[contentType] || null;
}

export function profilePhotoValidationError(file) {
  if (!(file instanceof File)) return "Pilih foto profile terlebih dahulu";
  if (file.size === 0) return "File foto kosong";
  if (file.size > MAX_PROFILE_PHOTO_SIZE) return "Ukuran foto maksimal 2 MB";
  if (!profilePhotoExtension(file.type)) return "Format foto harus JPG, PNG, atau WebP";
  return null;
}

export function newProfilePhotoName(userId, extension) {
  return `${userId}-${Date.now()}-${randomUUID()}.${extension}`;
}

export async function deleteStoredProfilePhoto(value) {
  if (!value || isRemoteProfilePhoto(value)) return;
  await unlink(path.join(PROFILE_PHOTO_DIR, path.basename(value))).catch(() => {});
}
