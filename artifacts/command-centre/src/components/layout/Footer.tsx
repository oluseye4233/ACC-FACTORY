export function Footer() {
  return (
    <footer className="border-t py-8 md:py-12 bg-background">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}atanda-logo.png`}
              alt="ATANDA"
              className="h-8 w-auto"
            />
            <span className="font-display text-lg tracking-wider text-primary">Command Centre</span>
          </div>
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
