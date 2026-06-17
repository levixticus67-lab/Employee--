import { cloudinaryImage } from "@/lib/utils";

/**
 * Drop-in <img> replacement that:
 *  1. Optimises Cloudinary URLs (WebP + smart quality + width cap)
 *  2. Adds loading="lazy" by default (pass eager for above-the-fold images)
 *
 * Usage:
 *   <CldImg src={product.imageUrl} alt="..." className="..." w={400} />
 *   <CldImg src={hero.url} alt="..." w={800} eager />
 */
type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  w?: number;
  eager?: boolean;
};

export function CldImg({ src, w = 600, eager, loading, ...props }: Props) {
  return (
    <img
      {...props}
      src={cloudinaryImage(src as string | null | undefined, w)}
      loading={loading ?? (eager ? "eager" : "lazy")}
    />
  );
}
