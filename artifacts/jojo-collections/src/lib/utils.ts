import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Optimised Cloudinary URL for static images.
 *  - f_auto  → WebP/AVIF
 *  - q_auto  → smart compression
 *  - w_{n}   → cap width
 * Non-Cloudinary URLs returned unchanged.
 */
export function cloudinaryImage(url: string | null | undefined, w = 600): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${w}/`);
}

/**
 * Cloudinary URL for animated GIFs — preserves animation.
 * Uses fl_anim + f_auto so modern browsers get WebP animations,
 * older browsers get the original GIF.
 */
export function cloudinaryGif(url: string | null | undefined, w = 1200): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("fl_anim")) return url;
  return url.replace("/upload/", `/upload/fl_anim,f_auto,q_auto,w_${w}/`);
}

/**
 * Cloudinary URL for videos — forces browser-compatible codec + format.
 *  - vc_auto → let Cloudinary pick the best codec (H.264/VP9)
 *  - f_auto  → best container for the browser (mp4/webm)
 *  - q_auto  → smart quality
 */
export function cloudinaryVideo(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("vc_auto")) return url;
  return url.replace("/upload/", "/upload/vc_auto,f_auto,q_auto/");
}
