import type { ImgHTMLAttributes } from "react";


type SiteImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
};

// Precompressed, local variants work without a runtime image-transformation service.
export default function SiteImage({ src, alt, fill, priority,
  width, height, sizes, style, loading, fetchPriority, ...props }: SiteImageProps) {


  return (
    // eslint-disable-next-line @next/next/no-img-element -- Explicit local srcSet provides responsive optimization.
    <img {...props} src={src} alt={alt}
      srcSet={props.srcSet} sizes={sizes}
      width={width} height={height}
      loading={loading ?? (priority ? "eager" : "lazy")} decoding="async"
      fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style } : style} />
  );
}
