import ChatDrawer from '../components/ChatDrawer.jsx';
import SessionBar from '../components/SessionBar.jsx';
import Button from '../components/ui/Button.jsx';

export default function buildShellSlots({
  device,
  auth,
  chat,
  navigation,
  routeDefinition,
  adminPreviewAsUser,
  onNavigate,
  onThemeToggle,
  onToggleAdminPreview,
  onLogout,
}) {
  const header =
    routeDefinition.routeMeta.showHeader && auth.currentUser ? (
      <SessionBar
        shellFamily={device.shellFamily}
        shellPolicy={device.shellPolicy}
        user={auth.currentUser}
        navigation={navigation}
        theme={device.theme}
        adminPreviewAsUser={adminPreviewAsUser}
        onNavigate={onNavigate}
        onThemeToggle={onThemeToggle}
        onToggleAdminPreview={onToggleAdminPreview}
        onLogout={onLogout}
      />
    ) : null;

  const floating =
    auth.currentUser && routeDefinition.routeMeta.allowChat && !chat.chatOpen ? (
      <Button variant={device.shellFamily === 'desktop' ? 'soft' : 'primary'} size="compact" type="button" onClick={() => chat.setChatOpen(true)}>
        Chat
      </Button>
    ) : null;

  const overlay =
    auth.currentUser && routeDefinition.routeMeta.allowChat ? (
      <ChatDrawer
        viewport={device.viewport}
        open={chat.chatOpen}
        messages={chat.chatMessages}
        input={chat.chatInput}
        busy={chat.chatBusy}
        onInputChange={chat.setChatInput}
        onClose={chat.closeChat}
        onSubmit={chat.handleChatSubmit}
      />
    ) : null;

  return {
    header,
    primary: routeDefinition.slots.primary,
    secondary: routeDefinition.slots.secondary,
    floating,
    overlay,
  };
}
