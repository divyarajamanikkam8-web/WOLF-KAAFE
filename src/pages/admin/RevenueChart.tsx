import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type RevenuePoint = { date: string; label: string; revenue: number };

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F97316" stopOpacity={0.25}/><stop offset="95%" stopColor="#F97316" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="#E7E5E4" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#78716C', fontSize: 11 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#78716C', fontSize: 10 }} tickFormatter={value => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`}/><Tooltip formatter={value => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} labelStyle={{ color: '#1C1917' }} contentStyle={{ borderColor: '#E7E5E4', borderRadius: 10 }}/><Area type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={2.5} fill="url(#revenueFill)"/></AreaChart></ResponsiveContainer>;
}
