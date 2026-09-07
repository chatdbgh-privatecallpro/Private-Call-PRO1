import React, { useState, useEffect } from 'react';
import { PaymentSettings as PaymentSettingsType, RechargePackage, SiteConfig, Developer } from '../types';
import {
  Settings,
  Gem,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Gift,
  Tag,
  Clock,
  Sparkles,
  RefreshCw,
  Zap,
  PhoneCall,
  Check
} from 'lucide-react';
import { sounds } from '../utils/sound';

interface PaymentSettingsProps {
  settings?: PaymentSettingsType;
  onSave?: (updated: PaymentSettingsType) => void;
  siteConfig?: SiteConfig;
  onUpdateSiteConfig?: (updated: SiteConfig) => void;
  rechargePackages?: RechargePackage[];
  onUpdateRechargePackages?: (packages: RechargePackage[]) => void;
  developers?: Developer[];
  onUpdateDeveloper?: (id: number, updated: Partial<Developer>) => void;
}

export const PaymentSettings: React.FC<PaymentSettingsProps> = ({
  settings,
  onSave,
  siteConfig,
  onUpdateSiteConfig,
  rechargePackages = [],
  onUpdateRechargePackages,
  developers = [],
  onUpdateDeveloper,
}) => {
  // Payment Gateway Numbers
  const [bkashNumber, setBkashNumber] = useState(settings?.bkashNumber || '01798-234567');
  const [nagadNumber, setNagadNumber] = useState(settings?.nagadNumber || '01812-345678');
  const [rocketNumber, setRocketNumber] = useState(settings?.rocketNumber || '01934-567890');
  const [upayNumber, setUpayNumber] = useState(settings?.upayNumber || '01655-432109');

  // Rate calculator
  const [diamondRateBdt, setDiamondRateBdt] = useState<number>(settings?.diamondRateBdt || 100);
  const [diamondRateDiamonds, setDiamondRateDiamonds] = useState<number>(settings?.diamondRateDiamonds || 100);

  // Welcome Bonus & Promo offers
  const [welcomeBonus, setWelcomeBonus] = useState<number>(siteConfig?.welcomeBonusDiamonds ?? 50);
  const [rechargeBonusPercent, setRechargeBonusPercent] = useState<number>(siteConfig?.rechargeBonusPercentage ?? 20);
  const [rechargeFlatBonus, setRechargeFlatBonus] = useState<number>(siteConfig?.rechargeFlatBonusDiamonds ?? 10);
  const [freeOfferEnabled, setFreeOfferEnabled] = useState<boolean>(siteConfig?.freeDiamondsOfferEnabled !== false);
  const [offerTitle, setOfferTitle] = useState<string>(
    siteConfig?.freeDiamondsOfferTitle || '🎁 নতুন একাউন্ট খুললেই ৫০ 💎 ফ্রি ওয়েলকাম বোনাস + প্রতিটি রিচার্জে ২০% অতিরিক্ত ডায়মন্ড অফার!'
  );

  // Packages list state
  const [packagesList, setPackagesList] = useState<RechargePackage[]>(rechargePackages);

  // New package form state
  const [isAddingPkg, setIsAddingPkg] = useState(false);
  const [newPkgBdt, setNewPkgBdt] = useState<number>(100);
  const [newPkgDiamonds, setNewPkgDiamonds] = useState<number>(100);
  const [newPkgBonus, setNewPkgBonus] = useState<number>(0);
  const [newPkgBadge, setNewPkgBadge] = useState<string>('');
  const [newPkgPopular, setNewPkgPopular] = useState<boolean>(false);

  // Editing package state
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [editPkgBdt, setEditPkgBdt] = useState<number>(100);
  const [editPkgDiamonds, setEditPkgDiamonds] = useState<number>(100);
  const [editPkgBonus, setEditPkgBonus] = useState<number>(0);
  const [editPkgBadge, setEditPkgBadge] = useState<string>('');
  const [editPkgPopular, setEditPkgPopular] = useState<boolean>(false);

  // Seller hourly rates local state
  const [sellerRates, setSellerRates] = useState<{ [devId: number]: number }>({});

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setBkashNumber(settings.bkashNumber || '');
      setNagadNumber(settings.nagadNumber || '');
      setRocketNumber(settings.rocketNumber || '');
      setUpayNumber(settings.upayNumber || '');
      setDiamondRateBdt(settings.diamondRateBdt || 100);
      setDiamondRateDiamonds(settings.diamondRateDiamonds || 100);
    }
  }, [settings]);

  useEffect(() => {
    if (siteConfig) {
      setWelcomeBonus(siteConfig.welcomeBonusDiamonds ?? 50);
      setRechargeBonusPercent(siteConfig.rechargeBonusPercentage ?? 20);
      setRechargeFlatBonus(siteConfig.rechargeFlatBonusDiamonds ?? 10);
      setFreeOfferEnabled(siteConfig.freeDiamondsOfferEnabled !== false);
      setOfferTitle(siteConfig.freeDiamondsOfferTitle || '');
    }
  }, [siteConfig]);

  useEffect(() => {
    if (rechargePackages && rechargePackages.length > 0) {
      setPackagesList(rechargePackages);
    }
  }, [rechargePackages]);

  useEffect(() => {
    if (developers && developers.length > 0) {
      const initialRates: { [devId: number]: number } = {};
      developers.forEach((d) => {
        initialRates[d.id] = d.diamondPerHour || 100;
      });
      setSellerRates(initialRates);
    }
  }, [developers]);

  // Save All Settings
  const handleSaveAllSettings = () => {
    sounds.playSuccess();

    // 1. Save Payment Settings
    if (onSave) {
      onSave({
        bkashNumber: bkashNumber.trim(),
        nagadNumber: nagadNumber.trim(),
        rocketNumber: rocketNumber.trim(),
        upayNumber: upayNumber.trim(),
        telegramSupportUrl: settings?.telegramSupportUrl || '',
        ratePerDiamondBdt: (diamondRateBdt || 100) / (diamondRateDiamonds || 100),
        diamondRateBdt: diamondRateBdt || 100,
        diamondRateDiamonds: diamondRateDiamonds || 100,
        supportPhone: settings?.supportPhone,
        supportWhatsapp: settings?.supportWhatsapp,
      });
    }

    // 2. Save Site Config (Welcome Bonus & Promo)
    if (onUpdateSiteConfig && siteConfig) {
      onUpdateSiteConfig({
        ...siteConfig,
        welcomeBonusDiamonds: Number(welcomeBonus) || 0,
        rechargeBonusPercentage: Number(rechargeBonusPercent) || 0,
        rechargeFlatBonusDiamonds: Number(rechargeFlatBonus) || 0,
        freeDiamondsOfferEnabled: freeOfferEnabled,
        freeDiamondsOfferTitle: offerTitle.trim(),
      });
    }

    // 3. Save Packages
    if (onUpdateRechargePackages) {
      onUpdateRechargePackages(packagesList);
    }

    // 4. Save Seller Rates
    if (onUpdateDeveloper) {
      Object.entries(sellerRates).forEach(([devIdStr, rate]) => {
        const dId = Number(devIdStr);
        onUpdateDeveloper(dId, { diamondPerHour: Number(rate) || 100, price: Number(rate) || 100 });
      });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    alert('✅ সকল পেমেন্ট, টপআপ প্যাকেজ, আইডি বোনাস ও ডায়মন্ড রেট সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // Add Package
  const handleAddNewPackage = () => {
    if (!newPkgBdt || !newPkgDiamonds) {
      alert('অনুগ্রহ করে টাকার পরিমাণ এবং ডায়মন্ডের সংখ্যা দিন!');
      return;
    }
    const newPkg: RechargePackage = {
      id: `pkg-${Date.now()}`,
      bdtPrice: Number(newPkgBdt),
      diamonds: Number(newPkgDiamonds),
      bonus: Number(newPkgBonus) || 0,
      badge: newPkgBadge.trim() || (newPkgBonus > 0 ? `+${newPkgBonus} বোনাস` : undefined),
      popular: newPkgPopular,
    };

    const updated = [...packagesList, newPkg];
    setPackagesList(updated);
    if (onUpdateRechargePackages) {
      onUpdateRechargePackages(updated);
    }

    // Reset Form
    setIsAddingPkg(false);
    setNewPkgBdt(100);
    setNewPkgDiamonds(100);
    setNewPkgBonus(0);
    setNewPkgBadge('');
    setNewPkgPopular(false);
    sounds.playDiamond();
  };

  // Start Edit Package
  const handleStartEditPackage = (pkg: RechargePackage) => {
    setEditingPkgId(pkg.id);
    setEditPkgBdt(pkg.bdtPrice);
    setEditPkgDiamonds(pkg.diamonds);
    setEditPkgBonus(pkg.bonus || 0);
    setEditPkgBadge(pkg.badge || '');
    setEditPkgPopular(pkg.popular || false);
    sounds.playClick();
  };

  // Save Edit Package
  const handleSaveEditPackage = (id: string) => {
    const updated = packagesList.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          bdtPrice: Number(editPkgBdt),
          diamonds: Number(editPkgDiamonds),
          bonus: Number(editPkgBonus) || 0,
          badge: editPkgBadge.trim() || (editPkgBonus > 0 ? `+${editPkgBonus} বোনাস` : undefined),
          popular: editPkgPopular,
        };
      }
      return p;
    });

    setPackagesList(updated);
    if (onUpdateRechargePackages) {
      onUpdateRechargePackages(updated);
    }
    setEditingPkgId(null);
    sounds.playSuccess();
  };

  // Delete Package
  const handleDeletePackage = (id: string) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই টপআপ প্যাকেজটি ডিলিট করতে চান?')) return;
    const updated = packagesList.filter((p) => p.id !== id);
    setPackagesList(updated);
    if (onUpdateRechargePackages) {
      onUpdateRechargePackages(updated);
    }
    sounds.playCancel();
  };

  // Reset Packages to Default Presets
  const handleResetDefaultPackages = () => {
    if (!confirm('টপআপ প্যাকেজগুলো কি স্ট্যান্ডার্ড ডিফল্ট তালিকায় রিসেট করতে চান?')) return;
    const defaultPkgs: RechargePackage[] = [
      { id: 'pkg-1', diamonds: 100, bonus: 0, bdtPrice: 100, badge: 'স্টার্টার' },
      { id: 'pkg-2', diamonds: 300, bonus: 30, bdtPrice: 300, popular: true, badge: '+৩০ বোনাস' },
      { id: 'pkg-3', diamonds: 500, bonus: 75, bdtPrice: 500, badge: '+৭৫ বোনাস' },
      { id: 'pkg-4', diamonds: 1000, bonus: 200, bdtPrice: 1000, badge: '🔥 ভিআইপি অফার (+২০০)' },
      { id: 'pkg-5', diamonds: 2500, bonus: 600, bdtPrice: 2500, badge: '👑 মেগা সেভার (+৬০০)' },
    ];
    setPackagesList(defaultPkgs);
    if (onUpdateRechargePackages) {
      onUpdateRechargePackages(defaultPkgs);
    }
    sounds.playSuccess();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-6 shadow-2xl animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Gem className="w-4 h-4 animate-bounce" />
            </div>
            <h3 className="text-base font-black text-white">
              💎 টপআপ প্যাকেজ, ডায়মন্ড রেট ও অফার কন্ট্রোলার
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ইউজার কত টাকায় কত ডায়মন্ড পাবে, আইডি খুললে কত ফ্রি ডায়মন্ড পাবে এবং পোস্টের ঘণ্টা প্রতি ডায়মন্ড রেট এখানে নির্ধারণ করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAllSettings}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{savedSuccess ? '✅ সংরক্ষিত হয়েছে' : 'সকল পরিবর্তন সেভ করুন'}</span>
        </button>
      </div>

      {/* ১. 💎 কাস্টম টপআপ প্যাকেজ ম্যানেজার (Recharge Packages Management) */}
      <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-black text-amber-300 flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <span>১. ডায়মন্ড টপআপ প্যাকেজ তালিকা (ইউজাররা প্রোফাইলে দেখতে পাবে)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              আপনি নিজের ইচ্ছামত যেকোনো টাকার প্যাকেজে নির্দিষ্ট ডায়মন্ড ও বোনাস সেট করতে পারেন।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaultPackages}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              title="ডিফল্ট প্যাকেজে রিসেট করুন"
            >
              <RefreshCw className="w-3 h-3" />
              <span>ডিফল্ট প্যাকেজ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAddingPkg(!isAddingPkg);
                sounds.playClick();
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingPkg ? 'ফর্ম বন্ধ' : '+ নতুন প্যাকেজ তৈরি'}</span>
            </button>
          </div>
        </div>

        {/* Add New Package Drawer */}
        {isAddingPkg && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>নতুন টপআপ প্যাকেজ যোগ করুন</span>
              </span>
              <span className="text-[10px] text-slate-400">টাকা ও ডায়মন্ড নির্ধারণ করুন</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">টাকার পরিমাণ (BDT ৳):</label>
                <input
                  type="number"
                  value={newPkgBdt}
                  onChange={(e) => setNewPkgBdt(Number(e.target.value))}
                  placeholder="যেমন: 100"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">মূল ডায়মন্ড (💎):</label>
                <input
                  type="number"
                  value={newPkgDiamonds}
                  onChange={(e) => setNewPkgDiamonds(Number(e.target.value))}
                  placeholder="যেমন: 100"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">অতিরিক্ত বোনাস (💎):</label>
                <input
                  type="number"
                  value={newPkgBonus}
                  onChange={(e) => setNewPkgBonus(Number(e.target.value))}
                  placeholder="যেমন: 20 বা 0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-300 block mb-1">ব্যাজ / টাইটেল (ঐচ্ছিক):</label>
                <input
                  type="text"
                  value={newPkgBadge}
                  onChange={(e) => setNewPkgBadge(e.target.value)}
                  placeholder="যেমন: 🔥 ধামাকা অফার"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPkgPopular}
                  onChange={(e) => setNewPkgPopular(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span>জনপ্রিয় (Popular Tag) হিসেবে হাইলাইট করুন</span>
              </label>

              <button
                type="button"
                onClick={handleAddNewPackage}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>তালিকায় যুক্ত করুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Existing Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {packagesList.map((pkg) => {
            const isEditing = editingPkgId === pkg.id;

            if (isEditing) {
              return (
                <div
                  key={pkg.id}
                  className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-3.5 space-y-2.5 shadow-xl animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-300">প্যাকেজ এডিট করুন</span>
                    <button
                      type="button"
                      onClick={() => setEditingPkgId(null)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      বাতিল
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">টাকা (৳):</span>
                      <input
                        type="number"
                        value={editPkgBdt}
                        onChange={(e) => setEditPkgBdt(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">ডায়মন্ড (💎):</span>
                      <input
                        type="number"
                        value={editPkgDiamonds}
                        onChange={(e) => setEditPkgDiamonds(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-amber-300 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">বোনাস (💎):</span>
                      <input
                        type="number"
                        value={editPkgBonus}
                        onChange={(e) => setEditPkgBonus(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-emerald-300 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">ব্যাজ টেক্সট:</span>
                      <input
                        type="text"
                        value={editPkgBadge}
                        onChange={(e) => setEditPkgBadge(e.target.value)}
                        placeholder="+বোনাস"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={editPkgPopular}
                      onChange={(e) => setEditPkgPopular(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500"
                    />
                    <span>জনপ্রিয় অফার</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleSaveEditPackage(pkg.id)}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
                  >
                    সেভ করুন
                  </button>
                </div>
              );
            }

            return (
              <div
                key={pkg.id}
                className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3.5 transition shadow-md flex flex-col justify-between"
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                    🔥 POPULAR
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-black text-amber-300 block font-mono">
                        ৳ {pkg.bdtPrice}
                      </span>
                      <span className="text-[11px] text-slate-300 font-bold">
                        {pkg.diamonds} 💎 ডায়মন্ড
                      </span>
                    </div>

                    <div className="text-right">
                      {pkg.bonus > 0 ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">
                          +{pkg.bonus} 💎 বোনাস
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">নো বোনাস</span>
                      )}
                    </div>
                  </div>

                  {pkg.badge && (
                    <div className="mt-1.5">
                      <span className="inline-block text-[9px] font-semibold bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                        {pkg.badge}
                      </span>
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-slate-400 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/80 font-mono">
                    মোট জমা হবে: <strong className="text-lime-300 font-black">{pkg.diamonds + (pkg.bonus || 0)} 💎</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleStartEditPackage(pkg)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition"
                    title="প্যাকেজ এডিট করুন"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>এডিট</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePackage(pkg.id)}
                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1 transition"
                    title="প্যাকেজ ডিলিট করুন"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ২. 🎁 নতুন আইডি খোলার ফ্রি ডায়মন্ড বোনাস ও রিচার্জ অফার (Signup Welcome Bonus & Offers) */}
      <div className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-emerald-400 flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" />
              <span>২. নতুন আইডি খোলার ওয়েলকাম বোনাস ও ফ্রি ডায়মন্ড অফার</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              যেকোনো ইউজার নতুন একাউন্ট/আইডি খুললে স্বয়ংক্রিয়ভাবে কত ডায়মন্ড ফ্রি পাবে তা নির্ধারণ করুন।
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={freeOfferEnabled}
              onChange={(e) => setFreeOfferEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <span>{freeOfferEnabled ? '🟢 বোনাস অফার চালু' : '⚪ বোনাস অফার বন্ধ'}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Welcome Bonus for new signups */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>আইডি খোলার ফ্রি বোনাস (💎):</span>
            </label>
            <p className="text-[10px] text-slate-400">নতুন সাইন আপে সাথে সাথে জমা হবে</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={welcomeBonus}
                onChange={(e) => setWelcomeBonus(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-black font-mono text-amber-300 focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs font-bold text-slate-300 font-mono">💎</span>
            </div>
          </div>

          {/* Recharge Percentage Bonus */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>রিচার্জ অতিরিক্ত বোনাস (%):</span>
            </label>
            <p className="text-[10px] text-slate-400">প্রতিটি রিচার্জে অতিরিক্ত বোনাস</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={rechargeBonusPercent}
                onChange={(e) => setRechargeBonusPercent(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-black font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-bold text-slate-300 font-mono">%</span>
            </div>
          </div>

          {/* Flat Bonus Diamonds */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1">
            <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>ফ্ল্যাট রিচার্জ বোনাস (💎):</span>
            </label>
            <p className="text-[10px] text-slate-400">রিচার্জের সাথে অতিরিক্ত যোগ হবে</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={rechargeFlatBonus}
                onChange={(e) => setRechargeFlatBonus(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-black font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs font-bold text-slate-300 font-mono">💎</span>
            </div>
          </div>
        </div>

        {/* Offer Notice Title Banner */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">
            হোমপেজ ও ব্যানারে প্রদর্শিত অফার টেক্সট:
          </label>
          <input
            type="text"
            value={offerTitle}
            onChange={(e) => setOfferTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            placeholder="অফার ব্যানার টেক্সট..."
          />
        </div>
      </div>

      {/* ৩. 🎙️ সেলার ও পোস্টের প্রতি ঘণ্টা ডায়মন্ড রেট (Post/Session Hourly Diamond Rates) */}
      <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="border-b border-slate-800 pb-3">
          <h4 className="text-sm font-black text-indigo-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>৩. হোস্ট ও সেলার পোস্টের প্রতি ঘণ্টা ডায়মন্ড রেট (💎/ঘণ্টা)</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            হোমপেজে সেলারদের পোস্ট ও লাইভ চ্যাট/ভয়েস সেশনের প্রতি ঘণ্টার রেট কত ডায়মন্ড হবে তা সরাসরি নির্ধারণ করুন (যেমন: ১০০, ২০০, ৫০০ 💎)।
          </p>
        </div>

        {developers.length === 0 ? (
          <p className="text-xs text-slate-500">কোনো সেলার তালিকাভুক্ত নেই।</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {developers.map((dev) => {
              const currentRate = sellerRates[dev.id] !== undefined ? sellerRates[dev.id] : (dev.diamondPerHour || 100);
              return (
                <div
                  key={dev.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={dev.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dev.avatarSeed || dev.name}`}
                      alt={dev.name}
                      className="w-10 h-10 rounded-xl bg-slate-950 border border-indigo-500/40 object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-black text-white block truncate">{dev.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{dev.service}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      value={currentRate}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSellerRates((prev) => ({ ...prev, [dev.id]: val }));
                      }}
                      className="w-20 bg-slate-950 border border-indigo-500/40 rounded-lg px-2 py-1 text-xs font-black text-lime-300 font-mono text-center focus:outline-none focus:border-indigo-400"
                    />
                    <span className="text-[10px] text-slate-400 font-mono font-bold">💎/ঘণ্টা</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ৪. 📱 পেমেন্ট গেটওয়ে নম্বর ও সার্বিক ডায়মন্ড এক্সচেঞ্জ রেট */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="border-b border-slate-800 pb-3">
          <h4 className="text-sm font-black text-slate-200 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <span>৪. পেমেন্ট গেটওয়ে নম্বর সেটআপ (Send Money Numbers)</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            কাস্টমাররা যে নম্বরে বিকাশ, নগদ, রকেট ও উপায়-এ টাকা পাঠাবে সেই পার্সোনাল নম্বরসমূহ।
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-pink-400 font-semibold block mb-1">bKash নম্বর:</label>
            <input
              type="text"
              value={bkashNumber}
              onChange={(e) => setBkashNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-pink-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-orange-400 font-semibold block mb-1">Nagad নম্বর:</label>
            <input
              type="text"
              value={nagadNumber}
              onChange={(e) => setNagadNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-purple-400 font-semibold block mb-1">Rocket নম্বর:</label>
            <input
              type="text"
              value={rocketNumber}
              onChange={(e) => setRocketNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-sky-400 font-semibold block mb-1">Upay নম্বর:</label>
            <input
              type="text"
              value={upayNumber}
              onChange={(e) => setUpayNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Global Conversion Rate Ratio */}
        <div className="border-t border-slate-800/80 pt-3">
          <label className="text-xs font-semibold text-amber-300 block mb-1">
            সার্বিক ডায়মন্ড বিনিময় অনুপাত (Global Conversion Calculator):
          </label>
          <div className="flex gap-3 items-center bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 block mb-1">টাকা (BDT ৳):</span>
              <input
                type="number"
                value={diamondRateBdt}
                onChange={(e) => setDiamondRateBdt(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
              />
            </div>
            <span className="text-lg font-black text-emerald-400 font-mono pt-4">=</span>
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 block mb-1">ডায়মন্ড (💎):</span>
              <input
                type="number"
                value={diamondRateDiamonds}
                onChange={(e) => setDiamondRateDiamonds(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-amber-300 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSaveAllSettings}
        className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3 rounded-2xl text-xs sm:text-sm transition shadow-xl shadow-emerald-500/25 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        <span>{savedSuccess ? '✅ সেটিংস সফলভাবে সংরক্ষিত হয়েছে!' : 'সব সেটিংস সংরক্ষণ করুন (Save All)'}</span>
      </button>
    </div>
  );
};
