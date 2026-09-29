import React, { useState } from 'react';
import { Search, ShieldCheck, AlertCircle, Clock, Infinity as InfinityIcon, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

function formatDateTime(v) {
  if (!v) return '-';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d)) return v;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function QueryPage() {
  const [qq, setQq] = useState('');
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleQuery = async (e) => {
    e.preventDefault();
    if (!qq || !owner) {
      toast.error('请输入完整查询信息');
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await axios.get(`/api/license/query?qq=${qq}&owner=${owner}`);
      const d = res.data.data;
      setResult(d);
      if (d.is_expired) {
        toast.error('该授权已过期，不可正常使用');
      } else if (d.is_permanent) {
        toast.success('查询成功：长期有效授权');
      } else if (d.days_remaining <= 7) {
        toast(`授权剩余 ${d.days_remaining} 天，请及时续费`);
      } else {
        toast.success('查询成功');
      }
    } catch (err) {
       if(err.response && err.response.data && err.response.data.reasons) {
           setError(err.response.data);
       } else {
           toast.error('查询服务异常');
       }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pt-10">
       <div className="text-center mb-12 relative">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-sky-500/30 rounded-full blur-[60px] -z-10"></div>
         <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-200 via-white to-sky-200 mb-4 tracking-tight drop-shadow-[0_0_15px_rgba(14,165,233,0.3)]">
           正版授权查询
         </h1>
         <div className="flex justify-center items-center gap-2 text-sky-200/60 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            实时联网验证中
         </div>
       </div>

       <div className="glass-card p-1 pb-1 mb-8 relative group">
         <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
         <div className="relative bg-[#0f172a]/90 backdrop-blur-xl rounded-xl p-8 border border-white/10">
             <form onSubmit={handleQuery} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider pl-1">授权QQ</label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      value={qq}
                      onChange={(e) => setQq(e.target.value)}
                      className="glass-input w-full pl-11 h-12 text-lg transition-all focus:bg-white/10"
                      placeholder="请输入QQ号码"
                    />
                    <Search className="absolute left-3.5 top-3.5 text-white/30 w-5 h-5 group-focus-within/input:text-sky-400 transition" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider pl-1">授权主人</label>
                  <div className="relative group/input">
                    <input
                      type="text"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="glass-input w-full pl-11 h-12 text-lg transition-all focus:bg-white/10"
                      placeholder="请输入主人名称"
                    />
                    <ShieldCheck className="absolute left-3.5 top-3.5 text-white/30 w-5 h-5 group-focus-within/input:text-sky-400 transition" />
                  </div>
                </div>

                <button
                   type="submit"
                   disabled={loading}
                   className="w-full tech-button h-12 text-lg font-bold tracking-wide shadow-[0_4px_20px_rgba(14,165,233,0.3)] hover:shadow-[0_8px_30px_rgba(14,165,233,0.4)] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      正在验证...
                    </span>
                  ) : <span className="flex items-center justify-center gap-2">立即查询 <ShieldCheck size={18}/></span>}
                </button>
             </form>
         </div>
       </div>

       {result && (() => {
         const isExpired = result.is_expired;
         const isPermanent = result.is_permanent;
         const isExpiring = !isExpired && !isPermanent && result.days_remaining !== null && result.days_remaining <= 7;
         const days = result.days_remaining;

         // 卡片主题：正常=企业蓝/绿，临期=橙色点缀，过期=红/橙强警示
         const theme = isExpired
           ? { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400', title: '授权已过期', sub: '该授权已超出有效期', icon: <AlertTriangle size={32} /> }
           : isExpiring
             ? { border: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400', title: '授权即将到期', sub: '请尽快联系上级续费', icon: <Clock size={32} /> }
             : { border: 'border-l-green-500', badge: 'bg-green-500/20 text-green-400', title: '查询成功', sub: '正版授权保障', icon: <ShieldCheck size={32} /> };

         return (
           <div className={`glass-card p-8 border-l-4 ${theme.border} animate-fade-in-up`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-full ${theme.badge}`}>
                  {theme.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{theme.title}</h3>
                  <p className={`text-sm ${isExpired ? 'text-red-400' : isExpiring ? 'text-orange-400' : 'text-green-400'}`}>{theme.sub}</p>
                </div>
              </div>

              {/* 剩余天数提示横幅 */}
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${
                isExpired
                  ? 'bg-red-500/10 border-red-500/25'
                  : isExpiring
                    ? 'bg-orange-500/10 border-orange-500/25'
                    : isPermanent
                      ? 'bg-sky-500/10 border-sky-500/25'
                      : 'bg-green-500/10 border-green-500/20'
              }`}>
                {isPermanent ? (
                  <>
                    <InfinityIcon className="w-8 h-8 text-sky-300 shrink-0" />
                    <div>
                      <div className="text-lg font-bold text-sky-200">长期有效</div>
                      <div className="text-xs text-white/50">该授权无到期时间，可永久使用</div>
                    </div>
                  </>
                ) : isExpired ? (
                  <>
                    <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
                    <div>
                      <div className="text-lg font-bold text-red-300">已过期 {Math.abs(days)} 天</div>
                      <div className="text-xs text-white/50">授权已停止服务，请立即联系上级代理续费</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Clock className={`w-8 h-8 shrink-0 ${isExpiring ? 'text-orange-300' : 'text-green-300'}`} />
                    <div>
                      <div className={`text-lg font-bold ${isExpiring ? 'text-orange-200' : 'text-green-200'}`}>
                        剩余 <span className="text-2xl mx-0.5">{days}</span> 天
                      </div>
                      <div className="text-xs text-white/50">
                        {days === 0 ? '授权将于今日到期，请尽快续费' : isExpiring ? '授权将在 7 天内到期，请注意续费' : '授权有效期内，可正常使用'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                 <ResultItem label="授权QQ" value={result.qq} />
                 <ResultItem label="授权主人" value={result.owner} />
                 <ResultItem label="所属产品" value={result.product} />
                 <ResultItem label="授权上级" value={result.upline} />
                 <ResultItem label="开通时间" value={formatDateTime(result.created_at)} />
                 <ResultItem
                   label="授权有效期"
                   value={isPermanent ? '长期有效' : formatDateTime(result.expiration)}
                   valueClass={isPermanent ? 'text-sky-300' : isExpired ? 'text-red-400' : isExpiring ? 'text-orange-300' : 'text-sky-300'}
                 />
              </div>

              {isExpired && (
                <div className="mt-5 flex items-start gap-2 text-xs text-orange-300/90 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>风险提示：过期授权不属于正常可用状态，请勿继续使用或对外出售，以免造成损失。</span>
                </div>
              )}
           </div>
         );
       })()}

       {error && (
         <div className="glass-card p-8 border-l-4 border-l-red-500 animate-pulse-soft">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-500/20 rounded-full text-red-400">
                <AlertCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">查询失败</h3>
                <p className="text-red-400 text-sm">{error.message}</p>
              </div>
            </div>
            
            <div className="bg-red-500/10 p-4 rounded-lg">
               <p className="text-white/80 mb-2 font-bold">未查询到授权信息的原因如下：</p>
               <ul className="list-disc list-inside space-y-1 text-white/60">
                 {error.reasons.map((r, i) => (
                   <li key={i}>{r}</li>
                 ))}
               </ul>
            </div>
         </div>
       )}
    </div>
  );
}

function ResultItem({ label, value, valueClass = 'text-sky-300' }) {
  return (
    <div className="bg-white/5 p-3 rounded-lg flex justify-between items-center group hover:bg-white/10 transition">
       <span className="text-white/60">{label}</span>
       <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
