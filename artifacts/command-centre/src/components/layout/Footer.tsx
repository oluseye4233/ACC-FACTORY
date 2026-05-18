export function Footer() {
  return (
    <footer className="border-t py-8 md:py-12 bg-background">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center md:items-start gap-2">
          <span className="font-display text-lg tracking-wider text-primary">ATANDA Command Centre</span>
          <p className="text-sm text-muted-foreground">
            FORGE.BONSAI HARNESS
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} ATANDA</span>
        </div>
      </div>
    </footer>
  );
}
