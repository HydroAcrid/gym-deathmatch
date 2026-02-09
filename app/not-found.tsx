import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="scoreboard-panel p-8 sm:p-12 text-center max-w-md w-full">
        <div className="font-display text-7xl sm:text-8xl font-bold text-primary mb-4"
          style={{ textShadow: "0 0 40px hsl(var(--primary) / 0.4)" }}>
          404
        </div>
        <div className="arena-divider-solid mb-6" />
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider mb-2">
          ROUTE NOT FOUND
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          This page doesn&apos;t exist. The arena awaits elsewhere.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-display font-bold text-sm uppercase tracking-widest border-2 border-primary/60 hover:bg-primary/90 transition-colors touch-target"
        >
          RETURN TO BASE
        </Link>
      </div>
    </div>
  );
}
