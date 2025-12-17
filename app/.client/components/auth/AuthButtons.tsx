import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import { Button } from '~/.client/components/ui/Button';
import { useAuth } from '~/.client/hooks/useAuth';

export function SignInButton({ className, children = '登录' }: { className?: string; children?: React.ReactNode }) {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = () => {
    signIn('/api/auth/callback');
  };

  return (
    <Button onClick={handleSignIn} className={className} disabled={isAuthenticated}>
      {children}
    </Button>
  );
}

export function SignOutButton({ className, children = '登出' }: { className?: string; children?: React.ReactNode }) {
  const { signOut, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);

    try {
      await signOut();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSignOut} className={className} disabled={!isAuthenticated || isLoading}>
      {isLoading ? '正在登出...' : children}
    </Button>
  );
}

export function UserAuthButton({
  className,
  signInText = '登录',
  signOutText = '登出',
}: {
  className?: string;
  signInText?: React.ReactNode;
  signOutText?: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? (
    <SignOutButton className={className}>{signOutText}</SignOutButton>
  ) : (
    <SignInButton className={className}>{signInText}</SignInButton>
  );
}
