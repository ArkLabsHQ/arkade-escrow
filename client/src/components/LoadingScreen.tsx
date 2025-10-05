import { Logo } from "./Logo";
import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onLoadComplete: () => void;
}

export const LoadingScreen = ({ onLoadComplete }: LoadingScreenProps) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    const loadingTimer = setTimeout(() => {
      onLoadComplete();
    }, 3000);

    return () => {
      clearInterval(dotsInterval);
      clearTimeout(loadingTimer);
    };
  }, [onLoadComplete]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-subtle">
      <div className="absolute inset-0 bg-gradient-shine opacity-50" />
      
      <div className="relative flex flex-col items-center space-y-8 animate-slide-up">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-primary/30 rounded-full animate-pulse-glow" />
          <div className="relative animate-spin-slow">
            <Logo size={80} />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Connecting to your wallet{dots}
          </h2>
          <p className="text-muted-foreground">
            Setting up your secure escrow environment
          </p>
        </div>

        <div className="w-64 h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-gradient-primary animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
