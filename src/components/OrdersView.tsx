import React, { useState } from 'react';
import { ShoppingBag, Gem, Clock, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck, AlertCircle, Trash2, User } from 'lucide-react';
import { ServiceOrder, UserAccount } from '../types';

interface OrdersViewProps {
  orders: ServiceOrder[];
  allUsers?: UserAccount[];
  activeUser?: UserAccount;
  onOpenChatWithDev: (devId: number) => void;
  onCompleteOrder: (orderId: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onExploreServices: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  allUsers = [],
  activeUser,
  onOpenChatWithDev,
  onCompleteOrder,
  onDeleteOrder,
  onExploreServices,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getStatusBadge = (status: ServiceOrder['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
            <Clock className="w-3 h-3" /> পেন্ডিং
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> সেশন চলছে
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> সম্পন্ন হয়েছে
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> বাতিল
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
            <span>আমার অর্ডারের তালিকা ({orders.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            আপনার করা বুকিং ও অর্ডারসমূহ এখানে সংরক্ষিত আছে
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">আপনার কোনো অর্ডার পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              সেলার বা হোস্টের সাথে চ্যাট ও সেশন বুক করতে হোম পেজ থেকে বুক করুন।
            </p>
          </div>
          <button
            onClick={onExploreServices}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20 transition active:scale-95 cursor-pointer"
          >
            <span>সার্ভিস বা হোস্ট দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const matchedUser = order.userId
              ? allUsers.find((u) => u.id === order.userId)
              : order.userName
              ? allUsers.find((u) => u.name.toLowerCase() === order.userName.toLowerCase())
              : activeUser;
            const buyerAvatar = matchedUser?.avatar || order.userAvatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(order.userName || 'Customer')}`;
            const buyerName = matchedUser?.name || order.userName || 'গ্রাহক';

            return (
              <div
                key={order.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg hover:border-slate-700 transition"
              >
                {/* Top info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                        #{order.id}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>

                    <h3 className="font-bold text-slate-100 text-sm">
                      {order.serviceName}
                    </h3>

                    {/* Booked Client / Customer Profile Display */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
                      <img
                        src={buyerAvatar}
                        alt={buyerName}
                        className="w-7 h-7 rounded-full object-cover border border-cyan-400/60 shrink-0 bg-slate-800"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-200">
                          <span className="text-slate-400 text-[10px] font-normal">বুক করেছেন:</span>
                          <span className="text-cyan-300 truncate font-semibold">{buyerName}</span>
                          {order.userId && (
                            <span className="text-[9px] text-slate-500 font-mono">({order.userId})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>হোস্ট: <strong className="text-amber-300 font-semibold">{order.developerName}</strong></span>
                          {order.durationText && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-lime-300 bg-lime-950/60 border border-lime-500/30 px-1.5 py-0.2 rounded font-mono">
                              <Clock className="w-2.5 h-2.5 text-lime-400" />
                              <span>{order.durationText}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-cyan-300 flex items-center justify-end gap-1 bg-cyan-950/60 border border-cyan-500/30 px-2 py-1 rounded-lg">
                      <Gem className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{order.priceDiamonds}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                      {order.date}
                    </span>
                  </div>
                </div>

                {/* Requirements if any */}
                {order.requirements && (
                  <div className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">
                      অর্ডারের বিবরণ / নোট:
                    </span>
                    <p className="line-clamp-2">{order.requirements}</p>
                  </div>
                )}

              {/* Action buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>এসক্রো সুরক্ষিত</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenChatWithDev(order.developerId)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition active:scale-95 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>চ্যাট</span>
                  </button>

                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => onCompleteOrder(order.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>রিসিভড কনফার্ম</span>
                    </button>
                  )}

                  {/* Customer Order Delete / Remove Button */}
                  {onDeleteOrder && (
                    <>
                      {confirmDeleteId === order.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onDeleteOrder(order.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-400 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                          >
                            হ্যাঁ, ডিলিট
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-400 text-[11px] hover:text-white transition cursor-pointer"
                          >
                            না
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(order.id)}
                          title="অর্ডার হিস্ট্রি থেকে ডিলিট করুন"
                          className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
    </div>
  );
};
