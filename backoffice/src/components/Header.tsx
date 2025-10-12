const Header = () => {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center gap-3">
        <svg 
          width={32}
          height={32}
          viewBox="0 0 35 35" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          <path d="M0 8.75L8.75 0H26.25L35 8.75V17.5H26.25V8.75H8.75V17.5H2.45431e-07L0 8.75Z" fill="var(--logo-color)" />
          <path d="M8.75 26.25V17.5H26.25V26.25H8.75Z" fill="var(--logo-color)" />
          <path d="M8.75 26.25H2.45431e-07V35H8.75V26.25Z" fill="var(--logo-color)" />
          <path d="M26.25 26.25V35H35V26.25H26.25Z" fill="var(--logo-color)" />
        </svg>
        <h1 className="text-xl font-semibold text-foreground">ARK Escrow Backoffice</h1>
      </div>
    </header>
  );
};

export default Header;
