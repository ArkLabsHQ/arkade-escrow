interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo = ({ className = "", size = 35 }: LogoProps) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 35 35" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M0 8.75L8.75 0H26.25L35 8.75V17.5H26.25V8.75H8.75V17.5H2.45431e-07L0 8.75Z" fill="var(--logo-color)" />
      <path d="M8.75 26.25V17.5H26.25V26.25H8.75Z" fill="var(--logo-color)" />
      <path d="M8.75 26.25H2.45431e-07V35H8.75V26.25Z" fill="var(--logo-color)" />
      <path d="M26.25 26.25V35H35V26.25H26.25Z" fill="var(--logo-color)" />
    </svg>
  );
};
