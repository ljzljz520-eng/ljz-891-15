import React, { useState } from 'react';
import { Search, ShieldCheck, AlertCircle, Clock, Infinity as InfinityIcon, ShieldX } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// 前端兜底状态计算（与后端响应字段 license_status 一致）
function resolveStatus(r) {
  if (r.license_status) return r.license_status;
  if (r.is_permanent || !r.expiration) return 'permanent';
  const days = Math.ceil((new Date(r.expiration.replace(' ', 'T')).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'expired';
  if (days <= 7) return 'expiring_soon';
  return 'normal';
}

function formatDateTime(v) {
  if (!v) return '—';
  const d = new Date(typeof v === 'string' ? v.replace(' ', 'T') : v);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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
      setResult(res.data.data);
      const st = res.data.data.license_status;
      if (st === 'expired') toast.error('该授权已过期');
      else if (st === 'expiring_soon') toast('授权即将到期，请及时续费', { icon: '⚠️' });
      else toast.success('查询成功');
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
         const status = resolveStatus(result);
         const isExpired = status === 'expired';
         const isExpiring = status === 'expiring_soon';
         const isPermanent = status === 'permanent';

         const header = {
           normal: {
             border: 'border-l-sky-500',
             iconWrap: 'bg-sky-500/20 text-sky-400',
             icon: <ShieldCheck size={32} />,
             title: '查询成功',
             sub: '正版授权保障 · 授权正常可用',
             subClass: 'text-sky-300',
           },
           expiring_soon: {
             border: 'border-l-orange-400',
             iconWrap: 'bg-orange-500/20 text-orange-300',
             icon: <Clock size={32} />,
             title: '授权即将到期',
             sub: '正版授权，请及时联系上级续费',
             subClass: 'text-orange-300',
           },
           expired: {
             border: 'border-l-red-500',
             iconWrap: 'bg-red-500/20 text-red-400',
             icon: <ShieldX size={32} />,
             title: '授权已过期',
             sub: '该授权已失效，无法继续正常使用',
             subClass: 'text-red-400',
           },
           permanent: {
             border: 'border-l-blue-500',
             iconWrap: 'bg-blue-500/20 text-blue-300',
             icon: <InfinityIcon size={32} />,
             title: '查询成功',
             sub: '正版授权保障 · 长期有效',
             subClass: 'text-blue-300',
           },
         }[status];

         return (
           <div className={`glass-card p-8 border-l-4 ${header.border} animate-fade-in-up`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-full ${header.iconWrap}`}>
                  {header.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{header.title}</h3>
                  <p className={`text-sm ${header.subClass}`}>{header.sub}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                 <ResultItem label="授权QQ" value={result.qq} />
                 <ResultItem label="授权主人" value={result.owner} />
                 <ResultItem label="所属产品" value={result.product} />
                 <ResultItem label="授权上级" value={result.upline} />
                 <ResultItem label="开通时间" value={formatDateTime(result.created_at)} />
                 <ResultItem
                   label="授权有效期至"
                   value={isPermanent ? '长期有效' : formatDateTime(result.expiration)}
                 />
              </div>

              {/* 剩余天数提醒条 */}
              <div className="mt-5">
                {isPermanent ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-200 text-sm font-medium">
                    <InfinityIcon size={18} className="text-blue-300" />
                    剩余有效期：长期有效，无到期时间
                  </div>
                ) : isExpired ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium">
                    <ShieldX size={18} />
                    该授权已过期 {Math.abs(result.days_left ?? 0)} 天，当前不可用，请联系上级代理续费
                  </div>
                ) : isExpiring ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-200 text-sm font-medium animate-pulse-soft">
                    <Clock size={18} className="text-orange-300" />
                    剩余 <span className="text-orange-300 font-bold text-base px-1">{result.days_left}</span> 天到期，请尽快续费以免影响使用
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-sky-500/10 border border-sky-500/25 text-sky-200 text-sm font-medium">
                    <ShieldCheck size={18} className="text-sky-300" />
                    剩余有效期：<span className="text-sky-300 font-bold text-base px-1">{result.days_left}</span> 天
                  </div>
                )}
              </div>
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

function ResultItem({ label, value }) {
  return (
    <div className="bg-white/5 p-3 rounded-lg flex justify-between items-center group hover:bg-white/10 transition">
       <span className="text-white/60">{label}</span>
       <span className="text-sky-300 font-medium">{value}</span>
    </div>
  );
}
