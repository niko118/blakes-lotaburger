"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Alert, AlertDescription } from "@components/ui/alert";
import { LoadingSpinner } from "@components/ui/loading-spinner";
import { AlertCircle, Mail, Lock, LayoutDashboard } from "lucide-react";
import { useState, type FormEvent } from "react";

// Style constants
const styles = {
  container: "flex min-h-screen items-center justify-center bg-fog",
  card: "w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg",
  logoContainer: "flex justify-center mb-4",
  logoIcon: "h-12 w-12 text-steel",
  heading: "text-center text-3xl font-bold text-steel",
  subheading: "mt-2 text-center text-sm text-silver",
  form: "mt-8 space-y-6",
  inputGroup: "space-y-2",
  inputWrapper: "relative",
  inputIcon: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-silver",
  input: "pl-10",
  button: "w-full",
  alert: "mt-4",
  loadingContainer: "flex flex-col items-center justify-center space-y-4",
  loadingText: "text-sm text-silver",
  alertIcon: "h-4 w-4",
} as const;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") || null
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("CredentialsSignin");
        setIsLoading(false);
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Sign-in error:", err);
      setError("Unknown");
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "CredentialsSignin":
        return "Invalid email or password. Please try again.";
      case "AccessDenied":
        return "Access denied. Your account may be inactive.";
      case "Configuration":
        return "Server configuration error. Please contact support.";
      default:
        return "An error occurred during sign-in. Please try again.";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div>
          <div className={styles.logoContainer}>
            <LayoutDashboard className={styles.logoIcon} />
          </div>
          <h2 className={styles.heading}>Welcome</h2>
          <p className={styles.subheading}>
            Sign in with your email and password
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <Label htmlFor="email">Email</Label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <Label htmlFor="password">Password</Label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className={styles.button}
            size="lg"
          >
            {isLoading ? (
              <span className={styles.loadingContainer}>
                <LoadingSpinner />
                <span className={styles.loadingText}>Signing in...</span>
              </span>
            ) : (
              "Sign in"
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className={styles.alert}>
              <AlertCircle className={styles.alertIcon} />
              <AlertDescription>{getErrorMessage(error)}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    </div>
  );
}
