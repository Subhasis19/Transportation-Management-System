import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import type { User } from "@/types/domain";

type AppShellProps = {
  user: User;
  message: string;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({
  user,
  message,
  onSignOut,
  children,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-heading text-xl font-semibold tracking-wide">
              TRUCKLINE
            </p>
            <p className="text-xs text-muted-foreground">
              Transportation management, made clear
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{user.role}</Badge>
            <span className="hidden text-sm text-muted-foreground sm:block">
              {user.name}
            </span>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <p className="mb-5 rounded-md bg-primary/10 px-4 py-3 text-sm text-primary">
            {message}
          </p>
        )}
        {children}
      </div>
    </main>
  );
}
