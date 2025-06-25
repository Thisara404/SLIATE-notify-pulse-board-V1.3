import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, User, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Login = () => {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const { login, isAuthenticated, isLoading, error, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Clear errors when component mounts or unmounts
  useEffect(() => {
    clearAuthError();
    setValidationError(null);
    
    return () => {
      clearAuthError();
    };
  }, [clearAuthError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearAuthError();
    
    // Client-side validation
    if (!credentials.username || !credentials.password) {
      setValidationError("Please enter both username and password");
      return;
    }

    if (credentials.username.length < 3) {
      setValidationError("Username must be at least 3 characters");
      return;
    }

    if (credentials.password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    try {
      const result = await login(credentials);
      
      if (result.meta.requestStatus === 'fulfilled') {
        // Redirect will happen via useEffect when isAuthenticated changes
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sliate-neutral to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-sliate-accent/20 dark:bg-sliate-light/20 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md z-10">
        <div className="mb-6">
          <Button variant="ghost" asChild className="text-sliate-accent hover:text-sliate-dark dark:text-sliate-light dark:hover:text-white">
            <Link to="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Notice Board</span>
            </Link>
          </Button>
        </div>

        <Card className="border-sliate-accent/20 dark:border-gray-600 shadow-lg bg-white dark:bg-gray-800 animate-fade-in">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src="/lovable-uploads/4bb4a8c2-7b6d-4630-a3bd-2e862e6beb2d.png" 
                alt="SLIATE Logo" 
                className="h-16 w-16 animate-scale-in"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-sliate-dark dark:text-white">
              Admin Login
            </CardTitle>
            <p className="text-sliate-accent dark:text-gray-300">SLIATE Notify Dashboard</p>
          </CardHeader>

          <CardContent>
            {displayError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sliate-dark dark:text-white">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-sliate-accent dark:text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                    className="pl-10 border-sliate-accent/30 dark:border-gray-600 focus:border-sliate-accent dark:focus:border-sliate-light bg-white dark:bg-gray-700 text-sliate-dark dark:text-white placeholder:text-sliate-accent/60 dark:placeholder:text-gray-400"
                    disabled={isLoading}
                    required
                    minLength={3}
                    maxLength={30}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sliate-dark dark:text-white">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-sliate-accent dark:text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                    className="pl-10 border-sliate-accent/30 dark:border-gray-600 focus:border-sliate-accent dark:focus:border-sliate-light bg-white dark:bg-gray-700 text-sliate-dark dark:text-white placeholder:text-sliate-accent/60 dark:placeholder:text-gray-400"
                    disabled={isLoading}
                    required
                    minLength={8}
                    maxLength={128}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-sliate-dark hover:bg-sliate-dark/90 dark:bg-sliate-accent dark:hover:bg-sliate-accent/90 text-white transition-all duration-200 hover:scale-105"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-sliate-accent dark:text-gray-400">
              <p>Admin, Lecturer, or Super Admin access only</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
