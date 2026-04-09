import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Fingerprint, Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleCredential = useCallback(async (response: any) => {
    setGoogleLoading(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      });
      if (authError) {
        setError(authError.message);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!(window as any).google?.accounts) return;
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: true,
        cancel_on_tap_outside: false,
        context: 'signin',
        itp_support: true,
      });
      (window as any).google.accounts.id.prompt();
    };

    if ((window as any).google?.accounts) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [GOOGLE_CLIENT_ID, handleGoogleCredential]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Fingerprint className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            IIT Dharwad
          </h1>
          <p className="text-muted-foreground text-sm">
            Biometric Attendance System
          </p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Sign in with your IITDH Google account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4 py-4">
              {googleLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Signing in with Google...</p>
                </div>
              ) : !GOOGLE_CLIENT_ID ? (
                <p className="text-sm text-destructive font-medium">
                  Google sign-in is not configured. Please set VITE_GOOGLE_CLIENT_ID.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A Google sign-in prompt should appear automatically. If not, check your popup blocker.
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive font-medium">{error}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
