import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Lock, User, Plus, Trash2, Search, Sliders, Users, Shield, Clock, AlertTriangle, Infinity as InfinityIcon, ShieldCheck } from 'lucide-react';
import Modal from '../components/Modal';

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'expiring_7d', label: '7天内到期' },
  { key: 'expired', label: '已过期' },
  { key: 'permanent', label: '长期有效' },
];

// 后台列表状态徽章：企业蓝为主，风险用橙色/红色点缀
function StatusBadge({ item }) {
  if (item.license_status === 'permanent') {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/25">
          <InfinityIcon className="w-3 h-3" /> 长期有效
        </span>
        <span className="text-xs text-white/40 font-mono">永久授权</span>
      </div>
    );
  }

  if (item.license_status === 'expired') {
    const overdue = Math.abs(item.days_remaining ?? 0);
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/25">
          <AlertTriangle className="w-3 h-3" /> 已过期
        </span>
        <span className="text-xs text-red-400/70 font-mono">
          已逾期 {overdue} 天 · {new Date(item.expiration_date).toLocaleDateString()}
        </span>
      </div>
    );
  }

  if (item.license_status === 'expiring') {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/25">
          <Clock className="w-3 h-3" /> 即将到期
        </span>
        <span className="text-xs text-orange-400/80 font-mono">
          剩余 {item.days_remaining} 天 · {new Date(item.expiration_date).toLocaleDateString()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <ShieldCheck className="w-3 h-3" /> 正常
      </span>
      <span className="text-xs text-white/40 font-mono">
        剩余 {item.days_remaining} 天 · {new Date(item.expiration_date).toLocaleDateString()}
      </span>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dashboard State
  const [licenses, setLicenses] = useState([]);
  const [filteredLicenses, setFilteredLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  useEffect(() => {
    if (!searchTerm) {
      setFilteredLicenses(licenses);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredLicenses(licenses.filter(l =>
        l.qq.includes(lower) ||
        l.owner_name.toLowerCase().includes(lower) ||
        l.product_name.toLowerCase().includes(lower)
      ));
    }
  }, [searchTerm, licenses]);

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

  const fetchLicenses = async (filter = statusFilter) => {
    try {
      const res = await axios.get('/api/license/list', { params: { filter } });
      setLicenses(res.data);
    } catch (err) {
      console.error(err);
      toast.error('授权列表加载失败');
    }
  };

  const handleFilterChange = (key) => {
    setStatusFilter(key);
    fetchLicenses(key);
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
                            <input
                                required={!newLicense.is_permanent}
                                type="datetime-local"
                                disabled={newLicense.is_permanent}
                                className="glass-input w-full disabled:opacity-40 disabled:cursor-not-allowed"
                                value={newLicense.expiration_date}
                                onChange={e=>setNewLicense({...newLicense, expiration_date:e.target.value})}
                            />
                        </div>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500/40 accent-sky-500"
                                checked={newLicense.is_permanent}
                                onChange={e=>setNewLicense({...newLicense, is_permanent: e.target.checked, expiration_date: e.target.checked ? '' : newLicense.expiration_date})}
                            />
                            <span className="text-xs text-white/60 flex items-center gap-1">
                                <InfinityIcon className="w-3.5 h-3.5 text-sky-400" />
                                长期有效（无到期时间）
                            </span>
                        </label>
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
             <div className="p-6 border-b border-white/5 bg-white/5">
                 <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
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
                 {activeTab === 'license' && (
                     <div className="flex flex-wrap gap-2 mt-4">
                        {STATUS_FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => handleFilterChange(f.key)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition border ${
                                    statusFilter === f.key
                                        ? f.key === 'expired'
                                            ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                            : f.key === 'expiring_7d'
                                                ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                                : f.key === 'permanent'
                                                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                                    : 'bg-white/15 text-white border-white/25'
                                        : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white/80'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                     </div>
                 )}
             </div>
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
                            暂无数据
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
