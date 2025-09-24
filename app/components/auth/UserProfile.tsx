import { useAuth } from '~/lib/hooks/useAuth';

export function UserProfile({ className }: { className?: string }) {
  const { isAuthenticated, userInfo, isLoading } = useAuth();

  if (!isAuthenticated) {
    return <div className={className}>未登录</div>;
  }

  if (isLoading) {
    return <div className={className}>加载中...</div>;
  }

  if (!userInfo) {
    return <div className={className}>无法获取用户信息</div>;
  }

  return (
    <div className={className}>
      {userInfo.picture && (
        <img
          src={userInfo.picture}
          alt={userInfo.name || userInfo.username || '用户头像'}
          className="size-10 rounded-full mb-2"
        />
      )}
      <h3 className="text-lg font-semibold">{userInfo.name || userInfo.username || '用户'}</h3>
      {userInfo.email && <p className="text-sm text-gray-600">{userInfo.email}</p>}
    </div>
  );
}
