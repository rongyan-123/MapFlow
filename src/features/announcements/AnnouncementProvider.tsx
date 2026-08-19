import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '../identity/IdentityContext';
import { getAnnouncements, markAnnouncementRead } from './announcementsClient';
import AnnouncementDialog from './AnnouncementDialog';

/**
 * 登录后自动弹出未读公告，逐条「知道了」标记已读，全部读完后关闭。
 * 手动关闭（点遮罩）后同会话不再自动弹出，导航「公告」按钮仍可查看全部。
 */
export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const { session } = useIdentity();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const handledSessionPlayerIdRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ['announcements', session?.account.playerId ?? null],
    queryFn: getAnnouncements,
    enabled: session !== null,
    staleTime: 60 * 1000,
    retry: false,
  });
  const markRead = useMutation({
    mutationFn: (announcementId: string) =>
      markAnnouncementRead(announcementId, session?.csrfToken ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['announcements', session?.account.playerId ?? null],
      });
    },
  });

  // 会话切换（登录 / 换账号 / 退出）时重置「已手动关闭」标记。
  // 不能放在渲染期间直接 setState（React 反模式），必须用 useEffect。
  useEffect(() => {
    const playerId = session?.account.playerId ?? null;
    if (handledSessionPlayerIdRef.current === playerId) return;
    handledSessionPlayerIdRef.current = playerId;
    setDismissed(false);
  }, [session]);

  const unreadIds = query.data?.unreadIds ?? [];
  const currentUnreadId = unreadIds[0] ?? null;
  // 标记已读请求期间保持弹窗打开（按钮禁用），避免闪烁与重复提交。
  const shouldShow =
    session !== null && !dismissed && currentUnreadId !== null;
  const currentAnnouncement =
    query.data?.items.find((item) => item.announcementId === currentUnreadId) ??
    null;

  const handleDismiss = () => {
    if (markRead.isPending || currentUnreadId === null) return;
    markRead.mutate(currentUnreadId);
  };

  const handleClose = () => {
    if (markRead.isPending) return;
    setDismissed(true);
  };

  return (
    <>
      {children}
      {shouldShow && currentAnnouncement && (
        <AnnouncementDialog
          announcementId={currentAnnouncement.announcementId}
          title={currentAnnouncement.title}
          content={currentAnnouncement.content}
          remaining={unreadIds.length}
          pending={markRead.isPending}
          onDismiss={handleDismiss}
          onClose={handleClose}
        />
      )}
    </>
  );
}
