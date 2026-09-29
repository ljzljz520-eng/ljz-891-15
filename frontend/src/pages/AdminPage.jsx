import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, Clock, AlertTriangle, Infinity as InfinityIcon } from 'lucide-react';
import Modal from '../components/Modal';

// 七天内到期视为临期，与后端 EXPIRING_SOON_DAYS 保持一致
const REMIND_DAYS = 7;

// 计算授权状态：normal(正常) / expiring_soon(七天内到期) / expired(已过期) / permanent(长期有效)
export function getLicenseStatus(item) {
  if (Number(item.is_permanent) === 1 || !item.expiration_date) return 'permanent';
  const diffDays = Math.ceil((new Date(String(item.expiration_date).replace(' ', 'T')).getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return 'expired';
  if (diffDays <= REMIND_DAYS) return 'expiring_soon';
  return 'normal';
}

// 剩余天数（长期有效 / 已过期语义由调用方处理）
export function getDaysLeft(item) {
  return Math.ceil((new Date(String(item.expiration_date).replace(' ', 'T')).getTime() - Date.now()) / 86400000);
}

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | expiring | expired | permanent

  const [newLicense, setNewLicense] = useState({
    qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: '', is_permanent: false
  });

  // Modal State
  const [deleteId, setDeleteId] = useState(null);
  const [deleteType, setDeleteType] = useState('license'); // 'license' or 'admin'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Admin Management State
  const [activeTab, setActiveTab] = useState('license'); // 'license' | 'admin'
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });

  useEffect(() => {
    if (token) {
        fetchLicenses();
        fetchAdmins();
    }
  }, [token]);

  // 各状态的数量（基于全量数据，与搜索关键词无关）
  const statusCounts = useMemo(() => {
    const counts = { all: licenses.length, normal: 0, expiring: 0, expired: 0, permanent: 0 };
    licenses.forEach(l => {
      const s = getLicenseStatus(l);
      if (s === 'expiring_soon') counts.expiring += 1;
      else counts[s] += 1;
    });
    return counts;
  }, [licenses]);

  useEffect(() => {
    let list = licenses;
    if (statusFilter !== 'all') {
      list = list.filter(l => {
        const s = getLicenseStatus(l);
        if (statusFilter === 'expiring') return s === 'expiring_soon';
        return s === statusFilter;
      });
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(l =>
        l.qq.includes(lower) ||
        l.owner_name.toLowerCase().includes(lower) ||
        l.product_name.toLowerCase().includes(lower)
      );
    }
    setFilteredLicenses(list);
  }, [searchTerm, statusFilter, licenses]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('auth_token', res.data.token);
      setToken(res.data.token);
      toast.success('欢迎回来，管理员');
    } catch (err) {
      toast.error('登录失败: 用户名或密码错误');
    }
  };

  const fetchLicenses = async () => {
    try {
      const res = await axios.get('/api/license/list');
      setLicenses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === 'license') {
          await axios.post('/api/license/create', newLicense);
          toast.success('授权添加成功');
          setNewLicense({ qq: '', owner_name: '', product_name: '', upline: '官方', expiration_date: '', is_permanent: false });
          fetchLicenses();
      } else {
          await axios.post('/api/auth/create', newAdmin);
          toast.success('管理员添加成功');
          setNewAdmin({ username: '', password: '' });
          fetchAdmins();
      }
    } catch (err) {
      toast.error('添加失败：' + (err.response?.data?.message || '网络错误'));
    }
  };

  const fetchAdmins = async () => {
      try {
          const res = await axios.get('/api/auth/list');
          setAdmins(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const handleCreateAdmin = async (e) => {
      // Merged into handleCreate logic above based on activeTab
  };

  const confirmDelete = (id, type = 'license') => {
    setDeleteId(id);
    setDeleteType(type);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      if (deleteType === 'license') {
          await axios.post('/api/license/delete', { id: deleteId });
          toast.success('已删除该授权');
          fetchLicenses();
      } else {
          await axios.post('/api/auth/delete', { id: deleteId });
          toast.success('已删除该管理员');
          fetchAdmins();
      }
    } catch(err) {
      toast.error('删除失败');
    }
  };

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md glass-card p-10 animate-fade-in-up">
           <div className="text-center mb-8">
             <div className="w-16 h-16 bg-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400">
               <Lock size={32} />
             </div>
             <h2 className="text-2xl font-bold text-white">管理员登录</h2>
             <p className="text-white/40 mt-2 text-sm">请输入您的管理凭证以继续</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-5">
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">账号</label>
               <div className="relative group">
                 <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="Administrator" />
                 <User className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <div>
               <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">密码</label>
               <div className="relative group">
                 <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="glass-input w-full pl-10 h-11" placeholder="••••••••" />
                 <Lock className="absolute left-3 top-3.5 w-4 h-4 text-white/30 group-focus-within:text-sky-400 transition" />
               </div>
             </div>
             <button type="submit" className="tech-button w-full mt-2 !py-3 !text-sm tracking-widest">登录</button>
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-sky-300">
            授权管理中心
          </h1>
          <p className="text-white/40 mt-1">System Administration Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative">
             <input 
                type="text" 
                placeholder="搜索QQ、主人或产品..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="glass-input pl-10 pr-4 py-2 w-64 text-sm"
             />
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
           </div>
           <button onClick={() => {localStorage.removeItem('auth_token'); setToken(null);}} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition border border-white/5 hover:border-red-500/30">
             退出登录
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Add Form */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 sticky top-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                <div className="p-1.5 bg-sky-500/20 rounded-lg text-sky-400">
                  <Plus className="w-4 h-4"/>
                </div>
                {activeTab === 'license' ? '新增授权' : '新增管理员'}
              </h3>
              <form onSubmit={handleCreate} className="space-y-4">
                 {activeTab === 'license' ? (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权QQ</label>
                            <input required className="glass-input w-full" placeholder="输入QQ号" value={newLicense.qq} onChange={e=>setNewLicense({...newLicense, qq:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权主人</label>
                            <input required className="glass-input w-full" placeholder="输入名称" value={newLicense.owner_name} onChange={e=>setNewLicense({...newLicense, owner_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">所属产品</label>
                            <input required className="glass-input w-full" placeholder="例如：授权平台" value={newLicense.product_name} onChange={e=>setNewLicense({...newLicense, product_name:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">授权上级</label>
                            <input required className="glass-input w-full" placeholder="默认：官方" value={newLicense.upline} onChange={e=>setNewLicense({...newLicense, upline:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">过期时间</label>
                            <div className="flex items-center justify-between gap-3 mb-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 cursor-pointer select-none"
                                 onClick={() => setNewLicense({...newLicense, is_permanent: !newLicense.is_permanent})}>
                                <span className="flex items-center gap-2 text-xs text-sky-300">
                                    <InfinityIcon className="w-3.5 h-3.5" />
                                    长期有效（永不过期）
                                </span>
                                <span className={`w-9 h-5 rounded-full relative transition ${newLicense.is_permanent ? 'bg-sky-500' : 'bg-white/15'}`}>
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${newLicense.is_permanent ? 'left-4.5' : 'left-0.5'}`}
                                          style={{left: newLicense.is_permanent ? '18px' : '2px'}}></span>
                                </span>
                            </div>
                            <input
                                required={!newLicense.is_permanent}
                                type="datetime-local"
                                disabled={newLicense.is_permanent}
                                className="glass-input w-full disabled:opacity-30 disabled:cursor-not-allowed"
                                value={newLicense.is_permanent ? '' : newLicense.expiration_date}
                                onChange={e=>setNewLicense({...newLicense, expiration_date:e.target.value})}
                            />
                            {!newLicense.is_permanent && newLicense.expiration_date && (
                                <ExpireHint dateStr={newLicense.expiration_date} />
                            )}
                        </div>
                     </>
                 ) : (
                     <>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">用户名</label>
                            <input required className="glass-input w-full" placeholder="输入新管理员账号" value={newAdmin.username} onChange={e=>setNewAdmin({...newAdmin, username:e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-white/40">密码</label>
                            <input required type="text" className="glass-input w-full" placeholder="设置初始密码" value={newAdmin.password} onChange={e=>setNewAdmin({...newAdmin, password:e.target.value})} />
                        </div>
                     </>
                 )}
                 <div className="pt-2">
                    <button type="submit" className="tech-button w-full flex justify-center items-center gap-2">
                      <Plus size={16} /> {activeTab === 'license' ? '立即授权' : '添加管理员'}
                    </button>
                 </div>
              </form>
          </div>
        </div>

        {/* Main: Details List */}
        <div className="lg:col-span-3">
           <div className="glass-card overflow-hidden flex flex-col min-h-[600px]">
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <h3 className="font-bold flex items-center gap-2">
                    {activeTab === 'license' ? <Sliders size={18} className="text-sky-400"/> : <Shield size={18} className="text-sky-400"/>}
                    {activeTab === 'license' ? '授权列表' : '管理员列表'}
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
                        {activeTab === 'license' ? filteredLicenses.length : admins.length}
                    </span>
                 </h3>
                 <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('license')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'license' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Users className="inline-block w-4 h-4 mr-2" /> 授权管理
                    </button>
                    <button
                        onClick={() => setActiveTab('admin')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'admin' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'}`}
                    >
                        <Shield className="inline-block w-4 h-4 mr-2" /> 管理员管理
                    </button>
                 </div>
             </div>

             {/* 到期状态筛选条 */}
             {activeTab === 'license' && (
                <div className="px-6 py-3 border-b border-white/5 bg-black/10 flex flex-wrap items-center gap-2">
                   <span className="text-xs text-white/40 flex items-center gap-1.5 mr-1">
                      <Sliders className="w-3.5 h-3.5" /> 到期筛选：
                   </span>
                   <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}
                      tone="sky" icon={Users} label="全部" count={statusCounts.all} />
                   <FilterButton active={statusFilter === 'expiring'} onClick={() => setStatusFilter('expiring')}
                      tone="orange" icon={Clock} label={`${REMIND_DAYS}天内到期`} count={statusCounts.expiring} />
                   <FilterButton active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')}
                      tone="red" icon={AlertTriangle} label="已过期" count={statusCounts.expired} />
                   <FilterButton active={statusFilter === 'permanent'} onClick={() => setStatusFilter('permanent')}
                      tone="blue" icon={InfinityIcon} label="长期有效" count={statusCounts.permanent} />
                </div>
             )}
                          <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs font-semibold text-white/40 uppercase tracking-wider bg-black/20">
                      {activeTab === 'license' ? (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">授权QQ</th>
                            <th className="p-4">授权信息</th>
                            <th className="p-4">产品/上级</th>
                            <th className="p-4">状态/时间</th>
                          </>
                      ) : (
                          <>
                            <th className="p-4">ID</th>
                            <th className="p-4">管理员账号</th>
                            <th className="p-4">创建时间/状态</th>
                            <th className="p-4"></th>
                            <th className="p-4"></th>
                          </>
                      )}
                      
                      <th className="p-4 text-right">管理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(activeTab === 'license' ? filteredLicenses : admins).length === 0 ? (
                       <tr>
                         <td colSpan="6" className="p-12 text-center text-white/30">
                            {activeTab === 'license' && statusFilter !== 'all'
                              ? '当前筛选条件下暂无授权记录'
                              : '暂无数据'}
                         </td>
                       </tr>
                    ) : (
                      (activeTab === 'license' ? filteredLicenses : admins).map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                          {activeTab === 'license' ? (
                              <>
                                <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
                                        {item.qq.slice(0, 2)}
                                    </div>
                                    <span className="text-sky-300 font-medium font-mono">{item.qq}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium">{item.owner_name}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">{item.product_name}</div>
                                    <div className="text-xs text-white/40 mt-0.5">{item.upline}</div>
                                </td>
                                <td className="p-4">
                                    <StatusBadge item={item} />
                                    <div className="text-xs text-white/40 font-mono mt-1">
                                    {Number(item.is_permanent) === 1 || !item.expiration_date
                                        ? '无到期时间'
                                        : new Date(item.expiration_date.replace(' ', 'T')).toLocaleDateString()}
                                    </div>
                                </td>
                              </>
                          ) : (
                              <>
                                <td className="p-4 text-white/30 font-mono text-xs">#{item.id}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                                            <User size={14} />
                                        </div>
                                        <span className="text-white font-medium">{item.username}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-white/40">管理员</td>
                                <td className="p-4"></td>
                                <td className="p-4"></td>
                              </>
                          )}
                          
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => confirmDelete(item.id, activeTab)} 
                              className="text-white/20 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination or Footer (Simple) */}
              <div className="p-4 border-t border-white/5 text-xs text-white/30 text-center">
                End of List
              </div>
            </div>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        title={deleteType === 'license' ? "确认删除授权" : "确认删除管理员"}
        type="danger"
        content={deleteType === 'license' 
            ? "您确定要删除此授权吗？删除后该用户将无法查询到授权信息，此操作不可恢复。" 
            : "您确定要删除此管理员吗？删除后该账号将无法登录后台。"
        }
      />
    </div>
  );
}

// 状态筛选按钮：企业蓝为默认选中色，风险类用橙色/红色点缀
function FilterButton({ active, onClick, tone, icon: Icon, label, count }) {
  const tones = {
    sky:    active ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'text-white/50 hover:text-sky-300 border-white/5 hover:border-sky-500/25',
    blue:   active ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'text-white/50 hover:text-blue-300 border-white/5 hover:border-blue-500/25',
    orange: active ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' : 'text-white/50 hover:text-orange-300 border-white/5 hover:border-orange-500/25',
    red:    active ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'text-white/50 hover:text-red-300 border-white/5 hover:border-red-500/25',
  };
  const countTones = {
    sky: active ? 'bg-sky-500/30 text-sky-200' : 'bg-white/10 text-white/40',
    blue: active ? 'bg-blue-500/30 text-blue-200' : 'bg-white/10 text-white/40',
    orange: active ? 'bg-orange-500/30 text-orange-200' : 'bg-white/10 text-white/40',
    red: active ? 'bg-red-500/30 text-red-200' : 'bg-white/10 text-white/40',
  };
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${tones[tone]}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className={`px-1.5 py-px rounded-full text-[10px] font-bold ${countTones[tone]}`}>{count}</span>
    </button>
  );
}

// 授权状态徽标：正常-企业蓝；临期-橙色；过期-红色；长期-蓝色∞
function StatusBadge({ item }) {
  const status = getLicenseStatus(item);
  const days = Number(item.is_permanent) === 1 || !item.expiration_date ? null : getDaysLeft(item);

  const config = {
    normal: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
        <Shield className="w-3 h-3" /> 正常可用 · 剩余 {days} 天
      </span>
    ),
    expiring_soon: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-300 border border-orange-500/30 animate-pulse-soft">
        <Clock className="w-3 h-3" /> {days === 0 ? '今日到期' : `${days} 天后到期`}
      </span>
    ),
    expired: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
        <AlertTriangle className="w-3 h-3" /> 已过期 {Math.abs(days)} 天
      </span>
    ),
    permanent: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <InfinityIcon className="w-3 h-3" /> 长期有效
      </span>
    ),
  };
  return config[status];
}

// 新增表单中选择过期时间后的即时提示
function ExpireHint({ dateStr }) {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" />该时间已过期，请重新选择</p>;
  }
  if (days <= REMIND_DAYS) {
    return <p className="text-[11px] text-orange-300 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />距到期仅 {days} 天，将进入到期提醒</p>;
  }
  return <p className="text-[11px] text-white/30 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />距到期还有 {days} 天</p>;
}
