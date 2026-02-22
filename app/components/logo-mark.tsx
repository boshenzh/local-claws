import Image from "next/image";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <Image
      src="/localclaws-logo.png"
      alt="LocalClaws crab logo"
      width={size}
      height={size}
      className={className}
      priority
      unoptimized
    />
  );
}
