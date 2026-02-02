import * as React from "react";

const Logo = ({ className, size = 24, ...props }) => (
  <svg
    fill="currentColor"
    height={size}
    width={size}
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M16 2L2 16V28C2 29.1 2.9 30 4 30H28C29.1 30 30 29.1 30 28V16L16 2Z M16 7.5L24 16H8L16 7.5Z M15 16H17V26H15V16Z"
    />
  </svg>
);

export default Logo;

