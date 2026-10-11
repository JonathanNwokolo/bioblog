import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
};

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowDown(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} {...props} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.700 3.700 4.500 7 4.500c2 0 3.600 1.100 5 3 1.400-1.900 3-3 5-3 3.300 0 5.300 3.200 4.200 6.600-1.700 4.800-9.200 9.400-9.200 9.400Z" />
    </svg>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.500a8.500 8.500 0 0 1-12.400 7.500L3 20.500l1.600-5A8.500 8.500 0 1 1 21 11.500Z" />
    </svg>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <svg {...base} {...props} stroke="none" fill="currentColor">
      <path d="M4.500 9h3.700v11.500H4.500V9Zm1.850-5.500a2.150 2.150 0 1 1 0 4.300 2.150 2.150 0 0 1 0-4.300ZM10.500 9H14v1.600h.1c.5-.9 1.700-1.900 3.600-1.900 3.800 0 4.500 2.500 4.500 5.800v6h-3.700v-5.300c0-1.300 0-2.900-1.800-2.900s-2.100 1.400-2.100 2.800v5.400h-3.700V9Z" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h16M4 16h16" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.500a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7M9 7V4.500h6V7" />
    </svg>
  );
}
