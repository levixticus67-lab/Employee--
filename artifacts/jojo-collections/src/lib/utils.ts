import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns an optimised Cloudinary URL:
 *  - f_auto  → WebP/AVIF for supported browsers (same visual quality, 30-50 % smaller)
 *  - q_auto  → smart compression (invisible quality loss)
 *  - w_{n}   → cap width so mobile doesn't download a 3000 px image
 * Non-Cloudinary URLs and null/undefined are returned unchanged.
 */
export function cloudinaryImage(url: string | null | undefined, w = 600): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("f_auto")) return url; // already optimised
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
}
