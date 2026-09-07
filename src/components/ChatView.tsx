import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  ArrowLeft,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  Paperclip,
  Image as ImageIcon,
  Mic,
  X,
  Maximize2
} from 'lucide-react';
import { ChatMessage, Developer, ServiceOrder, UserAccount, SiteConfig } from '../types';
import { SellerChatList } from './SellerChatList';
import { ChatRoom } from './ChatRoom';
import { sounds } from '../utils/sound';

interface ChatViewProps {
  messages: ChatMessage[];
  orders: ServiceOrder[];
  onSendMessage: (
    text: string,
    developerId?: number,
    attachment?: ChatMessage['attachment']
  ) => void;
  activeDeveloper: Developer | null;
  onClearActiveDeveloper: () => void;
  allDevelopers: Developer[];
  onSelectDeveloper: (dev: Developer | null) => void;
  onHireDeveloper: (dev: Developer) => void;
  telegramSupportUrl?: string;
  isAdmin?: boolean;
  currentUser?: UserAccount | null;
  onOpenProfile?: () => void;
  siteConfig?: SiteConfig;
  onUpdateUser?: (userId: string, data: Partial<UserAccount>) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  orders,
  onSendMessage,
  activeDeveloper,
  onClearActiveDeveloper,
  allDevelopers,
  onSelectDeveloper,
  onHireDeveloper,
  isAdmin = false,
  currentUser,
  onOpenProfile,
  siteConfig,
  onUpdateUser,
}) => {
  // Support Bot Chat State when activeDeveloper is null and user opens general support
  const [inGeneralSupport, setInGeneralSupport] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (inGeneralSupport) {
      scrollToBottom();
    }
  }, [messages, isTyping, inGeneralSupport]);

  // If user selected a developer, show the dedicated ChatRoom!
  if (activeDeveloper) {
    return (
      <ChatRoom
        activeSeller={activeDeveloper}
        messages={messages}
        onSendMessage={onSendMessage}
        onSessionEnd={() => {
          onClearActiveDeveloper();
          setInGeneralSupport(false);
        }}
        onBackToList={() => {
          onClearActiveDeveloper();
          setInGeneralSupport(false);
        }}
        onHireDeveloper={onHireDeveloper}
        isAdmin={isAdmin}
        currentUser={currentUser}
        onOpenProfile={onOpenProfile}
        siteConfig={siteConfig}
        onUpdateUser={onUpdateUser}
      />
    );
  }

  // If user clicked General AI Support Bot
  if (inGeneralSupport) {
    const generalMessages = messages.filter((m) => {
      if (m.developerId && m.developerId !== 0) return false;
      if (isAdmin) return true;
      if (m.isPublic) return true;
      if (!currentUser) return true;
      if (m.senderUserId || m.receiverUserId || (m.participants && m.participants.length > 0)) {
        const isSender = m.senderUserId === currentUser.id;
        const isReceiver = m.receiverUserId === currentUser.id;
        const inParticipants = m.participants ? m.participants.includes(currentUser.id) : false;
        return isSender || isReceiver || inParticipants;
      }
      return true;
    });

    const handleSendGeneral = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const text = inputText.trim();
      if (!text) return;
      sounds.playSend();
      onSendMessage(text, undefined);
      setInputText('');

      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        sounds.playReceive();
      }, 1000);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const imgUrl = event.target?.result as string;
        if (imgUrl) {
          sounds.playSend();
          onSendMessage('🖼️ স্ক্রিনশট বা ছবি পাঠানো হয়েছে', undefined, {
            type: 'image',
            url: imgUrl,
            name: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
      <div className="flex flex-col h-[calc(100vh-140px)] max-h-[750px] bg-slate-950/90 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl animate-fadeIn relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Image Preview Modal */}
        {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
            <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-3 overflow-hidden shadow-2xl">
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewImage}
                alt="Attachment Preview"
                className="w-full max-h-[75vh] object-contain rounded-2xl"
              />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-3.5 flex items-center justify-between shadow-lg sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setInGeneralSupport(false);
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-xs sm:text-sm text-slate-100">
                  AI লাইভ সাপোর্ট ডেস্ক
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[10px] text-slate-400">
                ২৪/৭ ইন-অ্যাপ অটোমেটেড রেসপন্স ও ডায়মন্ড সহায়তা
              </p>
            </div>
          </div>

          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-xl font-bold border border-emerald-500/30">
            🟢 অনলাইন
          </span>
        </div>

        {/* General Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          {generalMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isAdminMsg = msg.sender === 'admin';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 animate-fadeIn`}
              >
                <div className="flex items-end gap-1.5 max-w-[85%]">
                  {!isUser && (
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0 mb-1 text-[10px] text-cyan-400">
                      {isAdminMsg ? '🛡️' : '🤖'}
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md space-y-1.5 ${
                      isUser
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                        : isAdminMsg
                        ? 'bg-gradient-to-r from-purple-950 to-indigo-950 border border-purple-500/40 text-purple-100 rounded-bl-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none'
                    }`}
                  >
                    {isAdminMsg && (
                      <div className="text-[10px] font-bold text-purple-300 pb-1 border-b border-purple-500/20">
                        🛡️ অ্যাডমিন সাপোর্ট ডেস্ক
                      </div>
                    )}
                    {msg.text && <p className="whitespace-pre-line">{msg.text}</p>}

                    {/* Image preview in chat */}
                    {msg.attachment?.type === 'image' && (
                      <div
                        className="rounded-xl overflow-hidden border border-slate-700/60 my-1 relative group cursor-pointer"
                        onClick={() => setPreviewImage(msg.attachment!.url)}
                      >
                        <img
                          src={msg.attachment.url}
                          alt="Attachment"
                          className="w-full max-h-48 object-cover rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-500 px-1 font-mono">
                  <span>{msg.timestamp}</span>
                  {isUser && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px]">
                🤖
              </div>
              <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-2xl rounded-bl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleSendGeneral} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition cursor-pointer shrink-0"
              title="স্ক্রিনশট সংযুক্ত করুন"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="সাপোর্টে মেসেজ লিখুন..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold transition active:scale-95 disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Default: Seller Chat List (Inbox)
  return (
    <SellerChatList
      sellers={allDevelopers}
      orders={orders}
      messages={messages}
      onSelectSeller={(seller) => {
        onSelectDeveloper(seller);
      }}
      onOpenSupportBot={() => setInGeneralSupport(true)}
      isAdmin={isAdmin}
      activeSellerId={activeDeveloper ? (activeDeveloper as Developer).id : null}
    />
  );
};
