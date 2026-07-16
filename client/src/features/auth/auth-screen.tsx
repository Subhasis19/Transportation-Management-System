import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiRequest } from "@/lib/api-client";
import type { AuthSession, Report } from "@/types/domain";
import { authSchema, type AuthFormValues } from "./auth.schema";

type AuthScreenProps = {
  onAuthenticated: (payload: AuthSession) => void;
  report: Report;
  message: string;
  request: ApiRequest;
};

export function AuthScreen({
  onAuthenticated,
  report,
  message,
  request,
}: AuthScreenProps) {
  const [registering, setRegistering] = useState(false);
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "", name: "", phone: "" },
  });
  async function submit(values: AuthFormValues) {
    try {
      const payload = await request<AuthSession>(
        registering ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            registering
              ? values
              : { email: values.email, password: values.password },
          ),
        },
      );
      onAuthenticated(payload);
    } catch (error) {
      report(error instanceof Error ? error.message : "Unable to authenticate");
    }
  }
  return (
    <main className="relative grid min-h-screen place-items-center bg-background p-6">
      <div className="absolute top-6 right-6">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="font-heading text-sm font-semibold text-primary">
            Transportation Management System
          </p>
          <CardTitle>
            {registering ? "Create customer account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {registering
              ? "Book compliant vehicles with transparent pricing."
              : "Sign in to your transport workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            {registering && (
              <Field
                label="Full name"
                error={form.formState.errors.name?.message}
              >
                <Input {...form.register("name")} />
              </Field>
            )}
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
            {registering && (
              <Field label="Phone" error={form.formState.errors.phone?.message}>
                <Input {...form.register("phone")} />
              </Field>
            )}
            <Field
              label="Password"
              error={form.formState.errors.password?.message}
            >
              <Input type="password" {...form.register("password")} />
            </Field>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Please wait..."
                : registering
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-sm text-primary underline"
            onClick={() => setRegistering(!registering)}
          >
            {registering
              ? "Already have an account? Sign in"
              : "New customer? Create an account"}
          </button>
          {message && <p className="mt-4 text-sm text-destructive">{message}</p>}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
