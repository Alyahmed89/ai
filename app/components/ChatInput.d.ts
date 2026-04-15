declare module '@/app/components/ChatInput' {
  import { ReactNode } from 'react';
  
  interface ChatInputProps {
    flowId?: string;
    flowRunId?: string;
    onSend?: (responseData: any) => void;
    showHint?: boolean;
  }
  
  const ChatInput: React.FC<ChatInputProps>;
  export default ChatInput;
}